import { supabase } from "@/integrations/supabase/client";

// internal_ticket_attachments ainda não está no types.ts gerado — mesma
// ressalva do resto do módulo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return supabase;
}

const BUCKET = "internal-ticket-attachments";
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — alinhado a outros uploads do app

export class AttachmentTooLargeError extends Error {
  constructor() {
    super("Arquivo maior que 20MB");
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(-120);
}

/**
 * Sobe o arquivo pro bucket privado (path prefixado pelo ticket_id — é essa
 * prática, não a policy do bucket em si, que impede acesso cruzado; ver
 * migration 20260923120000) e registra a linha em internal_ticket_attachments
 * na sequência. Se o insert da linha falhar, o arquivo já subiu mas fica
 * órfão (sem linha, ninguém enxerga via RLS) — aceitável para o MVP.
 */
export async function uploadTicketAttachment(
  ticketId: string,
  file: File,
): Promise<{ id: string }> {
  if (file.size > MAX_SIZE_BYTES) throw new AttachmentTooLargeError();

  const path = `${ticketId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await db()
    .from("internal_ticket_attachments")
    .insert({
      ticket_id: ticketId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getAttachmentDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 5); // 5 minutos — link é gerado sob demanda, não persistido
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
