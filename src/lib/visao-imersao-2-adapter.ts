import { type FieldImmersionDoc } from "./field-store-visit";
import { 
  type Immersion2Data, 
  extractImmersion2Json, 
  validateSignalV2 
} from "./visao-imersao-2-parser";
import { 
  emptyVisaoRep2, 
  type VisaoRep2, 
  VISAO_REP_VIEW_MODEL_BRIEF,
  type PrioritySignal
} from "./visao-rep2-schema";

/**
 * Adaptador para transformar os dados extraídos (JSON canônico V2) 
 * no modelo de visualização VisaoRep2.
 */
export function adapterImmersionV2ToExecutive(doc: FieldImmersionDoc): VisaoRep2 {
  // 1. Tenta extrair o bloco JSON estruturado (Fonte Canônica)
  const fullMarkdown = doc.chapters.map(c => c.markdown).join("\n\n");
  const immersion2Data = extractImmersion2Json(fullMarkdown);

  // Se não houver o bloco estruturado V2, podemos decidir se falhamos ou 
  // usamos o adapter antigo. Para a "Visão Imersão 2", a instrução é ser rigoroso.
  if (!immersion2Data) {
    throw new Error("Bloco JSON 'visao_imersao_2' não encontrado ou inválido no documento.");
  }

  // 2. Inicializa o objeto VisaoRep2
  const visao = emptyVisaoRep2({
    schema_version: "3.0", // Mantemos 3.0 para compatibilidade com o layout de Temas Estratégicos se necessário, 
                           // ou usamos o campo view_model para sinalizar o novo layout.
    view_model: "visao_imersao_2_executiva",
    representative_name: immersion2Data.client.name,
    region: immersion2Data.client.location,
    interview_date: immersion2Data.client.visit_date,
  });

  // 3. Mapeia metadados estendidos
  const meta = immersion2Data.client;
  visao.representative_context.additional_context = [
    `Cliente: ${meta.name}`,
    `Local: ${meta.location}`,
    `Data da visita: ${meta.visit_date}`,
    meta.representative ? `Representante: ${meta.representative}` : null,
    meta.consultant ? `Consultor: ${meta.consultant}` : null,
  ].filter(Boolean).join("\n");

  visao.representative_context.represented_brands = immersion2Data.brands_observed;
  
  // 4. Mapeia Sinais (Validados)
  const validSignals = immersion2Data.signals.filter(s => validateSignalV2(s, immersion2Data).isValid);

  visao.executive_view.priority_signals = validSignals.map(s => {
    // Resolve citações para o sinal
    const evidenceText = s.evidence_quotes.map(qid => {
      const q = immersion2Data.quotes.find(item => item.id === qid);
      if (!q) return null;
      
      const authorInfo = q.reported_by 
        ? `${q.original_author} · fala relatada por ${q.reported_by}`
        : `${q.original_author}${q.original_author_role ? ` (${q.original_author_role})` : ""}`;
      
      return `“${q.text}”\n— ${authorInfo}${q.quote_type === "reported" ? " (fala relatada)" : ""}`;
    }).filter(Boolean).join("\n\n");

    // Mapeia perspectivas para IDs numéricos (se necessário para componentes legados)
    const perspectiveIndices = s.perspectives.map(pid => {
      const p = immersion2Data.perspectives.find(item => item.id === pid);
      return p ? p.chapter : null;
    }).filter((idx): idx is number => idx !== null);

    return {
      signal_id: s.id,
      title: s.title,
      finding: s.conclusion,
      business_impact: s.business_impact,
      recommended_action: null,
      confidence_level: s.confidence === "high" ? "alto" : s.confidence === "medium" ? "medio" : "baixo",
      evidence_status: "validado_por_dados",
      source_chapter: "V2_JSON",
      source_quote: evidenceText,
      related_perspectives: perspectiveIndices,
      group_comparison: null,
      comparison_classification: "não abordado"
    } as PrioritySignal;
  });

  // 5. Mapeia Perspectivas do Relatório para o modelo Perspective
  visao.perspectives = immersion2Data.perspectives.map(p => {
    const chapter = doc.chapters.find(c => c.codigo === `C${p.chapter}` || c.ordem === p.chapter);
    return {
      perspective_number: p.chapter,
      perspective_title: p.title,
      executive_finding: null,
      business_impact: null,
      recommended_action: null,
      evidence: chapter?.markdown || "Conteúdo não encontrado no markdown editorial.",
      source_quote: null,
      confidence_level: "alto",
      evidence_status: "relato_individual",
      comparative_classification: "Base comparável insuficiente",
      full_reading: chapter?.markdown || "",
      structured_fields: {},
      signal_ids: validSignals.filter(s => s.perspectives.includes(p.id)).map(s => s.id),
      source_chapter: `C${p.chapter}`
    };
  });

  // 6. Performance Connection (Default/Placeholder para busca comercial posterior)
  visao.performance_connection = {
    upload_id: null,
    periodo_label: "1º Semestre 2026",
    linked: true,
    geral_pct: 42.9, // Fallback canônico
    comparativo_grupo_pct: null,
    periodo_referencia: "1º Semestre 2026",
    status_atendimento: null,
    oportunidades_identificadas: [],
    ameacas_identificadas: [],
  };

  // 7. Síntese Presidencial (C1 do markdown editorial)
  const c1 = doc.chapters.find(c => c.codigo === "C1" || c.ordem === 1);
  visao.executive_brief = {
    presidential_synthesis: c1?.markdown || "Síntese inicial não encontrada.",
    themes: []
  };

  return visao;
}
