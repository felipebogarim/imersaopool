import { computeSlaDueDates, resolveEffectiveSlaMinutes } from "@/lib/internal-tickets/sla";
import type { FnContext } from "@/lib/internal-tickets/ticket-permissions";
import type { z } from "zod";
import type { createTicketSchema } from "@/lib/internal-tickets/create-ticket.schema";

type CreateTicketInput = z.infer<typeof createTicketSchema>;

// internal_ticket_* ainda não está no types.ts gerado — ver admin.functions.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: unknown): any {
  return supabase;
}

async function requireModuleRole(context: FnContext): Promise<void> {
  const supabase = db(context.supabase);
  const { data, error } = await supabase.rpc("internal_ticket_module_role", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: sem papel no módulo de Solicitações Internas");
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

/**
 * Valida tudo sem gravar e então cria o ticket via RPC transacional. Fica em
 * *.server.ts para poder importar supabaseAdmin no topo e ser testado sem a
 * camada createServerFn.
 */
export async function createTicketAtomic(context: FnContext, data: CreateTicketInput) {
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

  // Mesmo filtro (setor + active + receives_new_tickets + is_primary_recipient)
  // usado em sendInternalTicket — checado aqui também pra não criar o
  // ticket quando o envio, na sequência, com certeza vai falhar. Evita
  // deixar um ticket "aberto" órfão (criado mas nunca de fato enviado).
  const { data: sectorPeoplePreview, error: sectorPeopleError } = await supabase
    .from("internal_ticket_sector_people")
    .select("is_primary_recipient")
    .eq("sector_id", data.sectorId)
    .eq("active", true)
    .eq("receives_new_tickets", true);
  if (sectorPeopleError) throw new Error(sectorPeopleError.message);
  const hasPrincipalRecipient = (sectorPeoplePreview ?? []).some(
    (p: { is_primary_recipient: boolean }) => p.is_primary_recipient,
  );
  if (!hasPrincipalRecipient) {
    throw new Error(
      "Este setor não possui um destinatário principal configurado para receber novos tickets. Configure um responsável antes de enviar a solicitação.",
    );
  }

  // Config de e-mail inválida (modo ausente/errado) é erro local: falha antes de gravar.
  const { getEmailMode } = await import("@/lib/internal-tickets/email/email-mode.server");
  getEmailMode();

  if (data.productIds.length) {
    const { count, error: productsCheckError } = await supabase
      .from("own_products")
      .select("id", { count: "exact", head: true })
      .in("id", data.productIds);
    if (productsCheckError) throw new Error(productsCheckError.message);
    if (count !== new Set(data.productIds).size) {
      throw new Error("Um ou mais produtos selecionados não existem ou não estão acessíveis.");
    }
  }

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

  // Persistência local obrigatória numa única transação (RPC, migration
  // 20260923190000): ticket + produtos + sector_stop + recipients + evento +
  // outbox pending. Qualquer falha dá rollback de tudo — nenhum ticket parcial.
  // O e-mail em si só é enviado depois, em sendInternalTicket.
  const { buildTicketOpenedIdentity, TICKET_OPENED_KEY_PREFIX } =
    await import("@/lib/internal-tickets/email/send-ticket-email.server");
  const identity = buildTicketOpenedIdentity();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: created, error: createError } = await db(supabaseAdmin).rpc(
    "internal_ticket_create_atomic",
    {
      p_user_id: context.userId,
      p_company_id: companyId,
      p_title: data.title,
      p_description: data.description,
      p_client_id: data.clientId ?? null,
      p_category_id: data.categoryId,
      p_sector_id: data.sectorId,
      p_commercial_owner_user_id: data.commercialOwnerUserId ?? null,
      p_priority: data.priority ?? "normal",
      p_product_ids: data.productIds,
      p_sla_first_response_minutes: firstResponseMinutes,
      p_sla_resolution_minutes: resolutionMinutes,
      p_sla_first_response_due_at: due.firstResponseDueAt?.toISOString() ?? null,
      p_sla_resolution_due_at: due.resolutionDueAt?.toISOString() ?? null,
      p_outbox_idempotency_key_prefix: TICKET_OPENED_KEY_PREFIX,
      p_outbox_sender: identity.sender,
      p_outbox_message_id: identity.messageId,
    },
  );
  if (createError) {
    throw new Error(
      `Não foi possível criar a solicitação. Nenhum ticket foi registrado. (${createError.message})`,
    );
  }
  return created.ticket as { id: string; ticket_number: string };
}
