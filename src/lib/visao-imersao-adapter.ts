import type { FieldImmersionDoc, FieldImmersionChapter } from "./field-store-visit";
import { 
  emptyVisaoRep2, 
  type VisaoRep2, 
  VISAO_REP_VIEW_MODEL_BRIEF 
} from "./visao-rep2-schema";

/**
 * Perspectivas canônicas da Imersão em Campo (V2).
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
 * Reconhece: "texto entre aspas", blockquotes (>), ou seções específicas.
 */
function extractEvidence(markdown: string): string | null {
  if (!markdown) return null;
  
  // 1. Procura citações entre aspas (mínimo 10 caracteres)
  const quoteMatch = markdown.match(/[“"']([^"“”']{10,})["”']/);
  if (quoteMatch) return quoteMatch[1].trim();

  // 2. Procura blockquotes (>)
  const blockMatch = markdown.match(/^>\s*(.+)$/m);
  if (blockMatch) return blockMatch[1].trim();

  // 3. Procura seções de citação
  const lines = markdown.split('\n');
  const sections = ["Citação", "Citações", "Evidência", "Exemplos e evidências"];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (sections.some(s => line.toLowerCase().includes(s.toLowerCase()))) {
      const nextLine = lines[i + 1]?.trim();
      if (nextLine && nextLine.length > 10) return nextLine;
    }
  }

  return null;
}

/**
 * Limpa tokens markdown para exibição em campos de síntese.
 */
function cleanMarkdown(md: string): string {
  return md
    .replace(/#+\s+/g, '') // Remove headers
    .replace(/\*\*/g, '')  // Remove bold
    .replace(/\*/g, '')    // Remove italic
    .replace(/>\s+/g, '')  // Remove blockquotes
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links
    .trim();
}

/**
 * Gera uma síntese executiva curta a partir do corpo do capítulo.
 */
function generateExecutiveSummary(markdown: string, limit: number = 500): string {
  const clean = cleanMarkdown(markdown);
  const paragraphs = clean.split('\n\n').filter(p => p.length > 20);
  
  // Pega os dois primeiros parágrafos curtos
  const summary = paragraphs.slice(0, 2).join('\n\n');
  return summary.length > limit ? summary.slice(0, limit) + "..." : summary;
}

/**
 * Converte um relatório de imersão (FIELD_IMMERSION_CHAPTERS_V2) 
 * no modelo de visualização executiva (VisaoRep2).
 */
export function adapterImmersionToExecutive(doc: FieldImmersionDoc): VisaoRep2 {
  const visao = emptyVisaoRep2({
    schema_version: "3.0",
    view_model: VISAO_REP_VIEW_MODEL_BRIEF,
    representative_name: doc.meta["cliente"] || doc.meta["titulo"] || "Imersão em Campo",
    region: doc.meta["local"] || null,
    interview_date: doc.meta["data_visita"] || null,
  });

  // Mapeia metadados estendidos de forma compacta
  const contextParts = [
    doc.meta["cliente"] ? `Cliente: ${doc.meta["cliente"]}` : null,
    doc.meta["local"] ? `Local: ${doc.meta["local"]}` : null,
    doc.meta["data_visita"] ? `Data: ${doc.meta["data_visita"]}` : null,
    doc.meta["representante"] ? `Representante: ${doc.meta["representante"]}` : null,
    doc.meta["consultor"] ? `Consultor: ${doc.meta["consultor"]}` : null,
    doc.meta["tipo_imersao"] ? `Tipo: ${doc.meta["tipo_imersao"]}` : null,
  ].filter(Boolean);

  visao.representative_context.additional_context = contextParts.join('\n');
  
  // 1. Síntese Presidencial (Topo) - Máximo 700 caracteres
  const sumarioCap = doc.chapters.find(c => c.codigo === "C0" || c.codigo === "C1" || c.titulo.toLowerCase().includes("sumário"));
  visao.executive_brief = {
    presidential_synthesis: sumarioCap ? generateExecutiveSummary(sumarioCap.markdown, 700) : "Sem síntese estratégica disponível.",
    themes: [] 
  };

  // 2. Sinais Estratégicos (Leitura Integrada)
  // Extrai sinais do capítulo de síntese (C7) ou temas recorrentes
  const sinteseCap = doc.chapters.find(c => c.codigo === "C7");
  if (sinteseCap) {
    const conclusions = sinteseCap.markdown.split('\n')
      .filter(l => l.startsWith('-') || l.startsWith('*') || /^\d+\./.test(l))
      .map(l => l.replace(/^[-*\d.]+\s+/, '').trim())
      .slice(0, 5); // Entre 3 e 5 sinais

    visao.executive_view.priority_signals = conclusions.map((c, i) => ({
      title: c.length > 100 ? c.slice(0, 100) + "..." : c,
      finding: c,
      business_impact: "Impacto identificado na imersão.",
      recommended_action: null,
      confidence_level: "alto",
      evidence_status: "relato_individual",
      source_chapter: "C7",
      source_quote: null,
      signal_id: `SIG_${i + 1}`,
      related_perspectives: [7]
    }));
  }

  // 3. Perspectivas (Tabs) - Exatamente 7
  visao.perspectives = IMMERSION_PERSPECTIVES_META.map(meta => {
    const cap = doc.chapters.find(c => c.codigo === meta.codigo);
    const markdown = cap?.markdown || "";
    
    const headline = cleanMarkdown(markdown.split('\n')[0]).slice(0, 110);
    const summary = generateExecutiveSummary(markdown, 500);
    const evidence = extractEvidence(markdown);
    
    // BusinessMeaning e Action (extraídos ou placeholder)
    const businessMeaning = "Implicação gerencial identificada para este capítulo.";
    
    return {
      perspective_number: meta.numero,
      perspective_title: meta.nome,
      executive_finding: headline, // Tese principal
      business_impact: businessMeaning,
      recommended_action: null, // DecisionOrAction
      evidence: summary, // Leitura principal (sumarizada)
      source_quote: evidence, // Citação real
      confidence_level: "alto",
      evidence_status: "relato_individual",
      comparative_classification: "Base comparável insuficiente",
      full_reading: markdown, // Conteúdo integral preservado para áreas de aprofundamento
      structured_fields: {},
    };
  });

  return visao;
}
