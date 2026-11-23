// Performance → METAS: server functions de leitura/gravação (tabelas performance_goal_*).
//
// Gestão (admin/gestor): RPCs com o cliente RLS do usuário; o banco confere papel e empresa.
// Representante (usuário externo): service role + `repForUser`, sempre limitado à carteira
// dele, recebendo só meta oficial, as próprias sugestões e o atingimento já calculado.
// Enquanto a migration não for aplicada, as leituras devolvem `available: false`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CANONICAL_FAMILIES } from "@/lib/client-bi-familias";
import {
  repView,
  type GoalsState,
  type MetasLoadResult,
  type RepGoalsView,
} from "@/lib/performance-metas-persistence";

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
};

// Função/tabela inexistente: a migration ainda não foi aplicada.
const NOT_MIGRATED = new Set(["PGRST202", "PGRST205", "42883", "42P01"]);

async function callRpc(
  client: unknown,
  fn: string,
  args: Record<string, unknown>,
): Promise<MetasLoadResult> {
  const { data, error } = await (client as RpcClient).rpc(fn, args);
  if (error) {
    if (NOT_MIGRATED.has(error.code ?? "")) return { available: false };
    throw new Error(error.message);
  }
  return { available: true, state: data as GoalsState };
}

const familia = z.enum(CANONICAL_FAMILIES);
const money = z.number().nonnegative().max(1e11).nullable();
const text = z.string().max(4000);
const rowInput = z.object({ rowId: z.string().uuid() });

// ------------------------------- Gestão --------------------------------------

export const getMetasGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput)
  .handler(({ data, context }) =>
    callRpc(context.supabase, "get_performance_goals", { _row_id: data.rowId }),
  );

export const saveMetasGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    rowInput.extend({
      metas: z
        .array(
          z.object({
            familia,
            meta_mensal: money,
            origem: z.enum(["padrao", "ia", "representante", "gestor"]),
            comentario_gestor: text,
            referencia: money,
          }),
        )
        .max(7),
      sugestoes_ia: z
        .array(
          z.object({
            familia,
            valor: z.number().nonnegative().max(1e11),
            justificativa: text,
            tag: z.enum(["imersao", "tendencia"]),
            origem: z.enum(["simulacao", "modelo"]),
          }),
        )
        .max(7),
    }),
  )
  .handler(({ data, context }) =>
    callRpc(context.supabase, "save_performance_goals", {
      _row_id: data.rowId,
      _metas: data.metas,
      _sugestoes_ia: data.sugestoes_ia,
    }),
  );

export const renewMetasCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput.extend({ meses: z.union([z.literal(6), z.literal(12)]) }))
  .handler(({ data, context }) =>
    callRpc(context.supabase, "renew_performance_goal_cycle", {
      _row_id: data.rowId,
      _meses: data.meses,
    }),
  );

export const extendMetasCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput)
  .handler(({ data, context }) =>
    callRpc(context.supabase, "extend_performance_goal_cycle", { _row_id: data.rowId }),
  );

export const confirmMetasLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput.extend({ clientId: z.string().uuid() }))
  .handler(({ data, context }) =>
    callRpc(context.supabase, "confirm_performance_goal_link", {
      _row_id: data.rowId,
      _client_id: data.clientId,
    }),
  );

// ---------------------------- Representante ----------------------------------

type RepResult = { available: false } | { available: true; view: RepGoalsView };

async function repCall(
  userId: string,
  fn: string,
  args: Record<string, unknown>,
): Promise<RepResult> {
  const { repForUser } = await import("@/lib/rep-portal.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rep = await repForUser(userId);
  const res = await callRpc(supabaseAdmin, fn, { ...args, _representative_id: rep.id });
  return res.available ? { available: true, view: repView(res.state) } : res;
}

export const repGetMetasGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput)
  .handler(({ data, context }) =>
    repCall(context.userId, "rep_get_performance_goals", { _row_id: data.rowId }),
  );

export const repSaveMetasSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    rowInput.extend({
      sugestoes: z.array(z.object({ familia, valor: money, justificativa: text })).max(7),
    }),
  )
  .handler(({ data, context }) =>
    repCall(context.userId, "rep_save_goal_suggestions", {
      _row_id: data.rowId,
      _user_id: context.userId,
      _sugestoes: data.sugestoes,
    }),
  );
