// ============================================================================
// PERFORMANCE → METAS (simulação local)
//
// Módulo ISOLADO dos cálculos oficiais de Performance. Nada aqui grava no banco,
// altera metas vigentes, faróis ou o motor do BI. Todo valor editado vive apenas
// no estado local da tela e é descartado ao sair.
//
// A "referência padrão" vem da matriz já publicada em
// `performance-portfolio-targets.ts` (somente leitura).
// ============================================================================

import { CANONICAL_FAMILIES, type CanonicalFamily } from "./client-bi-familias";
import {
  getPerformancePortfolioTarget,
  normalizePortfolioCategory,
  type PortfolioCategory,
} from "./performance-portfolio-targets";

export const METAS_FAMILIES: readonly CanonicalFamily[] = CANONICAL_FAMILIES;

/** Rótulos de exibição dos sete portfólios. */
export const METAS_FAMILY_LABEL: Record<CanonicalFamily, string> = {
  "DECOR NEWLINE": "Decor Newline",
  "DECOR STUDIO": "Decor Studio",
  "SISTEMAS E MÓDULOS": "Sistemas e Módulos",
  "PRO LED": "Pro LED",
  "PRO LAMP": "Pro Lamp",
  PERFIL: "Perfil",
  "FITAS E FONTES": "Fitas e Fontes",
};

// ================================ Perfis =====================================

/**
 * Perfil de visualização da tela de Metas.
 * Nesta etapa é derivado no cliente apenas para montar a interface; a regra
 * definitiva de autorização virá do backend (RLS / server functions).
 */
export type MetasViewerRole = "gestor" | "representante";

export type MetasVisibility = {
  /** Vê a meta padrão da categoria e a diferença contra ela. */
  verMetaPadrao: boolean;
  /** Vê valores, justificativa e origem da sugestão interna da IA. */
  verSugestaoIa: boolean;
  /** Edita a meta oficial e vê o comentário do gestor. */
  editarMetaOficial: boolean;
  /** Edita a própria sugestão de representante. */
  editarSugestaoRep: boolean;
  /** Pode acionar Sugestão IA / Restaurar padrão / Convite / Revisar vínculo. */
  usarControlesGestao: boolean;
};

export function metasVisibility(role: MetasViewerRole): MetasVisibility {
  if (role === "gestor") {
    return {
      verMetaPadrao: true,
      verSugestaoIa: true,
      editarMetaOficial: true,
      editarSugestaoRep: false,
      usarControlesGestao: true,
    };
  }
  return {
    verMetaPadrao: false,
    verSugestaoIa: false,
    editarMetaOficial: false,
    editarSugestaoRep: true,
    usarControlesGestao: false,
  };
}

/** Deriva o perfil de tela a partir dos papéis de `user_roles`. */
export function viewerRoleFromRoles(roles: readonly string[]): MetasViewerRole {
  return roles.includes("admin") || roles.includes("gestor") ? "gestor" : "representante";
}

// ============================== Rascunho local ===============================

/** Base da sugestão da IA. */
export type AiSuggestionTag = "imersao" | "tendencia";

export const AI_TAG_LABEL: Record<AiSuggestionTag, string> = {
  imersao: "Imersão",
  tendencia: "Tendência",
};

export type AiSuggestion = {
  valor: number;
  justificativa: string;
  tag: AiSuggestionTag;
  /** Nesta etapa toda sugestão é demonstrativa. */
  simulada: true;
};

/** De onde veio o valor atual da meta oficial. */
export type MetaOrigem = "padrao" | "ia" | "representante" | "gestor";

export const META_ORIGEM_LABEL: Record<MetaOrigem, string> = {
  padrao: "Padrão",
  ia: "IA",
  representante: "Representante",
  gestor: "Gestor",
};

export type FamilyMetaDraft = {
  familia: CanonicalFamily;
  /** Meta padrão da categoria (R$/mês). `null` quando a categoria é desconhecida. */
  referencia: number | null;
  sugestaoIa: AiSuggestion | null;
  sugestaoRep: number | null;
  justificativaRep: string;
  /** Meta mensal oficial definida pelo gestor (R$). */
  metaOficial: number | null;
  comentarioGestor: string;
  origem: MetaOrigem;
};

/** Rascunho inicial: meta oficial parte da referência padrão da categoria. */
export function buildInitialDrafts(categoria: unknown): FamilyMetaDraft[] {
  return METAS_FAMILIES.map((familia) => {
    const referencia = getPerformancePortfolioTarget(categoria, familia);
    return {
      familia,
      referencia,
      sugestaoIa: null,
      sugestaoRep: null,
      justificativaRep: "",
      metaOficial: referencia,
      comentarioGestor: "",
      origem: "padrao",
    };
  });
}

// ------------------------------- Ações ---------------------------------------

/** Padrão FIXO e fictício só para demonstrar a interface (não é recomendação). */
const DEMO_FACTORS = [1.1, 0.95, 1.05, 0.9, 1, 1.15, 0.95];
const DEMO_TAGS: AiSuggestionTag[] = [
  "tendencia",
  "imersao",
  "tendencia",
  "imersao",
  "tendencia",
  "imersao",
  "tendencia",
];

const roundTo50 = (v: number) => Math.round(v / 50) * 50;

/**
 * Sugestão IA DEMONSTRATIVA. Os valores são fictícios (variação fixa sobre a
 * referência) e servem só para visualizar a interface — nenhum modelo é consultado.
 */
export function simulateAiSuggestions(drafts: FamilyMetaDraft[]): FamilyMetaDraft[] {
  return drafts.map((d, i) => ({
    ...d,
    sugestaoIa:
      d.referencia == null
        ? null
        : {
            valor: roundTo50(d.referencia * DEMO_FACTORS[i % DEMO_FACTORS.length]),
            justificativa:
              "Valor fictício de demonstração. A sugestão real da IA será conectada em etapa futura.",
            tag: DEMO_TAGS[i % DEMO_TAGS.length],
            simulada: true,
          },
  }));
}

const mapFamily = (
  drafts: FamilyMetaDraft[],
  familia: CanonicalFamily | null,
  fn: (d: FamilyMetaDraft) => FamilyMetaDraft,
) => drafts.map((d) => (familia == null || d.familia === familia ? fn(d) : d));

/** Volta a meta oficial à referência (um portfólio ou todos). Preserva sugestões. */
export function restoreDefault(
  drafts: FamilyMetaDraft[],
  familia: CanonicalFamily | null = null,
): FamilyMetaDraft[] {
  return mapFamily(drafts, familia, (d) => ({
    ...d,
    metaOficial: d.referencia,
    comentarioGestor: "",
    origem: "padrao",
  }));
}

/** Usa a sugestão da IA como meta oficial (onde houver sugestão). */
export function applyAiSuggestion(
  drafts: FamilyMetaDraft[],
  familia: CanonicalFamily | null = null,
): FamilyMetaDraft[] {
  return mapFamily(drafts, familia, (d) =>
    d.sugestaoIa ? { ...d, metaOficial: d.sugestaoIa.valor, origem: "ia" } : d,
  );
}

/** Copia a sugestão do representante para a meta oficial (onde houver sugestão). */
export function copyRepSuggestion(
  drafts: FamilyMetaDraft[],
  familia: CanonicalFamily | null = null,
): FamilyMetaDraft[] {
  return mapFamily(drafts, familia, (d) =>
    d.sugestaoRep != null ? { ...d, metaOficial: d.sugestaoRep, origem: "representante" } : d,
  );
}

/** Edição manual da meta oficial pelo gestor. */
export function setMetaOficial(
  drafts: FamilyMetaDraft[],
  familia: CanonicalFamily,
  valor: number | null,
): FamilyMetaDraft[] {
  return mapFamily(drafts, familia, (d) => ({ ...d, metaOficial: valor, origem: "gestor" }));
}

// ============================== Entrada numérica =============================

/**
 * Converte o texto digitado em meta mensal (R$). Aceita "1.500,50", "1500.5",
 * "R$ 2.000". Vazio → null. Negativo ou inválido → null.
 */
export function parseMetaInput(input: string): number | null {
  const raw = String(input ?? "")
    .replace(/[R$\s\u00a0]/gi, "")
    .trim();
  if (!raw) return null;
  let s = raw;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

// ================================ Resumo =====================================

export type SimulationStatus = {
  /** Origem única dos sete portfólios, ou "misto". */
  origem: MetaOrigem | "misto";
  contagem: Record<MetaOrigem, number>;
};

export type MetasSummary = {
  /** Soma das metas oficiais nos sete portfólios. */
  total: number;
  /** Soma da referência padrão (null se a categoria não tiver referência). */
  referenciaTotal: number | null;
  diferencaAbs: number | null;
  /** (total − referência) / referência. */
  diferencaPct: number | null;
  /** Participação de cada portfólio no total (soma 1). `null` quando total ≤ 0. */
  composicao: Record<CanonicalFamily, number> | null;
  /** Portfólios com meta oficial positiva. */
  portfoliosComMeta: number;
  status: SimulationStatus;
};

export function simulationStatus(drafts: FamilyMetaDraft[]): SimulationStatus {
  const contagem: Record<MetaOrigem, number> = { padrao: 0, ia: 0, representante: 0, gestor: 0 };
  for (const d of drafts) contagem[d.origem] += 1;
  const usadas = (Object.keys(contagem) as MetaOrigem[]).filter((k) => contagem[k] > 0);
  return { origem: usadas.length === 1 ? usadas[0] : "misto", contagem };
}

export function summarizeDrafts(drafts: FamilyMetaDraft[]): MetasSummary {
  const total = drafts.reduce((s, d) => s + (d.metaOficial ?? 0), 0);
  const refs = drafts.map((d) => d.referencia);
  const referenciaTotal = refs.some((r) => r == null)
    ? null
    : refs.reduce<number>((s, r) => s + (r as number), 0);
  const diferencaAbs = referenciaTotal == null ? null : total - referenciaTotal;
  const diferencaPct =
    referenciaTotal == null || referenciaTotal <= 0
      ? null
      : (total - referenciaTotal) / referenciaTotal;
  const composicao =
    total > 0
      ? (Object.fromEntries(drafts.map((d) => [d.familia, (d.metaOficial ?? 0) / total])) as Record<
          CanonicalFamily,
          number
        >)
      : null;
  return {
    total,
    referenciaTotal,
    diferencaAbs,
    diferencaPct,
    composicao,
    portfoliosComMeta: drafts.filter((d) => (d.metaOficial ?? 0) > 0).length,
    status: simulationStatus(drafts),
  };
}

/**
 * Percentuais de exibição que somam exatamente 100 (método do maior resto),
 * evitando "99,9%" por arredondamento. Retorna null quando não há composição.
 */
export function displayPercents(
  composicao: Record<string, number> | null,
  decimals = 1,
): Record<string, number> | null {
  if (!composicao) return null;
  const factor = 10 ** decimals;
  const entries = Object.entries(composicao);
  const scaled = entries.map(([k, v]) => {
    const exact = v * 100 * factor;
    return { k, floor: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let missing = 100 * factor - scaled.reduce((s, e) => s + e.floor, 0);
  const order = scaled
    .map((e, i) => ({ i, rest: e.rest }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (missing <= 0) break;
    scaled[i].floor += 1;
    missing -= 1;
  }
  return Object.fromEntries(scaled.map((e) => [e.k, e.floor / factor]));
}

// ============================ Comparativo visual =============================

/**
 * Ponto do gráfico de um portfólio. A barra é a performance atual (atingimento);
 * metas aparecem no tooltip como participação no total, para não depender da
 * meta padrão na visão do representante.
 *
 *   metaPct       = meta oficial do portfólio ÷ meta personalizada total
 *   referenciaPct = meta padrão do portfólio ÷ meta padrão total  (só gestão)
 */
export type ComparativoPoint = {
  familia: CanonicalFamily;
  label: string;
  /** Atingimento atual em pontos percentuais (62.5 = 62,5%). */
  performancePct: number | null;
  metaPct: number | null;
  metaValor: number | null;
  referenciaPct: number | null;
  referenciaValor: number | null;
};

export function buildComparativo(
  drafts: FamilyMetaDraft[],
  atingimento: Record<string, number | null>,
  vis: MetasVisibility,
): ComparativoPoint[] {
  const total = drafts.reduce((s, d) => s + (d.metaOficial ?? 0), 0);
  const refTotal = drafts.reduce((s, d) => s + (d.referencia ?? 0), 0);
  return drafts.map((d) => {
    const ratio = atingimento[d.familia] ?? null;
    return {
      familia: d.familia,
      label: METAS_FAMILY_LABEL[d.familia],
      performancePct: ratio == null ? null : ratio * 100,
      metaPct: total > 0 ? ((d.metaOficial ?? 0) / total) * 100 : null,
      metaValor: d.metaOficial,
      referenciaPct:
        vis.verMetaPadrao && d.referencia != null && refTotal > 0
          ? (d.referencia / refTotal) * 100
          : null,
      referenciaValor: vis.verMetaPadrao ? d.referencia : null,
    };
  });
}

export function categoryLabel(categoria: unknown): PortfolioCategory | null {
  return normalizePortfolioCategory(categoria);
}

// =============================== Formatação ==================================

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const fmtBRL = (v: number | null | undefined) => (v == null ? "—" : BRL.format(v));

export const fmtSignedBRL = (v: number | null | undefined) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${BRL.format(v)}`;

export const fmtPct = (ratio: number | null | undefined, decimals = 1) =>
  ratio == null || Number.isNaN(ratio)
    ? "—"
    : `${(ratio * 100).toFixed(decimals).replace(".", ",")}%`;

/** Formata um valor já em pontos percentuais (ex.: 62.5 → "62,5%"). */
export const fmtPoints = (pct: number | null | undefined, decimals = 1) =>
  pct == null || Number.isNaN(pct) ? "—" : `${pct.toFixed(decimals).replace(".", ",")}%`;
