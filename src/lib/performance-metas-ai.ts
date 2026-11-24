// Performance → METAS: sugestão de meta mensal por IA (lógica pura, sem rede).
//
// Prioridade da evidência: imersão (entrevistas, imersões, relatórios de campo) →
// tendência histórica do cliente → perfil → comparáveis da região (agregados).
// O contexto vem de `performance_goal_ai_context` (só admin/gestor); a chamada ao modelo e o
// registro no banco ficam em `performance-metas.functions.ts`.

import { CANONICAL_FAMILIES, type CanonicalFamily } from "./client-bi-familias";
import type { AiSuggestionTag } from "./performance-metas";
import type { AiBase } from "./performance-metas-persistence";
import { getPerformancePortfolioTarget } from "./performance-portfolio-targets";

type NumMap = Record<string, number | string | null> | null | undefined;

export type AiContext = {
  cliente: {
    razao_social: string | null;
    categoria: string | null;
    periodo: string | null;
    familia_pct?: NumMap;
    metas_upload?: NumMap;
    realizado?: NumMap;
    media?: NumMap;
  };
  perfil?: {
    categoria: string | null;
    cidade: string | null;
    estado: string | null;
    regiao: string | null;
    grupo: string | null;
  } | null;
  historico?: Array<Record<string, unknown>>;
  imersao?: {
    entrevistas?: Array<{ data?: string | null } & Record<string, unknown>>;
    imersoes?: Array<{ data?: string | null } & Record<string, unknown>>;
    relatorios?: Array<{ data?: string | null } & Record<string, unknown>>;
  };
  comparaveis?: {
    clientes: number;
    regiao: string | null;
    categoria: string | null;
    insuficiente?: boolean;
    realizado_medio?: NumMap;
    atingimento_medio?: NumMap;
  };
};

export type AiSuggestionRecord = {
  familia: CanonicalFamily;
  valor: number;
  justificativa: string;
  tag: AiSuggestionTag;
  base: AiBase;
};

export const AI_MODEL = "google/gemini-2.5-pro";

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Meta padrão (R$/mês) por portfólio para a categoria do cliente. */
export function referenciasDaCategoria(categoria: unknown) {
  return Object.fromEntries(
    CANONICAL_FAMILIES.map((f) => [f, getPerformancePortfolioTarget(categoria, f)]),
  ) as Record<CanonicalFamily, number | null>;
}

/** Base da recomendação: quais fontes havia de fato no contexto enviado ao modelo. */
export function aiBaseFromContext(ctx: AiContext): { base: AiBase; tag: AiSuggestionTag } {
  const im = ctx.imersao ?? {};
  const entrevistas = im.entrevistas?.length ?? 0;
  const relatorios = (im.relatorios?.length ?? 0) + (im.imersoes?.length ?? 0);
  const datas = [...(im.entrevistas ?? []), ...(im.imersoes ?? []), ...(im.relatorios ?? [])]
    .map((x) => x.data ?? null)
    .filter((d): d is string => !!d)
    .sort();
  const temImersao = entrevistas + relatorios > 0;
  const periodos = ctx.historico?.length ?? 0;
  const comp = ctx.comparaveis;
  const temComp = !!comp && !comp.insuficiente && comp.clientes >= 3;
  const temUpload = [ctx.cliente.realizado, ctx.cliente.media].some(
    (m) => m && Object.values(m).some((v) => num(v) != null),
  );
  const categoria = ctx.perfil?.categoria ?? ctx.cliente.categoria ?? null;

  const fontes: NonNullable<AiBase["fontes"]> = [];
  if (temImersao) fontes.push("imersao");
  if (periodos > 0) fontes.push("historico");
  if (temUpload) fontes.push("upload");
  if (categoria) fontes.push("perfil");
  if (temComp) fontes.push("comparaveis");

  const base: AiBase = { fontes };
  if (temImersao)
    base.imersao = { entrevistas, relatorios, ultima: datas[datas.length - 1] ?? null };
  if (periodos > 0) base.historico = { periodos };
  if (temComp)
    base.comparaveis = { clientes: comp.clientes, regiao: comp.regiao, categoria: comp.categoria };
  base.perfil = {
    categoria,
    cidade: ctx.perfil?.cidade ?? null,
    estado: ctx.perfil?.estado ?? null,
  };
  return { base, tag: temImersao ? "imersao" : "tendencia" };
}

/** Prompt do modelo. Os valores do contexto já estão em R$ comparáveis à meta mensal. */
export function buildAiPrompt(ctx: AiContext, referencias: Record<CanonicalFamily, number | null>) {
  const { tag } = aiBaseFromContext(ctx);
  const system = [
    "Você é um analista comercial que propõe METAS MENSAIS (R$) por portfólio para um cliente.",
    "Portfólios (use exatamente estes nomes): " + CANONICAL_FAMILIES.join(", ") + ".",
    "PRIORIDADE DA EVIDÊNCIA:",
    "1. Dados de imersão (entrevistas, imersões e relatórios de campo): intenções de compra, obras, mix, concorrência.",
    "2. Sem imersão: tendência histórica do cliente (realizado, média e atingimento por período).",
    "3. Perfil do cliente (categoria, cidade/UF, região).",
    "4. Comparáveis da região (médias agregadas de clientes da mesma categoria).",
    "REGRAS:",
    "- Use somente os dados fornecidos; não invente fatos, clientes ou números.",
    "- A meta padrão da categoria é referência, não obrigação.",
    "- Valores em R$ por mês, arredondados a múltiplos de 50, nunca negativos.",
    "- Justificativa curta (até 280 caracteres), em português, citando a evidência usada (ex.: 'entrevista de 12/10 indica obra...').",
    "- Se não houver evidência para um portfólio, proponha a meta com base na tendência e diga isso.",
    'Responda APENAS com JSON: {"sugestoes":[{"familia":"...","valor":0,"justificativa":"..."}]}',
  ].join("\n");
  const user = JSON.stringify({
    base_principal: tag === "imersao" ? "imersão" : "tendência histórica",
    meta_padrao_categoria: referencias,
    ...ctx,
  });
  return { system, user };
}

const roundTo50 = (v: number) => Math.round(v / 50) * 50;

/** Teto de sanidade por portfólio: 3× o maior valor de referência conhecido. */
function teto(ctx: AiContext, ref: number | null, f: CanonicalFamily): number | null {
  const vals = [
    ref,
    num(ctx.cliente.realizado?.[f]),
    num(ctx.cliente.media?.[f]),
    num(ctx.cliente.metas_upload?.[f]),
    num(ctx.comparaveis?.realizado_medio?.[f]),
  ].filter((v): v is number => v != null && v > 0);
  return vals.length ? Math.max(...vals) * 3 : null;
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Valida a resposta do modelo: só portfólios conhecidos, valor numérico ≥ 0 limitado ao teto
 * de sanidade (portfólio sem nenhuma referência é descartado), justificativa aparada.
 */
export function parseAiSuggestions(
  raw: string,
  ctx: AiContext,
  referencias: Record<CanonicalFamily, number | null>,
): AiSuggestionRecord[] {
  const json = extractJson(raw) as { sugestoes?: unknown } | null;
  const list = Array.isArray(json?.sugestoes) ? json.sugestoes : [];
  const { base, tag } = aiBaseFromContext(ctx);
  const out = new Map<CanonicalFamily, AiSuggestionRecord>();
  for (const item of list as Array<Record<string, unknown>>) {
    const familia = String(item?.familia ?? "")
      .trim()
      .toUpperCase() as CanonicalFamily;
    if (!(CANONICAL_FAMILIES as readonly string[]).includes(familia) || out.has(familia)) continue;
    const valor = num(item.valor);
    const max = teto(ctx, referencias[familia], familia);
    if (valor == null || valor < 0 || max == null) continue;
    const justificativa = String(item.justificativa ?? "")
      .trim()
      .slice(0, 400);
    if (!justificativa) continue;
    out.set(familia, {
      familia,
      valor: roundTo50(Math.min(valor, max)),
      justificativa,
      tag,
      base,
    });
  }
  return CANONICAL_FAMILIES.flatMap((f) => (out.has(f) ? [out.get(f)!] : []));
}
