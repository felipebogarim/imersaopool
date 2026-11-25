// MÉDIA MENSAL DE COMPRAS do cliente — fonte ÚNICA para timeline de categoria, alerta de
// situação, gauge e base por portfólio.
//
// Estrutura da importação (performance-import-engine.ts + RPC submit_performance_upload):
// - `media`     = subcoluna "MÉDIA" do portfólio na planilha (R$/mês).
// - `realizado` = subcoluna "RESULTADO/REAL/FATURAMENTO/VENDA" (R$). A importação valida o %
//                 informado contra realizado ÷ meta do próprio upload, ou seja, está na mesma
//                 base mensal da meta do upload. O parser grava `media` só quando não há realizado.
// - `familia_pct` = % do portfólio: coluna %/ATINGIMENTO, ou realizado ÷ meta, ou média ÷ meta,
//                 ou (sem número) o ponto médio da faixa de cor da legenda.
// - `metas`     = subcoluna META do upload; sem ela, a meta da Matriz Financeira da categoria
//                 naquele upload. É a BASE ORIGINAL do percentual.
//
// Regras: valor real primeiro (média, depois realizado); % × meta ORIGINAL do upload como
// estimativa sinalizada (nunca a meta do gestor nem a meta padrão da categoria); portfólio sem
// dado fica FORA da soma — ausência nunca vira faturamento zero.

import { CANONICAL_FAMILIES, normalizeText, type CanonicalFamily } from "./client-bi-familias";

export type FonteMedia = "media" | "realizado" | "estimado";

export const FONTE_MEDIA_LABEL: Record<FonteMedia, string> = {
  media: "Média mensal (R$) da importação",
  realizado: "Realizado (R$) da importação",
  estimado: "Estimado: % × meta original do upload",
};

export type BaseImportada = {
  media?: unknown;
  realizado?: unknown;
  familia_pct?: unknown;
  metas?: unknown;
} | null;

export type MediaPortfolio = {
  familia: CanonicalFamily;
  valor: number | null;
  fonte: FonteMedia | null;
};

export type MediaCliente = {
  /** Soma dos portfólios COM dado; null quando nenhum portfólio tem dado. */
  total: number | null;
  portfolios: MediaPortfolio[];
  /** Algum portfólio entrou por estimativa (% × meta original). */
  estimado: boolean;
  semDado: CanonicalFamily[];
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

function lookup(record: unknown, family: string): number | null {
  if (!record || typeof record !== "object") return null;
  const rec = record as Record<string, unknown>;
  if (rec[family] !== undefined) return num(rec[family]);
  const alvo = normalizeText(family);
  for (const [k, v] of Object.entries(rec)) if (normalizeText(k) === alvo) return num(v);
  return null;
}

/** % do portfólio como ratio (aceita 0,8 ou 80). */
function ratio(v: number | null): number | null {
  if (v == null || v < 0) return null;
  return Math.abs(v) <= 2.5 ? v : v / 100;
}

/** Valor mensal de UM portfólio pela regra única (ou null = sem dado). */
export function mediaDoPortfolio(
  base: BaseImportada,
  familia: string,
): { valor: number; fonte: FonteMedia } | null {
  if (!base) return null;
  const media = lookup(base.media, familia);
  if (media != null && media >= 0) return { valor: media, fonte: "media" };
  const real = lookup(base.realizado, familia);
  if (real != null && real >= 0) return { valor: real, fonte: "realizado" };
  const pct = ratio(lookup(base.familia_pct, familia));
  const metaOriginal = lookup(base.metas, familia);
  if (pct != null && metaOriginal != null && metaOriginal > 0)
    return { valor: pct * metaOriginal, fonte: "estimado" };
  return null;
}

export function mediaMensalCompras(base: BaseImportada | undefined): MediaCliente {
  const portfolios: MediaPortfolio[] = CANONICAL_FAMILIES.map((familia) => {
    const r = mediaDoPortfolio(base ?? null, familia);
    return { familia, valor: r?.valor ?? null, fonte: r?.fonte ?? null };
  });
  const com = portfolios.filter((p) => p.valor != null);
  return {
    total: com.length ? com.reduce((s, p) => s + (p.valor as number), 0) : null,
    portfolios,
    estimado: com.some((p) => p.fonte === "estimado"),
    semDado: portfolios.filter((p) => p.valor == null).map((p) => p.familia),
  };
}

/**
 * Acumulado no ano (estimado): média mensal × meses do período do upload dentro do ano do fim do
 * período. Sem início ou fim de período não há como contar os meses: null (não supõe).
 */
export function acumuladoNoAno(
  media: number | null,
  periodoInicio: string | null | undefined,
  periodoFim: string | null | undefined,
): { valor: number; meses: number; ano: number } | null {
  if (media == null || !periodoInicio || !periodoFim) return null;
  const ini = /^(\d{4})-(\d{2})/.exec(periodoInicio);
  const fim = /^(\d{4})-(\d{2})/.exec(periodoFim);
  if (!ini || !fim) return null;
  const ano = Number(fim[1]);
  const mIni = Number(ini[1]) < ano ? 1 : Number(ini[2]);
  const meses = Number(fim[2]) - mIni + 1;
  if (meses < 1 || meses > 12) return null;
  return { valor: media * meses, meses, ano };
}
