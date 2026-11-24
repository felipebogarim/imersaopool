// Performance → METAS: server functions de leitura/gravação (tabelas performance_goal_*).
//
// Gestão (admin/gestor): RPCs com o cliente RLS do usuário; o banco confere papel e empresa.
// Representante (usuário externo): service role + `repForUser`, sempre limitado à carteira
// dele, recebendo só meta oficial, as próprias sugestões e o atingimento já calculado.
// Sugestão IA: contexto do banco (só gestão) → modelo → registro com a base da recomendação.
// Convite: cria o acesso do representante (primeiro acesso com definição de senha) e envia
// o e-mail com o link das metas do cliente.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CANONICAL_FAMILIES } from "@/lib/client-bi-familias";
import {
  AI_MODEL,
  AI_TOOL,
  buildAiPrompt,
  extractAnalysis,
  referenciasDaCategoria,
  validateAnalysis,
  type AiContext,
} from "@/lib/performance-metas-ai";
import {
  repView,
  type GoalReview,
  type GoalsState,
  type MetasLoadResult,
  type RepGoalsView,
} from "@/lib/performance-metas-persistence";
import type { MetasBiBackendRow } from "@/lib/performance-metas-bi";

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

type ReviewResult = { available: false } | { available: true; review: GoalReview | null };

async function reviewRpc(
  client: unknown,
  fn: string,
  args: Record<string, unknown>,
): Promise<ReviewResult> {
  const { data, error } = await (client as RpcClient).rpc(fn, args);
  if (error) {
    if (NOT_MIGRATED.has(error.code ?? "")) return { available: false };
    throw new Error(error.message);
  }
  return { available: true, review: data as GoalReview | null };
}

// ------------------------------- Gestão --------------------------------------

export const getMetasGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput)
  .handler(({ data, context }) =>
    callRpc(context.supabase, "get_performance_goals", { _row_id: data.rowId }),
  );

/** BI Metas: metas vigentes + base em R$ de várias linhas (somente gestão). */
export const getMetasBi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ rowIds: z.array(z.string().uuid()).max(10000) }))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ available: false } | { available: true; rows: MetasBiBackendRow[] }> => {
      if (data.rowIds.length === 0) return { available: true, rows: [] };
      const { data: rows, error } = await (context.supabase as unknown as RpcClient).rpc(
        "get_performance_goals_bi",
        { _row_ids: data.rowIds },
      );
      if (error) {
        if (NOT_MIGRATED.has(error.code ?? "")) return { available: false };
        throw new Error(error.message);
      }
      return { available: true, rows: (rows ?? []) as MetasBiBackendRow[] };
    },
  );

export const getMetasReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput)
  .handler(({ data, context }) =>
    reviewRpc(context.supabase, "performance_goal_review_state", { _row_id: data.rowId }),
  );

export const reopenMetasReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput)
  .handler(({ data, context }) =>
    reviewRpc(context.supabase, "reopen_performance_goal_review", { _row_id: data.rowId }),
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
      /** Competência a partir da qual as metas valem (YYYY-MM-01); padrão: mês corrente. */
      vigenteDesde: z
        .string()
        .regex(/^\d{4}-\d{2}-01$/)
        .optional(),
    }),
  )
  .handler(({ data, context }) =>
    callRpc(context.supabase, "save_performance_goals", {
      _row_id: data.rowId,
      _metas: data.metas,
      _sugestoes_ia: [], // sugestões da IA são registradas ao serem geradas
      _vigente_desde: data.vigenteDesde ?? null,
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

/**
 * Sugestão IA: UMA análise do cliente (7 famílias) com saída estruturada, validada no servidor
 * e gravada com origem, confiança, participação e base. Nunca altera a meta oficial.
 */
export const generateMetasAiSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput)
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("IA indisponível neste ambiente (LOVABLE_API_KEY ausente).");
    const client = context.supabase as unknown as RpcClient;
    const { data: raw, error } = await client.rpc("performance_goal_ai_context", {
      _row_id: data.rowId,
    });
    if (error) {
      if (NOT_MIGRATED.has(error.code ?? ""))
        throw new Error(
          "Banco desatualizado: aplique a migration da sugestão IA (20261125120000).",
        );
      throw new Error(error.message);
    }
    const ctx = raw as AiContext;
    const refs = referenciasDaCategoria(ctx.perfil?.categoria ?? ctx.cliente.categoria);
    const { system, user } = buildAiPrompt(ctx, refs);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [AI_TOOL],
        tool_choice: { type: "function", function: { name: AI_TOOL.function.name } },
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Limite de requisições da IA. Tente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
      throw new Error(`Falha na IA (${res.status}).`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: Parameters<typeof extractAnalysis>[0] }>;
    };
    const parsed = extractAnalysis(json.choices?.[0]?.message ?? {});
    if (!parsed) throw new Error("A IA não retornou uma análise válida. Tente novamente.");
    const { sugestoes } = validateAnalysis(parsed, ctx, refs);
    if (sugestoes.length === 0)
      throw new Error("Sem dados para recomendar metas deste cliente (categoria sem referência).");
    return callRpc(client, "record_performance_goal_ai_suggestions", {
      _row_id: data.rowId,
      _sugestoes: sugestoes,
      _modelo: AI_MODEL,
    });
  });

/** Convida o representante da linha para revisar as metas do cliente (e-mail real). */
export const inviteRepToMetas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput.extend({ mensagem: z.string().trim().min(1).max(2000) }))
  .handler(async ({ data, context }) => {
    // Mesma checagem de gestão das metas: admin/gestor da empresa ativa da linha.
    const check = await callRpc(context.supabase, "get_performance_goals", { _row_id: data.rowId });
    if (!check.available) throw new Error("Persistência das metas indisponível.");
    // O representante revisa sobre metas oficiais já gravadas (e o cliente aparece no portal).
    if (!check.state.cycle)
      throw new Error("Salve as metas do cliente antes de convidar o representante.");
    const workflow = await reviewRpc(context.supabase, "performance_goal_review_state", {
      _row_id: data.rowId,
    });
    if (!workflow.available)
      throw new Error("Aplique a migration 20261125150000 antes de enviar novos convites.");
    const { inviteRepToMetasRow } = await import("@/lib/rep-portal.server");
    const sent = await inviteRepToMetasRow(data.rowId, data.mensagem);
    const review = await reviewRpc(context.supabase, "start_performance_goal_review", {
      _row_id: data.rowId,
    });
    if (!review.available)
      throw new Error(
        "Convite enviado, mas o fluxo de revisão ainda não está disponível no banco. Aplique a migration 20261125150000.",
      );
    return sent;
  });

// ---------------------------- Representante ----------------------------------

type AdminFrom = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => PromiseLike<{ data: { razao_social?: string } | null }>;
      };
    };
  };
};

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
  if (!res.available) return res;
  // A RPC já confirmou que a linha é da carteira deste representante.
  const { data: row } = await (supabaseAdmin as unknown as AdminFrom)
    .from("rep_performance_rows")
    .select("razao_social, categoria")
    .eq("id", String(args._row_id))
    .maybeSingle();
  const baseView = repView(res.state);
  const { reviewForCycle } = await import("@/lib/rep-portal.server");
  const review = await reviewForCycle(baseView.cycle?.id ?? null);
  return {
    available: true,
    view: { ...baseView, review, cliente: String(row?.razao_social ?? "").trim() },
  };
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

export const repRequestMetasReopen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput.extend({ justificativa: z.string().trim().min(3).max(1000) }))
  .handler(async ({ data, context }) => {
    const { repForUser } = await import("@/lib/rep-portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rep = await repForUser(context.userId);
    const result = await reviewRpc(supabaseAdmin, "rep_request_goal_review_reopen", {
      _row_id: data.rowId,
      _representative_id: rep.id,
      _note: data.justificativa,
    });
    if (!result.available)
      throw new Error("Fluxo de reabertura indisponível. Aplique a migration 20261125150000.");
    return result;
  });

/** Clientes da carteira do representante com metas em ciclo (para o portal). */
export const repListMetas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { repForUser, listRepMetasRows } = await import("@/lib/rep-portal.server");
    const rep = await repForUser(context.userId);
    return listRepMetasRows(rep.id);
  });
