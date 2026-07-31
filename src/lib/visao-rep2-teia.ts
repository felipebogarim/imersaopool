/**
 * Teia comparativa de posicionamento (brand_positioning_v1) — Visão Rep 2.
 *
 * Índices analíticos derivados das entrevistas. Nada aqui é pesquisa de mercado
 * nem dado de performance: apenas os scores enviados/gerados no relatório.
 * O cálculo é determinístico e não usa IA.
 */

import {
  BRAND_DIMENSIONS,
  BRAND_POSITIONING_VERSION,
  type BrandDimension,
  type BrandDimensionKey,
  type VisaoRep2,
} from "./visao-rep2-schema";

export type TeiaPonto = {
  key: BrandDimensionKey;
  label: string;
  longLabel: string;
  atual: number;
  media: number | null;
  delta: number | null;
  confianca: string | null;
  leitura: string | null;
  perspectivas: string[];
};

export type TeiaVM =
  | { status: "sem_dados" }
  | { status: "incompleto"; ausentes: string[] }
  | {
      status: "ok";
      pontos: TeiaPonto[];
      baseCount: number;
      /** Metodologia divergente encontrada entre os relatórios comparáveis. */
      metodologiaIncompativel: boolean;
      insight: string;
      indicadores: { rotulo: string; dimensao: string; delta: number }[];
      descricaoAcessivel: string;
    };

const CONF_LABEL: Record<string, string> = { alta: "Alta", media: "Média", média: "Média", baixa: "Baixa" };
export const confiancaLabel = (c: string | null) =>
  c ? (CONF_LABEL[c.trim().toLowerCase()] ?? c) : "Não informada";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Um relatório entra na base comparativa apenas com a mesma versão de metodologia. */
function scoresComparaveis(v: VisaoRep2): Record<BrandDimensionKey, number | null> | null {
  const bp = v.brand_positioning;
  if (!bp) return null;
  if ((bp.scoring_version ?? BRAND_POSITIONING_VERSION) !== BRAND_POSITIONING_VERSION) return null;
  const out = {} as Record<BrandDimensionKey, number | null>;
  for (const d of BRAND_DIMENSIONS) out[d.key] = bp.dimensions[d.key]?.score ?? null;
  return out;
}

/**
 * @param atual  relatório aberto
 * @param outros relatórios comparáveis (já filtrados: mesma base, um por representante,
 *               sem o representante/relatório atual)
 */
export function buildTeiaVM(atual: VisaoRep2, outros: VisaoRep2[]): TeiaVM {
  const bp = atual.brand_positioning;
  if (!bp) return { status: "sem_dados" };

  const ausentes = BRAND_DIMENSIONS.filter(d => (bp.dimensions[d.key]?.score ?? null) == null).map(d => d.label);
  if (ausentes.length) return { status: "incompleto", ausentes };

  const bases = outros.map(scoresComparaveis).filter(Boolean) as Record<BrandDimensionKey, number | null>[];
  const metodologiaIncompativel = outros.some(o => !!o.brand_positioning) && bases.length < outros.filter(o => !!o.brand_positioning).length;
  const usarMedia = bases.length >= 2;

  const pontos: TeiaPonto[] = BRAND_DIMENSIONS.map(d => {
    const dim: BrandDimension = bp.dimensions[d.key];
    const vals = usarMedia ? bases.map(b => b[d.key]).filter((n): n is number => n != null) : [];
    const media = vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    const atualScore = dim.score as number;
    return {
      key: d.key,
      label: d.label,
      longLabel: d.longLabel,
      atual: atualScore,
      media,
      delta: media == null ? null : round1(atualScore - media),
      confianca: dim.confidence,
      leitura: dim.reading,
      perspectivas: dim.perspective_ids,
    };
  });

  // ---- Insight determinístico a partir dos deltas ----
  const comDelta = pontos.filter(p => p.delta != null) as (TeiaPonto & { delta: number })[];
  let insight = "Ainda não há entrevistas comparáveis suficientes para calcular diferenças.";
  const indicadores: { rotulo: string; dimensao: string; delta: number }[] = [];

  if (comDelta.length) {
    const ord = [...comDelta].sort((a, b) => b.delta - a.delta);
    const acima = ord.filter(p => p.delta >= 8);
    const abaixo = [...comDelta].sort((a, b) => a.delta - b.delta).filter(p => p.delta <= -8);

    if (!acima.length && !abaixo.length) {
      insight = "Percepção amplamente alinhada à média das demais entrevistas.";
      const maisAlinhado = [...comDelta].sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
      indicadores.push({ rotulo: "Maior alinhamento", dimensao: maisAlinhado.label, delta: maisAlinhado.delta });
    } else {
      const forcas = acima.slice(0, 2).map(p => p.label);
      const frases: string[] = [];
      if (forcas.length) frases.push(`Acima da média em ${forcas.join(" e ")}.`);
      if (abaixo.length) frases.push(`A principal distância negativa está em ${abaixo[0].label}.`);
      if (!frases.length) frases.push("Percepção alinhada ao grupo na maior parte das dimensões.");
      insight = frases.slice(0, 2).join(" ");
      if (acima.length) indicadores.push({ rotulo: "Maior força relativa", dimensao: acima[0].label, delta: acima[0].delta });
      if (abaixo.length) indicadores.push({ rotulo: "Maior lacuna relativa", dimensao: abaixo[0].label, delta: abaixo[0].delta });
    }
  }

  const descricaoAcessivel = `Teia comparativa com seis dimensões. ${pontos
    .map(p => `${p.longLabel}: ${p.atual}${p.media != null ? `, média das demais ${p.media}` : ""}`)
    .join(". ")}.`;

  return {
    status: "ok",
    pontos,
    baseCount: usarMedia ? bases.length : 0,
    metodologiaIncompativel,
    insight,
    indicadores: indicadores.slice(0, 2),
    descricaoAcessivel,
  };
}

export const fmtDelta = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")}`;
export const fmtScore = (n: number) => n.toFixed(1).replace(/[.,]0$/, "").replace(".", ",");
