import type { TicketPriority } from "@/lib/internal-tickets/priority";

// As RPCs da migration 20260923220000 ainda não estão no types.ts gerado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: unknown): any {
  return supabase;
}

export type PreparedTicketSend = {
  already_sent: boolean;
  attempt_token?: string;
  idempotency_key?: string;
  message_id: string | null;
  provider_message_id?: string | null;
  ticket_id: string;
  ticket_number: string;
  title?: string;
  description?: string;
  priority?: TicketPriority;
  sla_first_response_due_at?: string | null;
  sector_name?: string;
  category_name?: string;
  requester_name?: string;
  requester_email?: string;
  recipient_name?: string;
  to?: string[];
  cc?: string[];
};

export async function prepareTicketSend(
  supabase: unknown,
  ticketId: string,
): Promise<PreparedTicketSend> {
  const { data, error } = await db(supabase).rpc("internal_ticket_prepare_send_authenticated", {
    p_ticket_id: ticketId,
  });
  if (error) throw new Error(error.message);
  return data as PreparedTicketSend;
}

export async function markTicketSendSuccess(
  supabase: unknown,
  ticketId: string,
  attemptToken: string,
  providerMessageId: string,
): Promise<void> {
  const { error } = await db(supabase).rpc("internal_ticket_mark_send_success_authenticated", {
    p_ticket_id: ticketId,
    p_attempt_token: attemptToken,
    p_provider_message_id: providerMessageId,
  });
  if (error) throw new Error(`Falha ao confirmar envio: ${error.message}`);
}

export async function markTicketSendFailure(
  supabase: unknown,
  ticketId: string,
  attemptToken: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await db(supabase).rpc("internal_ticket_mark_send_failure_authenticated", {
    p_ticket_id: ticketId,
    p_attempt_token: attemptToken,
    p_error_message: errorMessage,
  });
  if (error) throw new Error(`Falha ao registrar erro de envio: ${error.message}`);
}

export async function recordOpeningMessage(supabase: unknown, ticketId: string): Promise<void> {
  const { error } = await db(supabase).rpc("internal_ticket_record_opening_message_authenticated", {
    p_ticket_id: ticketId,
  });
  if (error) throw new Error(`Falha ao registrar mensagem de abertura: ${error.message}`);
}
