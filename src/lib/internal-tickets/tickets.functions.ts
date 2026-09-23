import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createTicketSchema } from "@/lib/internal-tickets/create-ticket.schema";
import { requireCanManageTicket, type FnContext } from "@/lib/internal-tickets/ticket-permissions";

// internal_ticket_* ainda não está no types.ts gerado — mesmo motivo e
// mesma ressalva de admin.functions.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: unknown): any {
  return supabase;
}

// ── Criar ticket ─────────────────────────────────────────────────────────

export const createInternalTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => createTicketSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { createTicketAtomic } = await import("@/lib/internal-tickets/create-ticket.server");
    return createTicketAtomic(context, data);
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = db(supabaseAdmin);
    const [
      { data: sector, error: sectorError },
      { data: recipients, error: recipientsError },
      { data: category, error: categoryError },
      { data: requester, error: requesterError },
    ] = await Promise.all([
      supabase.from("internal_ticket_sectors").select("name").eq("id", ticket.sector_id).single(),
      // Snapshot gravado atomicamente na criação — não recalcula a partir do setor.
      admin.from("internal_ticket_recipients").select("email, role").eq("ticket_id", ticket.id),
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
    if (recipientsError) throw new Error(recipientsError.message);
    if (categoryError) throw new Error(categoryError.message);
    if (requesterError) throw new Error(requesterError.message);

    const rows = (recipients ?? []) as { email: string; role: "principal" | "copia" }[];
    const toEmails = rows.filter((r) => r.role === "principal").map((r) => r.email);
    const ccEmails = rows.filter((r) => r.role === "copia").map((r) => r.email);

    const { sendTicketOpenedEmail } =
      await import("@/lib/internal-tickets/email/send-ticket-email.server");
    const { TICKET_PRIORITY_LABEL } = await import("@/lib/internal-tickets/priority");

    // Falha do provider/config propaga aqui: o ticket (já consistente) permanece
    // "aberto", a outbox fica 'failed' com error_message, e este método pode ser
    // chamado de novo (retry idempotente — não reenvia se já saiu).
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
      to: toEmails,
      cc: ccEmails,
    });

    // Só depois da confirmação do provider o ticket vira "enviado".
    const sentAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("internal_tickets")
      .update({ status: "enviado", sent_at: sentAt })
      .eq("id", ticket.id);
    if (updateError) throw new Error(updateError.message);

    // origin "sistema" — grava via service role (policy autenticada só permite 'comercial').
    const { error: eventError } = await admin.from("internal_ticket_events").insert({
      ticket_id: ticket.id,
      from_status: "aberto",
      to_status: "enviado",
      origin: "sistema",
      author_user_id: context.userId,
      observation: `E-mail enviado para ${toEmails.length} destinatário(s) principal(is)`,
    });
    if (eventError) throw new Error(eventError.message);

    return { ok: true, ticketId: ticket.id, status: "enviado" as const };
  });
