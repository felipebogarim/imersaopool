import { createHash } from "node:crypto";
import { assessAttachmentContent } from "../attachment-security";
import type { ParsedInboundEmail } from "./inbound";
import type { ResendReceivingClient } from "./resend-receiving.server";

// Schema incremental ainda não está no types.ts gerado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ATTACHMENT_BUCKET = "internal-ticket-attachments";

function safeStorageName(value: string): string {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120) || "attachment";
}

export async function persistInboundAttachments(
  supabase: Db,
  client: ResendReceivingClient,
  message: ParsedInboundEmail,
  ticketId: string,
  internalMessageId: string,
): Promise<void> {
  for (const attachment of message.attachments) {
    const base = {
      ticket_id: ticketId,
      message_id: internalMessageId,
      provider: "resend",
      provider_attachment_id: attachment.id,
      file_name: attachment.filename,
      mime_type: attachment.contentType,
      size_bytes: attachment.size,
      content_disposition: attachment.contentDisposition,
      content_id: attachment.contentId,
      scan_status: "not_scanned",
    };
    try {
      const remote = await client.retrieveAttachment(message.emailId, attachment.id);
      const size = remote.size ?? attachment.size;
      if (size != null && size > MAX_ATTACHMENT_BYTES) throw new Error("attachment_too_large");
      const response = await fetch(remote.downloadUrl);
      if (!response.ok) throw new Error(`attachment_download_${response.status}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error("attachment_too_large");
      const assessment = assessAttachmentContent(new Uint8Array(bytes), attachment.contentType);
      const path = `${ticketId}/inbound/${internalMessageId}/${attachment.id}-${safeStorageName(attachment.filename)}`;
      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, bytes, {
          contentType: assessment.detectedMimeType || "application/octet-stream",
          upsert: false,
        });
      if (uploadError && uploadError.statusCode !== "409") throw new Error(uploadError.message);
      const sha256 = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
      await supabase.from("internal_ticket_attachments").upsert(
        {
          ...base,
          storage_path: path,
          size_bytes: bytes.byteLength,
          sha256,
          detected_mime_type: assessment.detectedMimeType,
          mime_mismatch: assessment.mimeMismatch,
          scan_status: assessment.mimeMismatch || assessment.suspicious ? "blocked" : "not_scanned",
          download_error:
            assessment.mimeMismatch || assessment.suspicious
              ? "attachment_content_quarantined"
              : null,
        },
        { onConflict: "provider,provider_attachment_id", ignoreDuplicates: true },
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await supabase
        .from("internal_ticket_attachments")
        .upsert(
          { ...base, storage_path: null, download_error: detail.slice(0, 1000) },
          { onConflict: "provider,provider_attachment_id", ignoreDuplicates: true },
        );
      console.error("[internal-tickets/inbound] anexo não bloqueou mensagem", {
        attachmentId: attachment.id,
        error: detail,
      });
    }
  }
}
