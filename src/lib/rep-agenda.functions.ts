// Server functions do Guia de Agenda (portal do representante).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chaveCliente, type VisitaAgenda } from "@/lib/rep-agenda";
import type { LembretesResult } from "@/lib/rep-agenda.server";

const NOT_MIGRATED = new Set(["PGRST202", "PGRST205", "42883", "42P01"]);
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type AgendaResult = { available: false } | { available: true; visitas: VisitaAgenda[] };

type Raw = {
  id: string;
  row_id: string | null;
  cliente: string;
  data_visita: string;
  hora: string | null;
  objetivo: string | null;
};

export const repAgendaSemana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ inicio: dia, fim: dia }))
  .handler(async ({ data, context }): Promise<AgendaResult> => {
    const { repForUser } = await import("@/lib/rep-portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rep = await repForUser(context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("rep_visit_agenda")
      .select("id, row_id, cliente, data_visita, hora, objetivo")
      .eq("representative_id", rep.id)
      .gte("data_visita", data.inicio)
      .lte("data_visita", data.fim)
      .order("data_visita")
      .limit(300);
    if (error) {
      if (NOT_MIGRATED.has(error.code ?? "")) return { available: false };
      throw new Error(error.message);
    }
    return {
      available: true,
      visitas: ((rows ?? []) as Raw[]).map((r) => ({
        id: r.id,
        rowId: r.row_id,
        cliente: r.cliente,
        data: r.data_visita,
        hora: r.hora,
        objetivo: r.objetivo,
      })),
    };
  });

export const repAgendaAdicionar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      rowIds: z.array(z.string().uuid()).min(1).max(30),
      data: dia,
      hora: z
        .string()
        .regex(/^[0-2]\d:[0-5]\d$/)
        .nullable()
        .optional(),
      objetivo: z.string().trim().max(1000).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { repForUser } = await import("@/lib/rep-portal.server");
    const { rowDoRep, repCompanyId } = await import("@/lib/rep-agenda.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rep = await repForUser(context.userId);
    const companyId = await repCompanyId(rep.id);
    const rows = await Promise.all(data.rowIds.map((id) => rowDoRep(rep, id)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from("rep_visit_agenda").insert(
      rows.map((r) => ({
        company_id: r.companyId ?? companyId,
        representative_id: rep.id,
        row_id: r.id,
        cliente_key: chaveCliente(r.cliente),
        cliente: r.cliente,
        data_visita: data.data,
        hora: data.hora || null,
        objetivo: data.objetivo || null,
        created_by: context.userId,
      })),
    );
    if (error) {
      if (NOT_MIGRATED.has(error.code ?? ""))
        throw new Error("Guia de Agenda ainda não disponível. Avise a gestão.");
      throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const repAgendaRemover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { repForUser } = await import("@/lib/rep-portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rep = await repForUser(context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("rep_visit_agenda")
      .delete()
      .eq("id", data.id)
      .eq("representative_id", rep.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Lembretes da imersão do cliente da visita (quando houver). */
export const repAgendaLembretes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ rowId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<LembretesResult> => {
    const { repForUser } = await import("@/lib/rep-portal.server");
    const { lembretesImersao } = await import("@/lib/rep-agenda.server");
    const rep = await repForUser(context.userId);
    return lembretesImersao(rep, data.rowId);
  });
