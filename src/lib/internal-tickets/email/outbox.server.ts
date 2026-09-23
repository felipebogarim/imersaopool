import type { EmailDirection, OutboxStatus } from "./types";

export type RecordOutboundAttemptInput = {
  idempotencyKey: string;
  ticketId?: string | null;
  templateName?: string;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  messageId?: string;
  inReplyTo?: string;
  referenceIds?: string[];
};

export type OutboxRow = {
  id: string;
  idempotency_key: string;
  status: OutboxStatus;
  provider_message_id: string | null;
  message_id: string | null;
};

// internal_ticket_email_outbox e o RPC de incremento existem na migration
// 20260923080000 mas ainda não foram aplicados ao projeto Supabase ligado a
// este repo, então não estão no types.ts gerado. `as any` é temporário —
// remover assim que a migration rodar e o types.ts for regenerado.
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver comentário acima
  return supabaseAdmin as any;
}

/**
 * Registra a tentativa de envio antes de chamar o provider. Se a mesma
 * idempotency_key já existir (retry), devolve a linha existente em vez de
 * duplicar — quem chama decide se reenvia (status ainda "pending"/"failed")
 * ou não (já "sent"/"delivered").
 */
export async function recordOutboundAttempt(input: RecordOutboundAttemptInput): Promise<OutboxRow> {
  const supabaseAdmin = await admin();

  const { error: upsertError } = await supabaseAdmin.from("internal_ticket_email_outbox").upsert(
    {
      idempotency_key: input.idempotencyKey,
      direction: "outbound" satisfies EmailDirection,
      ticket_id: input.ticketId ?? null,
      template_name: input.templateName ?? null,
      recipient_email: input.recipientEmail,
      sender_email: input.senderEmail,
      subject: input.subject,
      message_id: input.messageId ?? null,
      in_reply_to: input.inReplyTo ?? null,
      reference_ids: input.referenceIds ?? null,
      status: "pending",
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );

  if (upsertError) throw new Error(`Falha ao registrar outbox: ${upsertError.message}`);

  const { data: row, error: readError } = await supabaseAdmin
    .from("internal_ticket_email_outbox")
    .select("id, idempotency_key, status, provider_message_id, message_id")
    .eq("idempotency_key", input.idempotencyKey)
    .single();

  if (readError || !row) throw new Error(`Falha ao ler outbox após upsert: ${readError?.message}`);
  return row as OutboxRow;
}

export async function markOutboxSent(
  idempotencyKey: string,
  providerMessageId: string,
): Promise<void> {
  const supabaseAdmin = await admin();
  const { error } = await supabaseAdmin
    .from("internal_ticket_email_outbox")
    .update({
      status: "sent",
      provider_message_id: providerMessageId,
      last_attempted_at: new Date().toISOString(),
    })
    .eq("idempotency_key", idempotencyKey);
  if (error) throw new Error(`Falha ao marcar outbox como enviado: ${error.message}`);
  await incrementAttempt(idempotencyKey);
}

export async function markOutboxFailed(
  idempotencyKey: string,
  errorMessage: string,
): Promise<void> {
  const supabaseAdmin = await admin();
  const { error } = await supabaseAdmin
    .from("internal_ticket_email_outbox")
    .update({
      status: "failed",
      error_message: errorMessage.slice(0, 1000),
      last_attempted_at: new Date().toISOString(),
    })
    .eq("idempotency_key", idempotencyKey);
  if (error) throw new Error(`Falha ao marcar outbox como falho: ${error.message}`);
  await incrementAttempt(idempotencyKey);
}

async function incrementAttempt(idempotencyKey: string): Promise<void> {
  const supabaseAdmin = await admin();
  const { error } = await supabaseAdmin.rpc("internal_ticket_email_outbox_increment_attempt", {
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(`Falha ao incrementar tentativa do outbox: ${error.message}`);
}
