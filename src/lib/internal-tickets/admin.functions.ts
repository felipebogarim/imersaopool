import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// internal_ticket_* ainda não está no types.ts gerado (migrations
// 20260923090000/090100 não rodaram contra o projeto Supabase ligado a este
// repo). `as any` é temporário — remover assim que o types.ts regenerar.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: unknown): any {
  return supabase;
}

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const supabase = db(context.supabase);
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Acesso negado: apenas administradores");
}

const deleteByIdSchema = z.object({ id: z.string().uuid() });

// 23503 = foreign_key_violation — algo ainda referencia essa linha (ex.: um
// ticket usa este setor/categoria). Convertido numa mensagem que orienta a
// inativar em vez de excluir, em vez de vazar o erro cru do Postgres.
async function deleteRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  id: string,
  blockedMessage: string,
): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    if (error.code === "23503") throw new Error(blockedMessage);
    throw new Error(error.message);
  }
}

// ── Setores ──────────────────────────────────────────────────────────────

const sectorSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2),
  active: z.boolean().optional(),
  managerPersonId: z.string().uuid().nullable().optional(),
  defaultSlaFirstResponseMinutes: z.number().int().positive().nullable().optional(),
  defaultSlaResolutionMinutes: z.number().int().positive().nullable().optional(),
});

export const upsertInternalTicketSector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => sectorSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabase = db(context.supabase);
    const row = {
      name: data.name,
      active: data.active ?? true,
      manager_person_id: data.managerPersonId ?? null,
      default_sla_first_response_minutes: data.defaultSlaFirstResponseMinutes ?? null,
      default_sla_resolution_minutes: data.defaultSlaResolutionMinutes ?? null,
    };
    const query = data.id
      ? supabase.from("internal_ticket_sectors").update(row).eq("id", data.id)
      : supabase.from("internal_ticket_sectors").insert(row);
    const { data: result, error } = await query.select().single();
    if (error) throw new Error(error.message);
    return result;
  });

const setSectorActiveSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

export const setInternalTicketSectorActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => setSectorActiveSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabase = db(context.supabase);
    const { error } = await supabase
      .from("internal_ticket_sectors")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInternalTicketSector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => deleteByIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabase = db(context.supabase);
    // Exclui em cascata as pessoas cadastradas neste setor (FK ON DELETE
    // CASCADE) — a confirmação no client já avisa disso antes de chamar.
    await deleteRow(
      supabase,
      "internal_ticket_sectors",
      data.id,
      "Não é possível excluir: há tickets vinculados a este setor (atuais ou no histórico). Inative o setor em vez de excluir.",
    );
    return { ok: true };
  });

// ── Pessoas por setor ────────────────────────────────────────────────────

const sectorPersonSchema = z.object({
  id: z.string().uuid().optional(),
  sectorId: z.string().uuid(),
  name: z.string().trim().min(2),
  roleTitle: z.string().trim().nullable().optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().nullable().optional(),
  isPrimaryRecipient: z.boolean().optional(),
  isCc: z.boolean().optional(),
  isEscalationContact: z.boolean().optional(),
  receivesNewTickets: z.boolean().optional(),
  receivesReminders: z.boolean().optional(),
  receivesEscalations: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const upsertInternalTicketSectorPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => sectorPersonSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabase = db(context.supabase);
    const row = {
      sector_id: data.sectorId,
      name: data.name,
      role_title: data.roleTitle ?? null,
      email: data.email.toLowerCase(),
      phone: data.phone?.trim() || null,
      is_primary_recipient: data.isPrimaryRecipient ?? false,
      is_cc: data.isCc ?? false,
      is_escalation_contact: data.isEscalationContact ?? false,
      receives_new_tickets: data.receivesNewTickets ?? true,
      receives_reminders: data.receivesReminders ?? true,
      receives_escalations: data.receivesEscalations ?? false,
      active: data.active ?? true,
    };
    const query = data.id
      ? supabase.from("internal_ticket_sector_people").update(row).eq("id", data.id)
      : supabase.from("internal_ticket_sector_people").insert(row);
    const { data: result, error } = await query.select().single();
    if (error) throw new Error(error.message);
    return result;
  });

const setSectorPersonActiveSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

export const setInternalTicketSectorPersonActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => setSectorPersonActiveSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabase = db(context.supabase);
    const { error } = await supabase
      .from("internal_ticket_sector_people")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInternalTicketSectorPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => deleteByIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabase = db(context.supabase);
    // Sem risco de perder histórico: internal_ticket_recipients guarda um
    // snapshot (nome/e-mail) e só perde o vínculo com esta linha (ON DELETE
    // SET NULL); internal_ticket_sectors.manager_person_id idem.
    await deleteRow(
      supabase,
      "internal_ticket_sector_people",
      data.id,
      "Não foi possível excluir esta pessoa.",
    );
    return { ok: true };
  });

// ── Categorias ───────────────────────────────────────────────────────────

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2),
  defaultSectorId: z.string().uuid().nullable().optional(),
  slaFirstResponseMinutes: z.number().int().positive().nullable().optional(),
  slaResolutionMinutes: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
});

export const upsertInternalTicketCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => categorySchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabase = db(context.supabase);
    const row = {
      name: data.name,
      default_sector_id: data.defaultSectorId ?? null,
      sla_first_response_minutes: data.slaFirstResponseMinutes ?? null,
      sla_resolution_minutes: data.slaResolutionMinutes ?? null,
      active: data.active ?? true,
    };
    const query = data.id
      ? supabase.from("internal_ticket_categories").update(row).eq("id", data.id)
      : supabase.from("internal_ticket_categories").insert(row);
    const { data: result, error } = await query.select().single();
    if (error) throw new Error(error.message);
    return result;
  });

const setCategoryActiveSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

export const setInternalTicketCategoryActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => setCategoryActiveSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabase = db(context.supabase);
    const { error } = await supabase
      .from("internal_ticket_categories")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInternalTicketCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => deleteByIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabase = db(context.supabase);
    await deleteRow(
      supabase,
      "internal_ticket_categories",
      data.id,
      "Não é possível excluir: há tickets vinculados a esta categoria. Inative a categoria em vez de excluir.",
    );
    return { ok: true };
  });
