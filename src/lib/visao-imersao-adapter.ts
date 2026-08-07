import type { FieldImmersionDoc } from "./field-store-visit";
import { 
  emptyVisaoRep2, 
  type VisaoRep2, 
  VISAO_REP_SCHEMA_VERSION, 
  VISAO_REP_VIEW_MODEL_BRIEF 
} from "./visao-rep2-schema";

/**
 * Converte um relatório de imersão (FIELD_IMMERSION_CHAPTERS_V2) 
 * no modelo de visualização executiva (VisaoRep2).
 */
export function adapterImmersionToExecutive(doc: FieldImmersionDoc): VisaoRep2 {
  const visao = emptyVisaoRep2({
    schema_version: "3.0", // Força comportamento de briefing executivo
    view_model: VISAO_REP_VIEW_MODEL_BRIEF,
    representative_name: doc.meta["cliente"] || doc.meta["titulo"] || "Imersão em Campo",
    region: doc.meta["local"] || null,
    interview_date: doc.meta["data_visita"] || null,
  });

  // Mapeia metadados estendidos
  visao.representative_context.additional_context = `Local: ${doc.meta["local"] || "Não informado"}\nConsultor: ${doc.meta["consultor"] || "Não informado"}`;
  
  // Sumário Executivo (C0 ou C1 dependendo do parser) vira a Síntese Presidencial
  const sumario = doc.chapters.find(c => c.codigo === "C0") || doc.chapters.find(c => c.codigo === "C1");
  
  visao.executive_brief = {
    presidential_synthesis: sumario?.markdown || "Sem sumário executivo disponível.",
    themes: [] // Imersões no V2 ainda não geram "Temas" (Briefing V1), usam capítulos lineares
  };

  // Mapeia os capítulos (C1-C7) para as perspectivas (1-8)
  // Como são 7 capítulos e o modelo tem 8 slots, fazemos um mapeamento direto por código
  doc.chapters.forEach(cap => {
    const num = parseInt(cap.codigo.replace("C", ""), 10);
    if (num >= 1 && num <= 8) {
      const p = visao.perspectives[num - 1];
      if (p) {
        p.perspective_title = cap.titulo;
        p.full_reading = cap.markdown;
        // No modo imersão, o "executive_finding" pode ser extraído do primeiro parágrafo
        p.executive_finding = cap.markdown.split('\n')[0].slice(0, 200);
      }
    }
  });

  return visao;
}
