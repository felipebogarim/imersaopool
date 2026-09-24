import { createHash } from "crypto";
import { collectReferences } from "./message-id";
import { getReplyEnv } from "./email-mode.server";
import { getEmailProvider } from "./provider-factory.server";
import { buildReplyAddressForTicket, parseReplyAddress } from "./reply-address.server";
import { ResendReceivingClient } from "./resend-receiving.server";
import { deriveCleanText, detectInboundQuarantineReason } from "./inbound-security";
import { isTechnicalAddress, parseMailbox, uniqueMailboxes } from "./mailbox";
import { sanitizeInboundHtml } from "../sanitize-html";
import type { ParsedInboundEmail, ResendWebhookEvent } from "./inbound";
import { deriveMessageSignals } from "./message-signals";

// Generated Supabase types do not yet include the incremental EMAIL-FIRST schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ATTACHMENT_BUCKET = "internal-ticket-attachments";

type ClaimResult = {
  claimed: boolean;
  event_id: string;
  lease_token?: string;
  status?: string;
};

type ProcessResult = {
  processed: boolean;
  duplicate?: boolean;
  quarantined?: boolean;
  message_id?: string;
  relays?: Array<{ id: string }>;
};

function safeHeaderName(value: string | null, fallback: string): string {
  const clean = (value || fallback)
    .replace(/[<>"\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, 120) || fallback;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return replacements[character];
  });
}

function findSignedTicketId(message: ParsedInboundEmail): string | null {
  for (const mailbox of uniqueMailboxes([...message.to, ...message.cc])) {
    const result = parseReplyAddress(mailbox.email);
    if (result.valid) return result.ticketId;
  }
  return null;
}

export function directParticipantPayload(message: ParsedInboundEmail, replyDomain: string) {
  const direct = new Map<string, { email: string; name: string | null; source: string }>();
  for (const value of message.to) {
    const mailbox = parseMailbox(value);
    if (mailbox && !isTechnicalAddress(mailbox.email, replyDomain)) {
      direct.set(mailbox.email, { ...mailbox, source: "email_to" });
    }
  }
  for (const value of message.cc) {
    const mailbox = parseMailbox(value);
    if (mailbox && !isTechnicalAddress(mailbox.email, replyDomain) && !direct.has(mailbox.email)) {
      direct.set(mailbox.email, { ...mailbox, source: "email_cc" });
    }
  }
  return [...direct.values()];
}

async function quarantineWithoutTicket(
  supabase: Db,
  eventId: string,
  leaseToken: string,
  reason: string,
) {
  const { error } = await supabase.rpc("internal_ticket_quarantine_webhook", {
    p_event_id: eventId,
    p_lease_token: leaseToken,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

async function relayOne(supabase: Db, relayId: string): Promise<void> {
  const { data: claim, error: claimError } = await supabase.rpc("internal_ticket_claim_relay", {
    p_relay_id: relayId,
  });
  if (claimError) throw new Error(claimError.message);
  if (!claim?.claimed) throw new Error("relay_busy");

  const { data: source, error: sourceError } = await supabase
    .from("internal_ticket_messages")
    .select(
      "id, ticket_id, sender_name, sender_email, subject, body_text, body_html_sanitized, message_id, in_reply_to, reference_ids",
    )
    .eq("id", claim.source_message_id)
    .single();
  if (sourceError) throw new Error(sourceError.message);

  const author = safeHeaderName(source.sender_name, source.sender_email || "Participante");
  const domain = getReplyEnv("INTERNAL_TICKETS_REPLY_DOMAIN");
  const inReplyTo = source.message_id || source.in_reply_to || undefined;
  const references = collectReferences(
    inReplyTo,
    Array.isArray(source.reference_ids) ? source.reference_ids.join(" ") : null,
  );
  const htmlBody = source.body_html_sanitized
    ? `<p style="color:#64748b;font-size:13px"><strong>${escapeHtml(author)}</strong> respondeu:</p>${source.body_html_sanitized}`
    : `<p style="color:#64748b;font-size:13px"><strong>${escapeHtml(author)}</strong> respondeu:</p><pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${escapeHtml(source.body_text || "")}</pre>`;
  const textBody = `${author} respondeu:\n\n${source.body_text || ""}`;

  try {
    const provider = await getEmailProvider();
    const result = await provider.send({
      idempotencyKey: claim.idempotency_key,
      to: [claim.target_email],
      from: `${author} via Solicitações Internas Newline <chamados@${domain}>`,
      replyTo: buildReplyAddressForTicket(claim.ticket_id),
      subject: source.subject || "Solicitação interna Newline",
      html: htmlBody,
      text: textBody,
      messageId: claim.message_id,
      inReplyTo,
      references,
      ticketId: claim.ticket_id,
      templateName: "ticket-inbound-relay",
      headers: {
        "X-Newline-Relay-ID": relayId,
        "X-Newline-System-Message": "relay",
      },
    });
    const { error } = await supabase.rpc("internal_ticket_finish_relay", {
      p_relay_id: relayId,
      p_lease_token: claim.lease_token,
      p_provider_message_id: result.providerMessageId,
      p_error: null,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.rpc("internal_ticket_finish_relay", {
      p_relay_id: relayId,
      p_lease_token: claim.lease_token,
      p_provider_message_id: null,
      p_error: message,
    });
    throw error;
  }
}

async function relayPendingForMessage(supabase: Db, messageId: string): Promise<void> {
  const { data, error } = await supabase
    .from("internal_ticket_relay_deliveries")
    .select("id")
    .eq("source_message_id", messageId)
    .in("status", ["pending", "failed", "sending"]);
  if (error) throw new Error(error.message);
  const outcomes = await Promise.allSettled(
    (data ?? []).map((row: { id: string }) => relayOne(supabase, row.id)),
  );
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      console.error("[internal-tickets/inbound] relay pendente", outcome.reason);
    }
  }
  const failures = outcomes.filter((outcome) => outcome.status === "rejected");
  if (failures.length) throw new Error(`${failures.length} relay(s) pendente(s)`);
}

async function resumeRelays(supabase: Db, providerEmailId: string): Promise<void> {
  const { data } = await supabase
    .from("internal_ticket_messages")
    .select("id")
    .eq("provider", "resend")
    .eq("provider_email_id", providerEmailId)
    .maybeSingle();
  if (data?.id) await relayPendingForMessage(supabase, data.id);
}

function safeStorageName(value: string): string {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120) || "attachment";
}

async function persistAttachments(
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
      const path = `${ticketId}/inbound/${internalMessageId}/${attachment.id}-${safeStorageName(attachment.filename)}`;
      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, bytes, {
          contentType: attachment.contentType || "application/octet-stream",
          upsert: false,
        });
      if (uploadError && uploadError.statusCode !== "409") throw new Error(uploadError.message);
      const sha256 = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
      await supabase
        .from("internal_ticket_attachments")
        .upsert(
          { ...base, storage_path: path, size_bytes: bytes.byteLength, sha256 },
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

export async function processResendInboundEvent(
  supabase: Db,
  providerEventId: string,
  event: ResendWebhookEvent,
): Promise<{ duplicate: boolean; quarantined?: boolean }> {
  const providerEmailId = typeof event.data.email_id === "string" ? event.data.email_id : "";
  if (!providerEmailId) throw new Error("email.received sem email_id");

  const { data: claim, error: claimError } = await supabase.rpc("internal_ticket_claim_webhook", {
    p_provider_event_id: providerEventId,
    p_event_type: event.type,
    p_provider_email_id: providerEmailId,
    p_raw_payload: event,
  });
  if (claimError) throw new Error(claimError.message);
  const claimed = claim as ClaimResult;
  if (!claimed.claimed || !claimed.lease_token) {
    if (claimed.status === "processing") throw new Error("webhook_processing_concurrently");
    await resumeRelays(supabase, providerEmailId);
    return { duplicate: true, quarantined: claimed.status === "quarantined" };
  }

  const client = new ResendReceivingClient();
  try {
    const message = await client.retrieveEmail(providerEmailId);
    // The retrieval endpoint is canonical for content/headers; webhook metadata
    // remains a fallback for fields that may be omitted by provider versions.
    message.emailId ||= providerEmailId;
    if (!message.attachments.length) {
      message.attachments = (await import("./inbound")).parseInboundEmailData(
        event.data,
      ).attachments;
    }
    const ticketId = findSignedTicketId(message);
    if (!ticketId) {
      await quarantineWithoutTicket(
        supabase,
        claimed.event_id,
        claimed.lease_token,
        "invalid_reply_hmac",
      );
      return { duplicate: false, quarantined: true };
    }

    const replyDomain = getReplyEnv("INTERNAL_TICKETS_REPLY_DOMAIN");
    const sender = parseMailbox(message.from);
    const quarantineReason = detectInboundQuarantineReason(message, replyDomain);
    const directParticipants = directParticipantPayload(message, replyDomain);
    const sanitizedHtml = message.html ? sanitizeInboundHtml(message.html) : null;
    const { data: result, error: processError } = await supabase.rpc(
      "internal_ticket_process_inbound",
      {
        p_event_id: claimed.event_id,
        p_lease_token: claimed.lease_token,
        p_ticket_id: ticketId,
        p_provider_email_id: providerEmailId,
        p_message_id: message.messageId,
        p_in_reply_to: message.inReplyTo,
        p_references: message.references,
        p_sender_email: sender?.email ?? message.from,
        p_sender_name: sender?.name,
        p_to: message.to,
        p_cc: message.cc,
        p_direct_participants: directParticipants,
        p_subject: message.subject,
        p_text: message.text,
        p_clean_text: deriveCleanText(message.text),
        p_html_original: message.html,
        p_html_sanitized: sanitizedHtml,
        p_headers: message.headers,
        p_authentication: message.authentication,
        p_received_at: message.receivedAt,
        p_quarantine_reason: quarantineReason,
        p_reply_domain: replyDomain,
      },
    );
    if (processError) throw new Error(processError.message);
    const processed = result as ProcessResult;
    if (processed.message_id && message.attachments.length) {
      await persistAttachments(supabase, client, message, ticketId, processed.message_id);
    }
    if (!processed.quarantined && processed.message_id) {
      const signals = deriveMessageSignals(deriveCleanText(message.text));
      const { error: signalError } = await supabase.from("internal_ticket_message_signals").upsert(
        signals.map((signal) => ({
          ticket_id: ticketId,
          message_id: processed.message_id,
          signal_type: signal.type,
          confidence: signal.confidence,
          source: "regra",
          evidence: {},
        })),
        { onConflict: "message_id,signal_type,source", ignoreDuplicates: true },
      );
      if (signalError)
        console.error("[internal-tickets/inbound] sinais não persistidos", signalError);
    }
    if (!processed.quarantined && processed.message_id) {
      await relayPendingForMessage(supabase, processed.message_id);
    }
    return { duplicate: Boolean(processed.duplicate), quarantined: processed.quarantined };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await supabase.rpc("internal_ticket_fail_webhook", {
      p_event_id: claimed.event_id,
      p_lease_token: claimed.lease_token,
      p_error: detail,
    });
    throw error;
  }
}
