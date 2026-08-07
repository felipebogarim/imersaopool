import type { FieldImmersionDoc } from "./field-store-visit";
import { 
  emptyVisaoRep2, 
  type VisaoRep2, 
  VISAO_REP_VIEW_MODEL_BRIEF,
  type PrioritySignal,
} from "./visao-rep2-schema";

/**
 * Perspectivas canônicas da Imersão em Campo (V2).
 * Mapeamento determinístico de C1-C7 para as 7 abas da Visão Rep.
 */
export const IMMERSION_PERSPECTIVES_META = [
  { numero: 1, nome: "Contexto e percepção", codigo: "C1" },
  { numero: 2, nome: "Atores e decisão", codigo: "C2" },
  { numero: 3, nome: "Oferta e categorias", codigo: "C3" },
  { numero: 4, nome: "Posicionamento", codigo: "C4" },
  { numero: 5, nome: "Relacionamento", codigo: "C5" },
  { numero: 6, nome: "Operação e experiência", codigo: "C6" },
  { numero: 7, nome: "Síntese e ação", codigo: "C7" },
];

/**
 * Extrai uma citação literal do markdown.
 */
function extractEvidence(markdown: string): string | null {
  if (!markdown) return null;
  const quoteMatch = markdown.match(/[“"']([^"“”']{10,})["”']/);
  if (quoteMatch) return quoteMatch[1].trim();
  const blockMatch = markdown.match(/^>\s*(.+)$/m);
  if (blockMatch) return blockMatch[1].trim();
  return null;
}

function cleanMarkdown(md: string): string {
  return md
    .replace(/#+\s+/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/>\s+/g, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .trim();
}

/** Síntese Presidencial: Limite estrito de 700 caracteres. */
function generateExecutiveSummary(markdown: string, limit: number = 700): string {
  const clean = cleanMarkdown(markdown);
  const paragraphs = clean.split("\n\n").filter((p) => p.length > 20);
  const summary = paragraphs.slice(0, 2).join("\n\n");
  return summary.length > limit ? summary.slice(0, limit) + "..." : summary;
}

/**
 * Extrai sinais prioritários a partir do Capítulo C7.
 */
function extractSignalsFromC7(markdown: string): PrioritySignal[] {
  const lines = markdown.split("\n");
  const signals: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("-") || trimmed.startsWith("*") || /^\d+\./.test(trimmed)) {
      const cleanLine = trimmed.replace(/^[-*\d.]+\s+/, "").trim();
      if (cleanLine.length > 10) signals.push(cleanLine);
    }
  }
  if (signals.length < 3) {
    const paragraphs = markdown
      .split("\n\n")
      .map((p) => cleanMarkdown(p))
      .filter((p) => p.length > 20 && p.length < 300);
    signals.push(...paragraphs);
  }
  return signals.slice(0, 5).map((s, i) => ({
    title: s.length > 80 ? s.slice(0, 80).trim() + "..." : s,
    finding: s,
    business_impact: "Impacto identificado na imersão em campo.",
    recommended_action: null,
    confidence_level: "alto",
    evidence_status: "relato_individual",
    source_chapter: "C7",
    source_quote: null,
    signal_id: `SE_${String(i + 1).padStart(2, "0")}`,
    related_perspectives: [],
    validation_note: null,
    comparison_classification: "não abordado",
    group_comparison: null,
  }));
}

export function adapterImmersionToExecutive(doc: FieldImmersionDoc): VisaoRep2 {
  const visao = emptyVisaoRep2({
    schema_version: "3.0",
    view_model: VISAO_REP_VIEW_MODEL_BRIEF,
    representative_name: doc.meta["cliente"] || "Imersão em Campo",
    region: doc.meta["local"] || null,
    interview_date: doc.meta["data_visita"] || null,
  });

  const contextParts = [
    doc.meta["cliente"] ? `Cliente: ${doc.meta["cliente"]}` : null,
    doc.meta["local"] ? `Local: ${doc.meta["local"]}` : null,
    doc.meta["data_visita"] ? `Data: ${doc.meta["data_visita"]}` : null,
    doc.meta["representante"] ? `Representante: ${doc.meta["representante"]}` : null,
  ].filter(Boolean);

  visao.representative_context.additional_context = contextParts.join("\n");

  // 1. Síntese Presidencial (C1)
  const c1 = doc.chapters.find((c) => c.codigo === "C1");
  visao.executive_brief = {
    presidential_synthesis: c1
      ? generateExecutiveSummary(c1.markdown, 700)
      : "Síntese inicial não disponível.",
    themes: [],
  };

  // 2. Sinais Estratégicos (C7)
  const c7 = doc.chapters.find((c) => c.codigo === "C7");
  visao.executive_view.priority_signals = c7 ? extractSignalsFromC7(c7.markdown) : [];

  // 3. Perspectivas (C1-C7)
  visao.perspectives = IMMERSION_PERSPECTIVES_META.map((meta) => {
    const cap = doc.chapters.find((c) => c.codigo === meta.codigo);
    const md = cap?.markdown || "";
    const firstSentence = cleanMarkdown(md).split(/[.!?]/)[0] || "";
    const headline = firstSentence.slice(0, 110).trim();

    return {
      perspective_number: meta.numero,
      perspective_title: meta.nome,
      executive_finding: headline || "Conteúdo disponível para leitura.",
      business_impact: "Significado comercial identificado no capítulo.",
      recommended_action: null,
      evidence: generateExecutiveSummary(md, 500),
      source_quote: extractEvidence(md),
      confidence_level: "alto",
      evidence_status: "relato_individual",
      comparative_classification: "Base comparável insuficiente",
      full_reading: md || "Capítulo sem conteúdo registrado.",
      structured_fields: {},
      signal_ids: [],
      source_chapter: meta.codigo,
    };
  });

  return visao;
}
