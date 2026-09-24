import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canTransition,
  timestampFieldsForStatus,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
  type TicketStatus,
} from "@/lib/internal-tickets/status";
import { requireCanManageTicket, type FnContext } from "@/lib/internal-tickets/ticket-permissions";
import { MASTER_EMAIL } from "@/lib/nav-tree";

// internal_ticket_* ainda não está no types.ts gerado — mesma ressalva do
// resto do módulo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: unknown): any {
  return supabase;
}

// ── Mudança manual de status (tela de Detalhe) ──────────────────────────
//
// Diferente das ações públicas do e-mail (que usam canReach e podem pular
// etapas), a tela de Detalhe só oferece botões para os próximos status
// válidos — por isso aqui a checagem é canTransition estrita, não canReach.
// RLS (internal_tickets_update) já limita quem pode chegar a alterar a
// linha; esta função valida a transição em si.

const updateStatusSchema = z.object({
  ticketId: z.string().uuid(),
  toStatus: z.enum(TICKET_STATUSES),
  observation: z.string().trim().max(2000).optional(),
});

export const updateInternalTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => updateStatusSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const supabase = db(context.supabase);

    const { data: ticket, error: ticketError } = await supabase
      .from("internal_tickets")
      .select("id, status")
      .eq("id", data.ticketId)
      .single();
    if (ticketError) throw new Error(ticketError.message);

    const fromStatus: TicketStatus = ticket.status;
    if (!canTransition(fromStatus, data.toStatus)) {
      throw new Error(
        `Não é possível mover de "${TICKET_STATUS_LABEL[fromStatus]}" para "${TICKET_STATUS_LABEL[data.toStatus]}"`,
      );
    }

    const { error: updateError } = await supabase
      .from("internal_tickets")
      .update({ status: data.toStatus, ...timestampFieldsForStatus(data.toStatus) })
      .eq("id", data.ticketId);
    if (updateError) throw new Error(updateError.message);

    const { error: eventError } = await supabase.from("internal_ticket_events").insert({
      ticket_id: data.ticketId,
      from_status: fromStatus,
      to_status: data.toStatus,
      origin: "comercial",
      author_user_id: context.userId,
      observation: data.observation ?? null,
    });
    if (eventError) throw new Error(eventError.message);

    if (data.toStatus === "aguardando_validacao") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { sendRequesterValidationEmail } =
        await import("@/lib/internal-tickets/email/validation-email.server");
      await sendRequesterValidationEmail(db(supabaseAdmin), data.ticketId);
    }

    return { ok: true, status: data.toStatus };
  });

// ── Registro manual de interação (presencial ou por telefone) ──────────

const manualInteractionSchema = z.object({
  ticketId: z.string().uuid(),
  channel: z.enum(["manual_presencial", "manual_telefone"]),
  note: z.string().trim().min(1).max(5000),
});

export const logManualInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => manualInteractionSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const supabase = db(context.supabase);

    const { error: messageError } = await supabase.from("internal_ticket_messages").insert({
      ticket_id: data.ticketId,
      direction: "inbound",
      origin: data.channel,
      author_user_id: context.userId,
      body_text: data.note,
    });
    if (messageError) throw new Error(messageError.message);

    const { error: eventError } = await supabase.from("internal_ticket_events").insert({
      ticket_id: data.ticketId,
      origin: "comercial",
      author_user_id: context.userId,
      observation: `Interação registrada (${data.channel === "manual_presencial" ? "presencial" : "telefone"})`,
    });
    if (eventError) throw new Error(eventError.message);

    return { ok: true };
  });

// ── Encaminhar para outro setor ─────────────────────────────────────────
//
// internal_tickets.sector_id é o setor atual (cache); internal_ticket_sector_stops
// é o histórico completo (uma linha por parada, left_at NULL = onde está
// agora). Fecha a parada aberta, abre uma nova, atualiza o cache e loga um
// evento — nessa ordem, sem transação SQL explícita (mesma limitação já
// aceita no resto do módulo, ver PROJECT_BRAIN).

const reassignSectorSchema = z.object({
  ticketId: z.string().uuid(),
  toSectorId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export const reassignInternalTicketSector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => reassignSectorSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const supabase = db(context.supabase);

    const { data: ticket, error: ticketError } = await supabase
      .from("internal_tickets")
      .select("id, sector_id, requester_user_id, commercial_owner_user_id")
      .eq("id", data.ticketId)
      .single();
    if (ticketError) throw new Error(ticketError.message);
    await requireCanManageTicket(context, ticket);

    if (ticket.sector_id === data.toSectorId) {
      throw new Error("O ticket já está neste setor");
    }

    const [{ data: fromSector }, { data: toSector, error: toSectorError }] = await Promise.all([
      supabase.from("internal_ticket_sectors").select("name").eq("id", ticket.sector_id).single(),
      supabase
        .from("internal_ticket_sectors")
        .select("name, active")
        .eq("id", data.toSectorId)
        .single(),
    ]);
    if (toSectorError) throw new Error(toSectorError.message);
    if (!toSector.active) throw new Error("Setor de destino está inativo");

    const { error: updateError } = await supabase
      .from("internal_tickets")
      .update({ sector_id: data.toSectorId })
      .eq("id", data.ticketId);
    if (updateError) throw new Error(updateError.message);

    // Sem policy de insert/update authenticated em internal_ticket_sector_stops
    // (mesma razão da Fase 10) — grava via service role.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = db(supabaseAdmin);

    const { error: participantError } = await admin.rpc(
      "internal_ticket_sync_sector_participants",
      { p_ticket_id: data.ticketId, p_sector_id: data.toSectorId },
    );
    if (participantError) throw new Error(participantError.message);

    const { error: closeError } = await admin
      .from("internal_ticket_sector_stops")
      .update({ left_at: new Date().toISOString() })
      .eq("ticket_id", data.ticketId)
      .is("left_at", null);
    if (closeError) throw new Error(closeError.message);

    const { error: openError } = await admin.from("internal_ticket_sector_stops").insert({
      ticket_id: data.ticketId,
      sector_id: data.toSectorId,
      moved_by: context.userId,
      reason: data.reason ?? null,
    });
    if (openError) throw new Error(openError.message);

    const { error: eventError } = await supabase.from("internal_ticket_events").insert({
      ticket_id: data.ticketId,
      origin: "comercial",
      author_user_id: context.userId,
      observation: `Encaminhado de ${fromSector?.name ?? "—"} para ${toSector.name}${data.reason ? `: ${data.reason}` : ""}`,
    });
    if (eventError) throw new Error(eventError.message);

    return { ok: true, sectorId: data.toSectorId };
  });

// ── Excluir ticket (só gestor master) ───────────────────────────────────
//
// Sem policy de DELETE para authenticated em internal_tickets (decisão da
// Fase 1: tickets não se apagam, se cancelam) — por isso passa por
// supabaseAdmin mesmo depois de confirmado o e-mail master. Todas as
// tabelas filhas (eventos, mensagens, anexos, produtos, paradas de setor,
// destinatários, tokens de ação) têm ON DELETE CASCADE em ticket_id, então
// a exclusão usa internal_ticket_delete_atomic (ticket + outbox sem FK) e
// remove os arquivos do bucket depois do commit.

async function assertMasterUser(context: FnContext): Promise<void> {
  const supabase = db(context.supabase);
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if ((data?.email ?? "").toLowerCase() !== MASTER_EMAIL) {
    throw new Error("Acesso negado: apenas o gestor master pode excluir tickets");
  }
}

const deleteTicketSchema = z.object({ ticketId: z.string().uuid() });

export const deleteInternalTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => deleteTicketSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertMasterUser(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = db(supabaseAdmin);
    // Caminhos dos anexos ANTES de apagar (as linhas somem na cascata).
    const { data: attachments, error: attachmentsError } = await admin
      .from("internal_ticket_attachments")
      .select("storage_path")
      .eq("ticket_id", data.ticketId);
    if (attachmentsError) throw new Error(attachmentsError.message);

    // Ticket + outbox (sem FK) numa transação; filhos com FK saem por CASCADE.
    const { error } = await admin.rpc("internal_ticket_delete_atomic", {
      p_ticket_id: data.ticketId,
    });
    if (error) throw new Error(error.message);

    // Depois do commit: remove os arquivos físicos. Falha aqui não desfaz a
    // exclusão (já commitada) — é reportada para limpeza manual.
    const paths = ((attachments ?? []) as { storage_path: string }[]).map((a) => a.storage_path);
    let storageCleanupFailed = false;
    if (paths.length) {
      const { error: storageError } = await admin.storage
        .from("internal-ticket-attachments")
        .remove(paths);
      storageCleanupFailed = Boolean(storageError);
    }
    return { ok: true, storageCleanupFailed };
  });
