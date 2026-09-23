import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  hashActionToken,
  TICKET_ACTION_LABEL,
  TICKET_ACTION_REQUIRES_TEXT,
  type TicketAction,
} from "@/lib/internal-tickets/action-tokens";
import { ACTION_TARGET_STATUS } from "@/lib/internal-tickets/action-status-map";
import {
  canReach,
  canTransition,
  TICKET_STATUS_LABEL,
  timestampFieldsForStatus,
  type TicketStatus,
} from "@/lib/internal-tickets/status";

// internal_ticket_* ainda não está no types.ts gerado — mesma ressalva do
// resto do módulo (admin.functions.ts, tickets.functions.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: unknown): any {
  return supabase;
}

/**
 * Sem requireSupabaseAuth: quem recebe o link no e-mail não tem sessão.
 * A autenticação é inteiramente o token — mesmo padrão de
 * representative-token.functions.ts (get_immersion_by_token /
 * submit_representative_input), só que aqui a validação roda em código
 * (hash + expiração + used_at) em vez de numa RPC.
 */

const tokenSchema = z.object({ token: z.string().min(32) });

export type ActionInfoResult =
  | { valid: false; reason: "not_found" | "used" | "expired" }
  | {
      valid: true;
      action: TicketAction;
      actionLabel: string;
      requiresText: boolean;
      ticketNumber: string;
      title: string;
      sectorName: string;
      currentStatusLabel: string;
      alreadyInTargetStatus: boolean;
      applicable: boolean;
    };

export const getInternalTicketActionInfo = createServerFn({ method: "POST" })
  .inputValidator((raw) => tokenSchema.parse(raw))
  .handler(async ({ data }): Promise<ActionInfoResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabase = db(supabaseAdmin);

    const tokenHash = hashActionToken(data.token);
    const { data: tokenRow, error: tokenError } = await supabase
      .from("internal_ticket_action_tokens")
      .select("id, ticket_id, action, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (tokenError) throw new Error(tokenError.message);
    if (!tokenRow) return { valid: false, reason: "not_found" };
    if (tokenRow.used_at) return { valid: false, reason: "used" };
    if (new Date(tokenRow.expires_at).getTime() < Date.now())
      return { valid: false, reason: "expired" };

    const { data: ticket, error: ticketError } = await supabase
      .from("internal_tickets")
      .select("ticket_number, title, status, sector_id")
      .eq("id", tokenRow.ticket_id)
      .single();
    if (ticketError) throw new Error(ticketError.message);

    const { data: sector } = await supabase
      .from("internal_ticket_sectors")
      .select("name")
      .eq("id", ticket.sector_id)
      .single();

    const action = tokenRow.action as TicketAction;
    const currentStatus = ticket.status as TicketStatus;
    const targetStatus = ACTION_TARGET_STATUS[action];
    const alreadyInTargetStatus = currentStatus === targetStatus;

    return {
      valid: true,
      action,
      actionLabel: TICKET_ACTION_LABEL[action],
      requiresText: TICKET_ACTION_REQUIRES_TEXT[action],
      ticketNumber: ticket.ticket_number,
      title: ticket.title,
      sectorName: sector?.name ?? "—",
      currentStatusLabel: TICKET_STATUS_LABEL[currentStatus],
      alreadyInTargetStatus,
      applicable:
        alreadyInTargetStatus ||
        canTransition(currentStatus, targetStatus) ||
        canReach(currentStatus, targetStatus),
    };
  });

const confirmSchema = z.object({
  token: z.string().min(32),
  note: z.string().trim().max(5000).optional(),
});

export const confirmInternalTicketAction = createServerFn({ method: "POST" })
  .inputValidator((raw) => confirmSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabase = db(supabaseAdmin);

    const tokenHash = hashActionToken(data.token);
    const { data: tokenRow, error: tokenError } = await supabase
      .from("internal_ticket_action_tokens")
      .select("id, ticket_id, action, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (tokenError) throw new Error(tokenError.message);
    if (!tokenRow) throw new Error("Link inválido");
    if (tokenRow.used_at) throw new Error("Este link já foi usado");
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) throw new Error("Este link expirou");

    const action = tokenRow.action as TicketAction;
    if (TICKET_ACTION_REQUIRES_TEXT[action] && !data.note?.trim()) {
      throw new Error("Este campo é obrigatório para esta ação");
    }

    // Reivindica o token atomicamente (WHERE used_at IS NULL) antes de
    // aplicar qualquer efeito — protege contra duplo clique/corrida sem
    // precisar de uma transação SQL explícita.
    const { data: claimed, error: claimError } = await supabase
      .from("internal_ticket_action_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimed) throw new Error("Este link já foi usado");

    const { data: ticket, error: ticketError } = await supabase
      .from("internal_tickets")
      .select("id, status, ticket_number")
      .eq("id", tokenRow.ticket_id)
      .single();
    if (ticketError) throw new Error(ticketError.message);

    const currentStatus = ticket.status as TicketStatus;
    const targetStatus = ACTION_TARGET_STATUS[action];
    const alreadyThere = currentStatus === targetStatus;
    if (
      !alreadyThere &&
      !canTransition(currentStatus, targetStatus) &&
      !canReach(currentStatus, targetStatus)
    ) {
      throw new Error(
        `Não é possível aplicar esta ação: o ticket está em "${TICKET_STATUS_LABEL[currentStatus]}"`,
      );
    }

    if (!alreadyThere) {
      const { error: updateError } = await supabase
        .from("internal_tickets")
        .update({ status: targetStatus, ...timestampFieldsForStatus(targetStatus) })
        .eq("id", ticket.id);
      if (updateError) throw new Error(updateError.message);
    }

    if (TICKET_ACTION_REQUIRES_TEXT[action] && data.note) {
      const { error: messageError } = await supabase.from("internal_ticket_messages").insert({
        ticket_id: ticket.id,
        direction: "inbound",
        origin: "sistema",
        body_text: data.note,
      });
      if (messageError) throw new Error(messageError.message);
    }

    const { error: eventError } = await supabase.from("internal_ticket_events").insert({
      ticket_id: ticket.id,
      from_status: alreadyThere ? null : currentStatus,
      to_status: targetStatus,
      origin: "acao_publica",
      observation: data.note ?? `Ação "${TICKET_ACTION_LABEL[action]}" confirmada via link público`,
    });
    if (eventError) throw new Error(eventError.message);

    return { ok: true, ticketNumber: ticket.ticket_number as string, status: targetStatus };
  });
