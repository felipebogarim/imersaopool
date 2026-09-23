import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TICKET_PRIORITIES } from "@/lib/internal-tickets/priority";
import { computeSlaDueDates, resolveEffectiveSlaMinutes } from "@/lib/internal-tickets/sla";
import {
  canTransition,
  timestampFieldsForStatus,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
  type TicketStatus,
} from "@/lib/internal-tickets/status";

// internal_ticket_* ainda não está no types.ts gerado — mesmo motivo e
// mesma ressalva de admin.functions.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: unknown): any {
  return supabase;
}

type FnContext = { supabase: unknown; userId: string };

type SectorPersonRow = {
  id: string;
  name: string;
  email: string;
  is_primary_recipient: boolean;
  is_cc: boolean;
};

async function requireModuleRole(context: FnContext): Promise<void> {
  const supabase = db(context.supabase);
  const { data, error } = await supabase.rpc("internal_ticket_module_role", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: sem papel no módulo de Solicitações Internas");
}

/**
 * Confere, antes de disparar qualquer e-mail, que quem chama tem permissão
 * de movimentar o ticket (mesma regra da policy internal_tickets_update).
 * RLS já barraria o UPDATE no fim do fluxo, mas silenciosamente (0 linhas
 * afetadas, sem erro) — sem este check, o e-mail sairia mesmo assim para um
 * usuário sem permissão de fato mover o ticket (ex.: papel diretoria).
 */
async function requireCanManageTicket(
  context: FnContext,
  ticket: { requester_user_id: string; commercial_owner_user_id: string },
): Promise<void> {
  if (ticket.requester_user_id === context.userId) return;
  if (ticket.commercial_owner_user_id === context.userId) return;
  const supabase = db(context.supabase);
  const [{ data: isGestorComercial }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: context.userId, _role: "gestor_comercial" }),
    supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
  ]);
  if (!isGestorComercial && !isAdmin) {
    throw new Error("Acesso negado: você não pode enviar este ticket");
  }
}

async function requireActiveCompanyId(context: FnContext): Promise<string> {
  const supabase = db(context.supabase);
  const { data, error } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.active_company_id) throw new Error("Nenhuma empresa ativa selecionada");
  return data.active_company_id as string;
}

// ── Criar ticket ─────────────────────────────────────────────────────────

const createTicketSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().min(1),
  clientId: z.string().uuid().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid(),
  sectorId: z.string().uuid(),
  commercialOwnerUserId: z.string().uuid().nullable().optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
});

export const createInternalTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => createTicketSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await requireModuleRole(context);
    const supabase = db(context.supabase);
    const companyId = await requireActiveCompanyId(context);

    const [{ data: category, error: categoryError }, { data: sector, error: sectorError }] =
      await Promise.all([
        supabase
          .from("internal_ticket_categories")
          .select("sla_first_response_minutes, sla_resolution_minutes")
          .eq("id", data.categoryId)
          .single(),
        supabase
          .from("internal_ticket_sectors")
          .select("default_sla_first_response_minutes, default_sla_resolution_minutes")
          .eq("id", data.sectorId)
          .single(),
      ]);
    if (categoryError) throw new Error(categoryError.message);
    if (sectorError) throw new Error(sectorError.message);

    const firstResponseMinutes = resolveEffectiveSlaMinutes(
      sector.default_sla_first_response_minutes,
      category.sla_first_response_minutes,
    );
    const resolutionMinutes = resolveEffectiveSlaMinutes(
      sector.default_sla_resolution_minutes,
      category.sla_resolution_minutes,
    );
    const createdAt = new Date();
    const due = computeSlaDueDates(createdAt, { firstResponseMinutes, resolutionMinutes });

    const { data: ticket, error: insertError } = await supabase
      .from("internal_tickets")
      .insert({
        company_id: companyId,
        title: data.title,
        description: data.description,
        client_id: data.clientId ?? null,
        product_id: data.productId ?? null,
        category_id: data.categoryId,
        sector_id: data.sectorId,
        requester_user_id: context.userId,
        commercial_owner_user_id: data.commercialOwnerUserId ?? context.userId,
        priority: data.priority ?? "normal",
        status: "aberto",
        sla_first_response_minutes: firstResponseMinutes,
        sla_resolution_minutes: resolutionMinutes,
        sla_first_response_due_at: due.firstResponseDueAt?.toISOString() ?? null,
        sla_resolution_due_at: due.resolutionDueAt?.toISOString() ?? null,
      })
      .select()
      .single();
    if (insertError) throw new Error(insertError.message);

    const { error: eventError } = await supabase.from("internal_ticket_events").insert({
      ticket_id: ticket.id,
      from_status: null,
      to_status: "aberto",
      origin: "comercial",
      author_user_id: context.userId,
      observation: "Ticket criado",
    });
    if (eventError) throw new Error(eventError.message);

    // Primeira parada do histórico de setor — sem policy de insert
    // authenticated na tabela (mesma razão da Fase 10), grava via service role.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: stopError } = await db(supabaseAdmin)
      .from("internal_ticket_sector_stops")
      .insert({ ticket_id: ticket.id, sector_id: data.sectorId, moved_by: context.userId });
    if (stopError) throw new Error(stopError.message);

    return ticket;
  });

// ── Enviar ticket (aberto -> enviado, dispara e-mail) ───────────────────

const sendTicketSchema = z.object({ ticketId: z.string().uuid() });

export const sendInternalTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => sendTicketSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const supabase = db(context.supabase);

    const { data: ticket, error: ticketError } = await supabase
      .from("internal_tickets")
      .select(
        "id, ticket_number, title, description, status, sector_id, category_id, requester_user_id, commercial_owner_user_id, priority, sla_first_response_due_at",
      )
      .eq("id", data.ticketId)
      .single();
    if (ticketError) throw new Error(ticketError.message);
    if (ticket.status !== "aberto") {
      throw new Error(`Ticket não está em "Aberto" (status atual: ${ticket.status})`);
    }
    await requireCanManageTicket(context, ticket);

    const [
      { data: sector, error: sectorError },
      { data: people, error: peopleError },
      { data: category, error: categoryError },
      { data: requester, error: requesterError },
    ] = await Promise.all([
      supabase.from("internal_ticket_sectors").select("name").eq("id", ticket.sector_id).single(),
      supabase
        .from("internal_ticket_sector_people")
        .select("id, name, email, is_primary_recipient, is_cc")
        .eq("sector_id", ticket.sector_id)
        .eq("active", true)
        .eq("receives_new_tickets", true),
      supabase
        .from("internal_ticket_categories")
        .select("name")
        .eq("id", ticket.category_id)
        .single(),
      supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", ticket.requester_user_id)
        .maybeSingle(),
    ]);
    if (sectorError) throw new Error(sectorError.message);
    if (peopleError) throw new Error(peopleError.message);
    if (categoryError) throw new Error(categoryError.message);
    if (requesterError) throw new Error(requesterError.message);

    const sectorPeople = (people ?? []) as SectorPersonRow[];
    const toPeople = sectorPeople.filter((p) => p.is_primary_recipient);
    const ccPeople = sectorPeople.filter((p) => p.is_cc && !p.is_primary_recipient);
    if (toPeople.length === 0) {
      throw new Error(
        `Nenhum destinatário principal configurado para o setor ${sector.name}. Cadastre pessoas em Admin → Solicitações Internas.`,
      );
    }

    const { sendTicketOpenedEmail } =
      await import("@/lib/internal-tickets/email/send-ticket-email.server");
    const { TICKET_PRIORITY_LABEL } = await import("@/lib/internal-tickets/priority");

    await sendTicketOpenedEmail({
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      title: ticket.title,
      description: ticket.description,
      sectorName: sector.name,
      categoryName: category?.name ?? "—",
      priorityLabel: TICKET_PRIORITY_LABEL[ticket.priority as keyof typeof TICKET_PRIORITY_LABEL],
      requesterName: requester?.full_name ?? requester?.email ?? "Comercial",
      dueAtLabel: ticket.sla_first_response_due_at
        ? new Date(ticket.sla_first_response_due_at).toLocaleString("pt-BR")
        : null,
      to: toPeople.map((p) => p.email),
      cc: ccPeople.map((p) => p.email),
    });

    // Snapshot dos destinatários efetivos — grava via service role porque a
    // tabela não tem policy de insert para authenticated (é gerada no envio).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = db(supabaseAdmin);
    const recipientRows = [
      ...toPeople.map((p) => ({
        ticket_id: ticket.id,
        sector_person_id: p.id,
        email: p.email,
        name_snapshot: p.name,
        role: "principal" as const,
      })),
      ...ccPeople.map((p) => ({
        ticket_id: ticket.id,
        sector_person_id: p.id,
        email: p.email,
        name_snapshot: p.name,
        role: "copia" as const,
      })),
    ];
    const { error: recipientsError } = await admin
      .from("internal_ticket_recipients")
      .insert(recipientRows);
    if (recipientsError) throw new Error(recipientsError.message);

    const sentAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("internal_tickets")
      .update({ status: "enviado", sent_at: sentAt })
      .eq("id", ticket.id);
    if (updateError) throw new Error(updateError.message);

    // origin "sistema" — grava via service role: a policy de INSERT
    // autenticada (migration 20260923130000) só permite origin='comercial'
    // no caminho do usuário, exatamente pra impedir um evento autenticado se
    // passar por um evento gerado pelo sistema.
    const { error: eventError } = await admin.from("internal_ticket_events").insert({
      ticket_id: ticket.id,
      from_status: "aberto",
      to_status: "enviado",
      origin: "sistema",
      author_user_id: context.userId,
      observation: `E-mail enviado para ${toPeople.length} destinatário(s) principal(is)`,
    });
    if (eventError) throw new Error(eventError.message);

    return { ok: true, ticketId: ticket.id, status: "enviado" as const };
  });

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
