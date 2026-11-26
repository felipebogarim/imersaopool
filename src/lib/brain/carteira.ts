// Carteira comercial em memória para as ferramentas do Brain. Monta-se SOMENTE a partir de linhas
// já filtradas pelo escopo no servidor (performance vigente por representante — a mesma fonte do
// Portal do Representante e da área de Metas). Indicadores usam as funções oficiais do sistema.

import { isClientRow } from "@/lib/client-row-filter";
import {
  acumuladoNoAno,
  mediaMensalCompras,
  type BaseImportada,
  type MediaCliente,
} from "@/lib/performance-media-cliente";
import { situacaoCategoria, type SituacaoCategoria } from "@/lib/performance-categoria";
import { getLatestActiveVersionByRep } from "@/lib/performance-periods";
import { sanitizeRatio } from "@/lib/performance-metrics";

export type UploadBruto = {
  id: string;
  representative_id: string | null;
  periodo_label: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  created_at: string | null;
  substituida_em: string | null;
};

export type LinhaBruta = {
  id: string;
  upload_id: string;
  razao_social: string | null;
  categoria: string | null;
  total_pct: number | null;
  familia_pct: Record<string, unknown> | null;
};

export type ValoresBrutos = {
  row_id: string;
  metas?: unknown;
  realizado?: unknown;
  media?: unknown;
};

export type ClienteCarteira = {
  /** id da linha de performance vigente (identificador usado pelas ferramentas). */
  id: string;
  nome: string;
  nomeNorm: string;
  categoria: string | null;
  representanteId: string;
  representante: string;
  periodoLabel: string | null;
  periodoFim: string | null;
  /** Atingimento total (ratio, 1 = 100%). */
  atingimento: number | null;
  atingimentoPortfolio: Record<string, number | null>;
  media: MediaCliente;
  situacao: SituacaoCategoria;
};

export const normalizarNome = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

/** Chave de cliente usada pelas metas (performance_goal_cycles.cliente_key). */
export const chaveMetas = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

// Mesma sanitização da carteira de Metas (ratio, 1 = 100%).
const ratio = (v: unknown): number | null => sanitizeRatio(v);

/** Versão vigente por representante (mesma regra da área de Metas e do BI de Clientes). */
export function uploadsVigentes(uploads: readonly UploadBruto[]): UploadBruto[] {
  return [...getLatestActiveVersionByRep(uploads.filter((u) => !u.substituida_em)).values()];
}

export function montarCarteira(args: {
  uploads: readonly UploadBruto[];
  linhas: readonly LinhaBruta[];
  valores: readonly ValoresBrutos[];
  representantes: ReadonlyMap<string, string>;
}): ClienteCarteira[] {
  const upById = new Map(args.uploads.map((u) => [u.id, u]));
  const valById = new Map(args.valores.map((v) => [v.row_id, v]));
  const out: ClienteCarteira[] = [];
  for (const l of args.linhas) {
    const up = upById.get(l.upload_id);
    if (!up?.representative_id) continue; // sem vínculo de carteira → fora (bloqueio por padrão)
    if (!isClientRow(l)) continue;
    const nome = (l.razao_social ?? "").trim();
    if (!nome) continue;
    const v = valById.get(l.id);
    const base: BaseImportada = {
      media: v?.media,
      realizado: v?.realizado,
      metas: v?.metas,
      familia_pct: l.familia_pct,
    };
    const media = mediaMensalCompras(base);
    const acumulado = acumuladoNoAno(media.total, up.periodo_fim);
    const atingimentoPortfolio: Record<string, number | null> = {};
    for (const [k, val] of Object.entries(l.familia_pct ?? {}))
      atingimentoPortfolio[k] = ratio(val);
    out.push({
      id: l.id,
      nome,
      nomeNorm: normalizarNome(nome),
      categoria: l.categoria,
      representanteId: up.representative_id,
      representante: args.representantes.get(up.representative_id) ?? "—",
      periodoLabel: up.periodo_label,
      periodoFim: up.periodo_fim,
      atingimento: ratio(l.total_pct),
      atingimentoPortfolio,
      media,
      situacao: situacaoCategoria(l.categoria, media, acumulado),
    });
  }
  return out;
}
