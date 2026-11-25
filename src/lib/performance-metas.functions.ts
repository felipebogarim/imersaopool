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
import { PISO_CATEGORIA_FAMILIA } from "@/lib/performance-metas-minimos";
import { CANONICAL_FAMILIES } from "@/lib/client-bi-familias";
import {
  AI_MODEL,
  AI_TOOL,
  buildAiPrompt,
  extractAnalysis,
  hasNewInputsForAi,
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
import type { MetasBiBackendRow, RepMetasBiBackendFact } from "@/lib/performance-metas-bi";
import { aiFillForMissing, bulkRowStatus, type BulkRowStatus } from "@/lib/performance-metas-bulk";

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
  .inputValidator(rowInput.extend({ meses: z.literal(6) }))
  .handler(({ data, context }) =>
    callRpc(context.supabase, "renew_performance_goal_cycle", {
      _row_id: data.rowId,
      _meses: data.meses,
    }),
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
/** Gera (ou reaproveita, sem novos inputs) a análise IA dos 7 portfólios de uma linha. */
async function runAiAnalysis(client: RpcClient, data: { rowId: string; force?: boolean }) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("IA indisponível neste ambiente (LOVABLE_API_KEY ausente).");

  const { data: raw, error } = await client.rpc("performance_goal_ai_context", {
    _row_id: data.rowId,
  });
  if (error) {
    if (NOT_MIGRATED.has(error.code ?? ""))
      throw new Error("Banco desatualizado: aplique a migration da sugestão IA (20261125120000).");
    throw new Error(error.message);
  }
  const ctx = raw as AiContext;

  // Consulta se já há sugestão anterior registrada
  const currentGoals = await callRpc(client, "get_performance_goals", { _row_id: data.rowId });
  const aiSug = currentGoals.available
    ? currentGoals.state.ai_suggestions.filter((s) => s.origem === "modelo")
    : [];
  const lastGeneratedAt = aiSug[0]?.created_at;

  // Se já foi gerada e não foi pedido reavaliação forçada: consulta se houve novos inputs
  if (currentGoals.available && lastGeneratedAt && !data.force) {
    const repSugs = currentGoals.state.rep_suggestions;
    const check = hasNewInputsForAi(ctx, repSugs, lastGeneratedAt);
    if (!check.hasNewInputs) {
      return {
        available: true as const,
        state: currentGoals.state,
        hasNewInputs: false,
        lastGeneratedAt,
        motivo: check.motivo,
      };
    }
  }

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
  const saveRes = await callRpc(client, "record_performance_goal_ai_suggestions", {
    _row_id: data.rowId,
    _sugestoes: sugestoes,
    _modelo: AI_MODEL,
  });
  return {
    ...saveRes,
    hasNewInputs: true,
    lastGeneratedAt: new Date().toISOString(),
  };
}

export const generateMetasAiSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ rowId: z.string().uuid(), force: z.boolean().optional() }))
  .handler(({ data, context }) => runAiAnalysis(context.supabase as unknown as RpcClient, data));

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

// --------------------------- Convite em massa --------------------------------

const rowIdsInput = z.object({ rowIds: z.array(z.string().uuid()).min(1).max(5000) });

/** Executa `fn` em lotes para não abrir centenas de requisições simultâneas. */
async function inBatches<T, R>(items: readonly T[], size: number, fn: (t: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

/**
 * Retorna os IDs dos clientes classificados no Top 10 por representante.
 * Usa o faturamento real via `rep_goal_revenue_ranks` e complementa pela `ordem` da planilha
 * caso faltem dados de faturamento.
 */
export const getMetasTop10RowIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowIdsInput)
  .handler(async ({ data }): Promise<{ top10RowIds: string[] }> => {
    if (!data.rowIds.length) return { top10RowIds: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const rows: Array<{
      id: string;
      ordem: number | null;
      rep_performance_uploads: { representative_id: string } | null;
    }> = [];

    for (let i = 0; i < data.rowIds.length; i += 200) {
      const chunk = data.rowIds.slice(i, i + 200);
      const { data: part, error } = await admin
        .from("rep_performance_rows")
        .select("id, ordem, rep_performance_uploads!inner(representative_id)")
        .in("id", chunk);
      if (error) {
        throw new Error(error.message ?? "Falha ao consultar linhas de performance.");
      }
      if (part) rows.push(...(part as any));
    }

    // Agrupa por representante
    const byRep = new Map<string, Array<{ id: string; ordem: number }>>();
    for (const r of rows) {
      const repId = r.rep_performance_uploads?.representative_id;
      if (!repId) continue;
      const list = byRep.get(repId) ?? [];
      list.push({ id: r.id, ordem: r.ordem ?? 0 });
      byRep.set(repId, list);
    }

    const top10RowIds: string[] = [];

    for (const [repId, repRows] of byRep) {
      const repRowIds = repRows.map((r) => r.id);
      const limit = Math.min(10, repRows.length);
      const repTop10: string[] = [];

      try {
        const { data: ranks } = await admin.rpc("rep_goal_revenue_ranks", {
          _representative_id: repId,
          _row_ids: repRowIds,
        });

        if (ranks && Array.isArray(ranks)) {
          const sortedRanks = [...ranks].sort((a, b) => (a.top10_rank ?? 0) - (b.top10_rank ?? 0));
          for (const r of sortedRanks) {
            if (repTop10.length < limit && !repTop10.includes(r.row_id)) {
              repTop10.push(r.row_id);
            }
          }
        }
      } catch {
        // Fallback gracioso para a ordem da planilha
      }

      // Se a RPC não encontrou receita suficiente ou não retornou 10,
      // complementa com as linhas de menor `ordem` (que na planilha vêm do topo)
      if (repTop10.length < limit) {
        const sortedByOrdem = [...repRows].sort((a, b) => a.ordem - b.ordem);
        for (const r of sortedByOrdem) {
          if (repTop10.length >= limit) break;
          if (!repTop10.includes(r.id)) {
            repTop10.push(r.id);
          }
        }
      }

      top10RowIds.push(...repTop10);
    }

    return { top10RowIds };
  });

/** Situação das metas de cada cliente (o gestor já gravou os 7 portfólios?). */
export const getMetasBulkStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowIdsInput)
  .handler(
    async ({ data, context }): Promise<BulkRowStatus[]> =>
      inBatches(data.rowIds, 8, async (rowId) => {
        try {
          const res = await callRpc(context.supabase, "get_performance_goals", { _row_id: rowId });
          if (!res.available) throw new Error("Persistência das metas indisponível.");
          return bulkRowStatus(rowId, res.state);
        } catch (e) {
          return {
            ...bulkRowStatus(rowId, null),
            erro: e instanceof Error ? e.message : "Falha ao consultar.",
          };
        }
      }),
  );

/**
 * Completa as metas que faltam com a sugestão IA (gera a análise se ainda não houver).
 * Só grava portfólios sem meta do gestor; o que ele já revisou não é alterado.
 */
export const completeMetasWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput)
  .handler(async ({ data, context }): Promise<BulkRowStatus> => {
    const client = context.supabase as unknown as RpcClient;
    let res = await callRpc(client, "get_performance_goals", { _row_id: data.rowId });
    if (!res.available) throw new Error("Persistência das metas indisponível.");
    const status = bulkRowStatus(data.rowId, res.state);
    if (status.faltandoComIa.length < status.faltando.length) {
      const gen = await runAiAnalysis(client, { rowId: data.rowId });
      if (!gen.available) throw new Error("Persistência das metas indisponível.");
      res = gen;
    }
    const metas = aiFillForMissing(res.state);
    if (metas.length > 0) {
      res = await callRpc(client, "save_performance_goals", {
        _row_id: data.rowId,
        _metas: metas,
        _sugestoes_ia: [],
        _vigente_desde: null,
      });
      if (!res.available) throw new Error("Persistência das metas indisponível.");
    }
    return bulkRowStatus(data.rowId, res.state);
  });

/**
 * Convite em massa: um único e-mail ao representante com todos os clientes enviados. Cada
 * cliente precisa ter metas gravadas (ciclo) e pertencer ao mesmo representante.
 */
export const inviteRepToMetasBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowIdsInput.extend({ mensagem: z.string().trim().min(1).max(2000) }))
  .handler(async ({ data, context }) => {
    // Mesma checagem do convite individual, cliente a cliente (gestão da empresa da linha).
    const checks = await inBatches(data.rowIds, 8, async (rowId) => {
      const res = await callRpc(context.supabase, "get_performance_goals", { _row_id: rowId });
      if (!res.available) throw new Error("Persistência das metas indisponível.");
      return { rowId, temCiclo: res.state.cycle != null };
    });
    const semMeta = checks.filter((c) => !c.temCiclo);
    if (semMeta.length > 0)
      throw new Error(
        `${semMeta.length} cliente(s) ainda sem metas salvas; revise antes de enviar.`,
      );
    const workflow = await reviewRpc(context.supabase, "performance_goal_review_state", {
      _row_id: data.rowIds[0],
    });
    if (!workflow.available)
      throw new Error("Aplique a migration 20261125150000 antes de enviar novos convites.");

    const { inviteRepToMetasRows } = await import("@/lib/rep-portal.server");
    const sent = await inviteRepToMetasRows(data.rowIds, data.mensagem);
    const falhas: string[] = [];
    await inBatches(data.rowIds, 8, async (rowId) => {
      try {
        await reviewRpc(context.supabase, "start_performance_goal_review", { _row_id: rowId });
      } catch {
        falhas.push(rowId);
      }
    });
    return { ...sent, revisaoNaoIniciada: falhas.length };
  });

// ---------------------------- Representante ----------------------------------

type RepResult = { available: false } | { available: true; view: RepGoalsView };

async function repCall(
  userId: string,
  fn: string,
  args: Record<string, unknown>,
): Promise<RepResult> {
  const { repForUser, loadRepMetasDetailExtras, reviewForCycle } =
    await import("@/lib/rep-portal.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rep = await repForUser(userId);
  const res = await callRpc(supabaseAdmin, fn, { ...args, _representative_id: rep.id });
  if (!res.available) return res;
  const cycleId = res.state.cycle?.id ?? null;
  const [review, extras] = await Promise.all([
    reviewForCycle(cycleId),
    loadRepMetasDetailExtras(rep.id, String(args._row_id), cycleId),
  ]);
  const baseView = repView(res.state, extras.categoria, extras.familia_pct);
  return {
    available: true,
    view: { ...baseView, review, ...extras },
  };
}

export const repGetMetasGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput)
  .handler(({ data, context }) =>
    repCall(context.userId, "rep_get_performance_goals", { _row_id: data.rowId }),
  );

/** BI da própria carteira, já sanitizada no servidor (sem padrão, IA ou base financeira bruta). */
export const repGetMetasBi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      facts: RepMetasBiBackendFact[];
      totalClientes: number;
    }> => {
      const { repForUser, loadRepMetasBi } = await import("@/lib/rep-portal.server");
      const rep = await repForUser(context.userId);
      return loadRepMetasBi(rep);
    },
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

// ------------------------- Flag "Em investigação" ----------------------------

export type InvestigacaoResult =
  | { available: false }
  | { available: true; emInvestigacao: boolean };

async function investigacaoRpc(
  client: unknown,
  fn: string,
  args: Record<string, unknown>,
): Promise<InvestigacaoResult> {
  const { data, error } = await (client as RpcClient).rpc(fn, args);
  if (error) {
    if (NOT_MIGRATED.has(error.code ?? "")) return { available: false };
    throw new Error(error.message);
  }
  const d = (data ?? {}) as { em_investigacao?: boolean };
  return { available: true, emInvestigacao: d.em_investigacao === true };
}

export const getMetasInvestigacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput)
  .handler(({ data, context }) =>
    investigacaoRpc(context.supabase, "get_performance_goal_investigation", {
      _row_id: data.rowId,
    }),
  );

export const setMetasInvestigacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rowInput.extend({ ativo: z.boolean() }))
  .handler(({ data, context }) =>
    investigacaoRpc(context.supabase, "set_performance_goal_investigation", {
      _row_id: data.rowId,
      _ativo: data.ativo,
    }),
  );

// ------------------------- Mínimos por categoria -----------------------------

export type MinimosResult =
  | { available: false }
  | { available: true; itens: Array<{ categoria: string; familia: string; minimo: number }> };

async function minimosRpc(
  client: unknown,
  fn: string,
  args: Record<string, unknown>,
): Promise<MinimosResult> {
  const { data, error } = await (client as RpcClient).rpc(fn, args);
  if (error) {
    if (NOT_MIGRATED.has(error.code ?? "")) return { available: false };
    throw new Error(error.message);
  }
  const itens = ((data ?? []) as Array<{ categoria: string; familia: string; minimo: unknown }>)
    .map((i) => ({ categoria: i.categoria, familia: i.familia, minimo: Number(i.minimo) }))
    .filter((i) => Number.isFinite(i.minimo));
  return { available: true, itens };
}

export const getMetasMinimos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => minimosRpc(context.supabase, "get_performance_goal_minimums", {}));

export const saveMetasMinimos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      itens: z
        .array(
          z.object({
            categoria: z.enum(["Silver", "Gold", "Black"]),
            familia: z.union([familia, z.literal(PISO_CATEGORIA_FAMILIA)]),
            minimo: money,
          }),
        )
        .max(60),
    }),
  )
  .handler(({ data, context }) =>
    minimosRpc(context.supabase, "set_performance_goal_minimums", { _itens: data.itens }),
  );
