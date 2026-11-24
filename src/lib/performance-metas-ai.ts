// Performance → METAS: recomendação de meta mensal por IA (lógica pura, sem rede).
//
// Uma análise do cliente inteiro → uma meta mensal para cada uma das 7 famílias, com
// participação no total sugerido, justificativa, origem (Imersão / Tendência / Dados limitados)
// e confiança. Evidência: imersões (entrevistas, formulários de visita e do representante,
// relatórios) → histórico financeiro em R$ → comparáveis (região/categoria) → perfil.
// Só valores financeiros em R$ do backend; pontos de farol não entram no contexto.
// O contexto vem de `performance_goal_ai_context` (só admin/gestor); a chamada ao modelo e o
// registro ficam em `performance-metas.functions.ts`.

import { CANONICAL_FAMILIES, type CanonicalFamily } from "./client-bi-familias";
import type { AiConfianca, AiSuggestionTag } from "./performance-metas";
import type { AiBase } from "./performance-metas-persistence";
import { getPerformancePortfolioTarget } from "./performance-portfolio-targets";

type NumMap = Record<string, number | string | null> | null | undefined;
type Registro = { data?: string | null } & Record<string, unknown>;

export type AiContext = {
  cliente: {
    razao_social: string | null;
    categoria: string | null;
    periodo: string | null;
    meta_upload_rs?: NumMap;
    realizado_rs?: NumMap;
    media_historica_rs?: NumMap;
  };
  perfil?: {
    categoria: string | null;
    cidade: string | null;
    estado: string | null;
    regiao: string | null;
    grupo: string | null;
  } | null;
  historico?: Array<{
    periodo?: string | null;
    realizado_rs?: NumMap;
    media_historica_rs?: NumMap;
    meta_upload_rs?: NumMap;
  }>;
  imersao?: {
    entrevistas?: Registro[];
    visitas?: Registro[];
    representante?: Registro[];
    imersoes?: Registro[];
    relatorios?: Registro[];
  };
  comparaveis?: {
    clientes: number;
    escopo?: "regiao" | "empresa";
    regiao: string | null;
    categoria: string | null;
    insuficiente?: boolean;
    realizado_medio_rs?: NumMap;
    media_historica_media_rs?: NumMap;
  };
};

export type AiSuggestionRecord = {
  familia: CanonicalFamily;
  valor: number;
  participacao: number;
  justificativa: string;
  tag: AiSuggestionTag;
  confianca: AiConfianca;
  base: AiBase;
};

/** Modelo econômico do gateway de IA do projeto (Lovable AI). */
export const AI_MODEL = "google/gemini-2.5-flash";

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const pos = (v: unknown) => {
  const n = num(v);
  return n != null && n > 0 ? n : null;
};
const roundTo50 = (v: number) => Math.round(v / 50) * 50;

/** Meta padrão (R$/mês) por família para a categoria do cliente. */
export function referenciasDaCategoria(categoria: unknown) {
  return Object.fromEntries(
    CANONICAL_FAMILIES.map((f) => [f, getPerformancePortfolioTarget(categoria, f)]),
  ) as Record<CanonicalFamily, number | null>;
}

type Referencias = Record<CanonicalFamily, number | null>;

type PerfFamilia = {
  realizado_rs: number | null;
  media_historica_rs: number | null;
  meta_upload_rs: number | null;
  meta_padrao_categoria_rs: number | null;
  comparaveis_realizado_medio_rs: number | null;
};

/** Performance financeira (R$) por família, como vai para o modelo. */
export function performancePorFamilia(ctx: AiContext, refs: Referencias) {
  const comp = ctx.comparaveis && !ctx.comparaveis.insuficiente ? ctx.comparaveis : null;
  return Object.fromEntries(
    CANONICAL_FAMILIES.map((f) => [
      f,
      {
        realizado_rs: num(ctx.cliente.realizado_rs?.[f]),
        media_historica_rs: num(ctx.cliente.media_historica_rs?.[f]),
        meta_upload_rs: num(ctx.cliente.meta_upload_rs?.[f]),
        meta_padrao_categoria_rs: refs[f],
        comparaveis_realizado_medio_rs: comp ? num(comp.realizado_medio_rs?.[f]) : null,
      },
    ]),
  ) as Record<CanonicalFamily, PerfFamilia>;
}

function registrosImersao(ctx: AiContext) {
  const im = ctx.imersao ?? {};
  const entrevistas = im.entrevistas?.length ?? 0;
  const formularios = (im.visitas?.length ?? 0) + (im.representante?.length ?? 0);
  const relatorios = (im.relatorios?.length ?? 0) + (im.imersoes?.length ?? 0);
  const datas = Object.values(im)
    .flatMap((l) => l ?? [])
    .map((x) => x.data ?? null)
    .filter((d): d is string => !!d)
    .sort();
  return { entrevistas, formularios, relatorios, ultima: datas[datas.length - 1] ?? null };
}

/** Fontes de fato presentes no contexto enviado ao modelo (gravadas com a análise). */
export function aiBaseFromContext(ctx: AiContext): AiBase {
  const im = registrosImersao(ctx);
  const temImersao = im.entrevistas + im.formularios + im.relatorios > 0;
  const periodos = ctx.historico?.length ?? 0;
  const comp = ctx.comparaveis;
  const temComp = !!comp && !comp.insuficiente && comp.clientes >= 3;
  const temUpload = [
    ctx.cliente.realizado_rs,
    ctx.cliente.media_historica_rs,
    ctx.cliente.meta_upload_rs,
  ].some((m) => m && Object.values(m).some((v) => num(v) != null));
  const categoria = ctx.perfil?.categoria ?? ctx.cliente.categoria ?? null;

  const fontes: NonNullable<AiBase["fontes"]> = [];
  if (temImersao) fontes.push("imersao");
  if (periodos > 0) fontes.push("historico");
  if (temUpload) fontes.push("upload");
  if (temComp) fontes.push("comparaveis");
  if (categoria) fontes.push("perfil");

  const base: AiBase = { fontes };
  if (temImersao) base.imersao = im;
  if (periodos > 0) base.historico = { periodos };
  if (temComp)
    base.comparaveis = {
      clientes: comp.clientes,
      regiao: comp.escopo === "empresa" ? null : comp.regiao,
      categoria: comp.categoria,
    };
  base.perfil = {
    categoria,
    cidade: ctx.perfil?.cidade ?? null,
    estado: ctx.perfil?.estado ?? null,
  };
  return base;
}

/** Ferramenta (saída estruturada) que o modelo é obrigado a chamar. */
export const AI_TOOL = {
  type: "function",
  function: {
    name: "registrar_analise",
    description: "Registra a recomendação de meta mensal das 7 famílias do cliente.",
    parameters: {
      type: "object",
      properties: {
        resumo: {
          type: "string",
          description: "Leitura comercial do cliente em até 2 frases, com a evidência principal.",
        },
        familias: {
          type: "array",
          items: {
            type: "object",
            properties: {
              familia: { type: "string", enum: [...CANONICAL_FAMILIES] },
              valor_mensal: { type: "number", description: "Meta mensal sugerida em R$." },
              origem: { type: "string", enum: ["imersao", "tendencia", "limitado"] },
              confianca: { type: "string", enum: ["alta", "media", "baixa"] },
              justificativa: { type: "string", description: "Até 200 caracteres, com evidência." },
            },
            required: ["familia", "valor_mensal", "origem", "confianca", "justificativa"],
          },
        },
      },
      required: ["resumo", "familias"],
    },
  },
} as const;

export function buildAiPrompt(ctx: AiContext, refs: Referencias) {
  const system = [
    "Você é analista comercial sênior de uma indústria de iluminação. Analise o cliente como um todo",
    "e recomende uma META MENSAL individualizada (R$) para cada uma das 7 famílias:",
    CANONICAL_FAMILIES.join(", ") + ".",
    "",
    "EVIDÊNCIA, EM ORDEM DE PRIORIDADE:",
    "1. Imersões do cliente (entrevistas, formulários da visita e do representante, relatórios):",
    "   oportunidades, estoque, concorrência, negociações, dificuldades comerciais e perspectivas",
    "   de crescimento — sempre cruzadas com a performance financeira da família.",
    "2. Sem imersão relevante para a família: histórico financeiro do cliente e comparáveis",
    "   (mesma categoria; preferência pela mesma região).",
    "3. Perfil do cliente (categoria, cidade/UF, região).",
    "",
    "ORIGEM (por família):",
    "- imersao: há evidência concreta da imersão sobre esta família ou sobre o cliente que a afete.",
    "- tendencia: sem imersão relevante; baseada em histórico em R$ e/ou comparáveis.",
    "- limitado: dados insuficientes; recomende de forma conservadora (próxima ao realizado, à",
    "  média ou à meta padrão) e use confiança baixa.",
    "CONFIANÇA: alta = evidência direta e consistente; media = evidência parcial; baixa = pouca.",
    "",
    "REGRAS:",
    "- Valores financeiros: use somente os campos em R$ fornecidos (realizado, média histórica,",
    "  meta do upload, meta padrão da categoria, médias dos comparáveis). Não há pontos de farol.",
    "- Pode aumentar ou reduzir qualquer família e o total do cliente; não compense diferenças.",
    "- Valor em R$/mês, múltiplo de 50, nunca negativo.",
    "- Justificativa comercial, objetiva, até 200 caracteres, citando a evidência concreta",
    "  (ex.: 'Visita 12/10: obra de 40 aptos em 2027; realizado R$ 800 vs meta R$ 1.000').",
    "- Proibido texto genérico ('potencial de crescimento', 'manter acompanhamento') sem fato.",
    "- Não invente fatos, números, obras, concorrentes ou datas.",
    "- Responda chamando a ferramenta registrar_analise com as 7 famílias.",
  ].join("\n");
  const user = JSON.stringify({
    cliente: ctx.cliente.razao_social,
    periodo_atual: ctx.cliente.periodo,
    perfil: ctx.perfil,
    performance_rs_por_familia: performancePorFamilia(ctx, refs),
    historico_rs: ctx.historico ?? [],
    imersao: ctx.imersao ?? {},
    comparaveis: ctx.comparaveis ?? null,
  });
  return { system, user };
}

/** Lê os argumentos da ferramenta (ou JSON solto no conteúdo, como reserva). */
export function extractAnalysis(message: {
  content?: string | null;
  tool_calls?: Array<{ function?: { arguments?: string } }>;
}): unknown {
  const candidates = [
    message.tool_calls?.[0]?.function?.arguments,
    message.content ?? undefined,
  ].filter((x): x is string => !!x);
  for (const raw of candidates) {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const text = fenced ? fenced[1] : raw;
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

const CONFIANCAS: readonly AiConfianca[] = ["alta", "media", "baixa"];
const ORIGENS: readonly AiSuggestionTag[] = ["imersao", "tendencia", "limitado"];

/**
 * Valida a análise e devolve as 7 famílias:
 * - "imersao" só se houver registro de imersão; sem dado financeiro da família nem comparável,
 *   vira "limitado" (confiança baixa, valor conservador);
 * - valor ≥ 0, múltiplo de 50, teto de 3× a maior referência em R$ (1,1× se limitado);
 * - família ausente/ inválida → recomendação conservadora marcada como "limitado";
 * - participação = valor ÷ total sugerido.
 */
export function validateAnalysis(
  parsed: unknown,
  ctx: AiContext,
  refs: Referencias,
): { resumo: string; sugestoes: AiSuggestionRecord[] } {
  const json = (parsed ?? {}) as { resumo?: unknown; familias?: unknown };
  const list = Array.isArray(json.familias)
    ? (json.familias as Array<Record<string, unknown>>)
    : [];
  const resumo = String(json.resumo ?? "")
    .trim()
    .slice(0, 400);
  const base: AiBase = { ...aiBaseFromContext(ctx), ...(resumo && { resumo }) };
  const temImersao = (base.fontes ?? []).includes("imersao");
  const perf = performancePorFamilia(ctx, refs);
  const porFamilia = new Map<CanonicalFamily, Record<string, unknown>>();
  for (const item of list) {
    const f = String(item?.familia ?? "")
      .trim()
      .toUpperCase() as CanonicalFamily;
    if ((CANONICAL_FAMILIES as readonly string[]).includes(f) && !porFamilia.has(f))
      porFamilia.set(f, item);
  }

  const parcial: Array<Omit<AiSuggestionRecord, "participacao">> = [];
  for (const f of CANONICAL_FAMILIES) {
    const p = perf[f];
    const financeiro =
      pos(p.realizado_rs) ?? pos(p.media_historica_rs) ?? pos(p.meta_upload_rs) ?? null;
    const comparavel = pos(p.comparaveis_realizado_medio_rs);
    const conhecidos = [financeiro, comparavel, pos(p.meta_padrao_categoria_rs)].filter(
      (v): v is number => v != null,
    );
    const maxRef = conhecidos.length ? Math.max(...conhecidos) : null;
    const conservador = financeiro ?? pos(p.meta_padrao_categoria_rs) ?? comparavel;

    const item = porFamilia.get(f);
    let tag = ORIGENS.includes(item?.origem as AiSuggestionTag)
      ? (item?.origem as AiSuggestionTag)
      : "limitado";
    let confianca = CONFIANCAS.includes(item?.confianca as AiConfianca)
      ? (item?.confianca as AiConfianca)
      : "media";
    let valor = num(item?.valor_mensal);
    let justificativa = String(item?.justificativa ?? "")
      .trim()
      .slice(0, 280);

    if (tag === "imersao" && !temImersao) tag = "tendencia";
    if (tag !== "imersao" && financeiro == null && comparavel == null) tag = "limitado";
    if (tag === "limitado") confianca = "baixa";

    const invalido = !item || valor == null || valor < 0 || !justificativa || maxRef == null;
    if (invalido) {
      if (conservador == null) continue; // sem nenhuma referência: não há o que sugerir
      tag = "limitado";
      confianca = "baixa";
      valor = conservador;
      justificativa =
        financeiro != null
          ? `Dados limitados: mantida a base financeira atual (R$ ${Math.round(financeiro)}).`
          : "Dados limitados: sem histórico da família; mantida a meta padrão da categoria.";
    }
    const teto = (maxRef ?? conservador ?? 0) * (tag === "limitado" ? 1.1 : 3);
    parcial.push({
      familia: f,
      valor: roundTo50(Math.min(valor as number, teto)),
      justificativa,
      tag,
      confianca,
      base,
    });
  }
  const total = parcial.reduce((s, x) => s + x.valor, 0);
  return {
    resumo,
    sugestoes: parcial.map((x) => ({
      ...x,
      participacao: total > 0 ? Math.round((x.valor / total) * 10000) / 10000 : 0,
    })),
  };
}
