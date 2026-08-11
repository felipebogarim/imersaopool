/**
 * Scoring determinístico da Teia comparativa (brand_positioning_v1) para a
 * Visão Imersão 2.
 *
 * Sem IA: as seis dimensões são derivadas do próprio conteúdo do relatório
 * importado (sinais, impactos e citações). Assim cada relatório produz uma
 * leitura própria e a média das demais visões passa a ter significado.
 */
import type { Immersion2Data } from "./visao-imersao-2-parser";
import { BRAND_DIMENSIONS, type BrandDimensionKey, type BrandPositioning } from "./visao-rep2-schema";

const LEXICON: Record<BrandDimensionKey, string[]> = {
  qualidade: ["qualidade", "durabilidade", "defeito", "garantia", "assistencia", "confiabilidade", "acabamento", "falha"],
  preco_competitivo: ["preco", "precos", "custo", "margem", "desconto", "caro", "barato", "competitivo", "tabela", "valor"],
  portfolio: ["portfolio", "mix", "linha", "familia", "familias", "sortimento", "variedade", "lancamento", "produto"],
  disponibilidade: ["estoque", "prazo", "entrega", "disponibilidade", "ruptura", "falta", "logistica", "reposicao"],
  preferencia: ["preferencia", "marca", "relacionamento", "confianca", "indicacao", "fidelidade", "parceria", "atendimento"],
  especificacao: ["especificacao", "especificar", "projeto", "tecnico", "arquiteto", "engenheiro", "norma", "ficha"],
};

const NEGATIVOS = ["nao", "falta", "ruim", "caro", "atraso", "problema", "perda", "dificuldade", "reclama", "fraco", "ruptura", "defeito", "queda"];
const POSITIVOS = ["forte", "bom", "otimo", "excelente", "cresce", "crescimento", "vantagem", "referencia", "confia", "prefere", "ganho"];

const norm = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const clamp = (n: number) => Math.max(5, Math.min(100, Math.round(n)));

type Trecho = { texto: string; peso: number };

function coletarTrechos(data: Immersion2Data): Trecho[] {
  const out: Trecho[] = [];
  for (const s of data.signals ?? []) {
    out.push({ texto: norm(`${s.title} ${s.conclusion} ${s.business_impact}`), peso: s.confidence === "high" ? 1.4 : s.confidence === "medium" ? 1.1 : 0.8 });
  }
  for (const q of data.quotes ?? []) out.push({ texto: norm(q.text), peso: 1 });
  for (const p of data.perspectives ?? []) out.push({ texto: norm(p.title), peso: 0.6 });
  return out;
}

/** Score 0-100 por dimensão: base 50, ajustada por menções e polaridade. */
export function buildBrandPositioningFromImmersion2(data: Immersion2Data): BrandPositioning {
  const trechos = coletarTrechos(data);
  const dimensions = {} as BrandPositioning["dimensions"];

  for (const d of BRAND_DIMENSIONS) {
    const termos = LEXICON[d.key];
    let mencoes = 0;
    let polaridade = 0;

    for (const t of trechos) {
      const hits = termos.filter((k) => t.texto.includes(k)).length;
      if (!hits) continue;
      mencoes += hits * t.peso;
      const neg = NEGATIVOS.filter((k) => t.texto.includes(k)).length;
      const pos = POSITIVOS.filter((k) => t.texto.includes(k)).length;
      polaridade += (pos - neg) * t.peso;
    }

    if (mencoes === 0) {
      dimensions[d.key] = { score: null, confidence: "baixo", reading: "Sem evidência suficiente no relatório.", perspective_ids: [], evidence_count: 0 };
      continue;
    }

    const volume = Math.min(25, mencoes * 4);
    const tom = Math.max(-30, Math.min(30, polaridade * 6));
    const score = clamp(50 + volume + tom);
    const evid = Math.round(mencoes);

    dimensions[d.key] = {
      score,
      confidence: evid >= 4 ? "alto" : evid >= 2 ? "medio" : "baixo",
      reading: null,
      perspective_ids: [],
      evidence_count: evid,
    };
  }

  // Dimensões sem evidência recebem a média das demais para não distorcer a teia.
  const comScore = BRAND_DIMENSIONS.map((d) => dimensions[d.key].score).filter((n): n is number => n != null);
  if (comScore.length) {
    const media = Math.round(comScore.reduce((a, b) => a + b, 0) / comScore.length);
    for (const d of BRAND_DIMENSIONS) {
      if (dimensions[d.key].score == null) dimensions[d.key].score = media;
    }
  }

  return { scoring_version: "brand_positioning_v1", dimensions };
}
