import type { FnContext } from "@/lib/internal-tickets/ticket-permissions";
import type { EmailProvider } from "@/lib/internal-tickets/email/types";
import { TICKET_PRIORITY_LABEL } from "@/lib/internal-tickets/priority";

function requirePreparedValue<T>(value: T | null | undefined, name: string): T {
  if (value == null || value === "") {
    throw new Error(`Preparação de envio retornou ${name} inválido.`);
  }
  return value;
}

async function confirmSendSuccess(confirm: () => Promise<void>, maxAttempts = 3): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await confirm();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function sendTicketAuthenticated(
  context: FnContext,
  ticketId: string,
  providerOverride?: EmailProvider,
): Promise<{ ok: true; ticketId: string; status: "enviado"; alreadySent: boolean }> {
  const { getEmailMode } = await import("@/lib/internal-tickets/email/email-mode.server");
  const mode = getEmailMode();
  console.info(`[INTERNAL_TICKETS_EMAIL] provider=${mode}`);

  const { markTicketSendFailure, markTicketSendSuccess, prepareTicketSend, recordOpeningMessage } =
    await import("@/lib/internal-tickets/email/outbox.server");
  const prepared = await prepareTicketSend(context.supabase, ticketId);

  if (prepared.already_sent) {
    console.info(`[INTERNAL_TICKETS_EMAIL] already sent ticket=${ticketId}`);
    return { ok: true, ticketId, status: "enviado", alreadySent: true };
  }

  const attemptToken = requirePreparedValue(prepared.attempt_token, "attempt_token");
  const idempotencyKey = requirePreparedValue(prepared.idempotency_key, "idempotency_key");
  const priority = requirePreparedValue(prepared.priority, "priority");
  const to = requirePreparedValue(prepared.to, "recipients");

  let result: { providerMessageId: string; messageId: string };
  try {
    requirePreparedValue(prepared.requester_email, "requester_email");
    const { sendTicketOpenedEmail } =
      await import("@/lib/internal-tickets/email/send-ticket-email.server");
    result = await sendTicketOpenedEmail(
      {
        ticketId,
        ticketNumber: prepared.ticket_number,
        title: requirePreparedValue(prepared.title, "title"),
        description: requirePreparedValue(prepared.description, "description"),
        sectorName: requirePreparedValue(prepared.sector_name, "sector_name"),
        categoryName: prepared.category_name ?? "—",
        priorityLabel: priority === "normal" ? "Média" : TICKET_PRIORITY_LABEL[priority],
        requesterName: prepared.requester_name ?? "Comercial",
        recipientName: requirePreparedValue(prepared.recipient_name, "recipient_name"),
        dueAtLabel: prepared.sla_first_response_due_at
          ? new Date(prepared.sla_first_response_due_at).toLocaleString("pt-BR")
          : null,
        idempotencyKey,
        messageId: prepared.message_id,
        to,
        cc: prepared.cc ?? [],
      },
      providerOverride,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await markTicketSendFailure(context.supabase, ticketId, attemptToken, message);
    } catch (bookkeepingError) {
      const bookkeepingMessage =
        bookkeepingError instanceof Error ? bookkeepingError.message : String(bookkeepingError);
      throw new Error(`${message} (também falhou ao registrar a tentativa: ${bookkeepingMessage})`);
    }
    throw err;
  }

  // O provider já aceitou o envio. Se a confirmação transacional falhar,
  // não marque a outbox como failed (isso mentiria sobre o resultado externo).
  // A RPC é idempotente; retries curtos reduzem a janela em que o provider
  // aceitou o e-mail mas a outbox ainda não recebeu a confirmação.
  await confirmSendSuccess(() =>
    markTicketSendSuccess(context.supabase, ticketId, attemptToken, result.providerMessageId),
  );
  try {
    await recordOpeningMessage(context.supabase, ticketId);
  } catch (error) {
    // Provider + outbox are already confirmed. Never report a false send
    // failure because only the secondary conversation projection failed.
    console.error("[INTERNAL_TICKETS_EMAIL] opening message projection failed", error);
  }
  console.info(`[INTERNAL_TICKETS_EMAIL] send success ticket=${ticketId}`);
  return { ok: true, ticketId, status: "enviado", alreadySent: false };
}
