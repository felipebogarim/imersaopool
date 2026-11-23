// ============================================================================
// PERFORMANCE → METAS (Etapa 1: estrutura visual + simulação local)
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

/** Rótulos de exibição das sete famílias. */
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
  /** Vê a meta padrão da categoria e a variação contra ela. */
  verMetaPadrao: boolean;
  /** Vê os valores e a justificativa da sugestão interna da IA. */
  verSugestaoIa: boolean;
  /** Edita a meta oficial (gestor) e a justificativa. */
  editarMetaOficial: boolean;
  /** Edita a própria sugestão de representante. */
  editarSugestaoRep: boolean;
  /** Pode acionar Sugestão IA / Restaurar padrão / Revisar vínculo. */
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

export type AiSuggestionOrigin = "simulacao_local";

export type AiSuggestion = {
  valor: number;
  justificativa: string;
  origem: AiSuggestionOrigin;
};

export type FamilyMetaDraft = {
  familia: CanonicalFamily;
  /** Meta padrão da categoria (R$/mês). `null` quando a categoria é desconhecida. */
  referencia: number | null;
  sugestaoIa: AiSuggestion | null;
  sugestaoRep: number | null;
  comentarioRep: string;
  /** Meta mensal definida pelo gestor (R$). */
  metaGestor: number | null;
  justificativaGestor: string;
};

export const AI_ORIGIN_LABEL: Record<AiSuggestionOrigin, string> = {
  simulacao_local: "Simulação local — nenhum modelo de IA foi consultado",
};

/** Rascunho inicial: meta do gestor parte da referência padrão da categoria. */
export function buildInitialDrafts(categoria: unknown): FamilyMetaDraft[] {
  return METAS_FAMILIES.map((familia) => {
    const referencia = getPerformancePortfolioTarget(categoria, familia);
    return {
      familia,
      referencia,
      sugestaoIa: null,
      sugestaoRep: null,
      comentarioRep: "",
      metaGestor: referencia,
      justificativaGestor: "",
    };
  });
}

/** Volta a meta do gestor à distribuição padrão; preserva sugestões do representante. */
export function restoreDefaultDrafts(drafts: FamilyMetaDraft[]): FamilyMetaDraft[] {
  return drafts.map((d) => ({ ...d, metaGestor: d.referencia, justificativaGestor: "" }));
}

/**
 * Sugestão IA DEMONSTRATIVA. Não gera recomendação: replica a referência padrão
 * e identifica explicitamente a origem como simulação.
 */
export function simulateAiSuggestions(drafts: FamilyMetaDraft[]): FamilyMetaDraft[] {
  return drafts.map((d) => ({
    ...d,
    sugestaoIa:
      d.referencia == null
        ? null
        : {
            valor: d.referencia,
            justificativa:
              "Valor demonstrativo igual à referência da categoria. A sugestão real da IA será conectada em etapa futura.",
            origem: "simulacao_local",
          },
  }));
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

export type MetasSummary = {
  /** Soma das metas do gestor nas sete famílias. */
  total: number;
  /** Soma da referência padrão (null se a categoria não tiver referência). */
  referenciaTotal: number | null;
  variacaoAbs: number | null;
  /** (total − referência) / referência. */
  variacaoPct: number | null;
  /** Participação de cada família no total (soma 1). `null` quando total ≤ 0. */
  composicao: Record<CanonicalFamily, number> | null;
  familiasComMeta: number;
};

export function summarizeDrafts(drafts: FamilyMetaDraft[]): MetasSummary {
  const total = drafts.reduce((s, d) => s + (d.metaGestor ?? 0), 0);
  const refs = drafts.map((d) => d.referencia);
  const referenciaTotal = refs.some((r) => r == null)
    ? null
    : refs.reduce<number>((s, r) => s + (r as number), 0);
  const variacaoAbs = referenciaTotal == null ? null : total - referenciaTotal;
  const variacaoPct =
    referenciaTotal == null || referenciaTotal <= 0
      ? null
      : (total - referenciaTotal) / referenciaTotal;
  const composicao =
    total > 0
      ? (Object.fromEntries(drafts.map((d) => [d.familia, (d.metaGestor ?? 0) / total])) as Record<
          CanonicalFamily,
          number
        >)
      : null;
  return {
    total,
    referenciaTotal,
    variacaoAbs,
    variacaoPct,
    composicao,
    familiasComMeta: drafts.filter((d) => (d.metaGestor ?? 0) > 0).length,
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

export const fmtPct = (ratio: number | null | undefined, decimals = 1) =>
  ratio == null || Number.isNaN(ratio)
    ? "—"
    : `${(ratio * 100).toFixed(decimals).replace(".", ",")}%`;
