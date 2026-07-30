// Modelo canônico da Visão Rep 2.
// Os dois modos de criação (Gerar com IA e Importar relatório pronto) produzem
// exatamente este objeto. Nada aqui inventa conteúdo: campos ausentes ficam
// nulos ou vazios e a interface simplesmente os oculta.

export const VISAO_REP_SCHEMA_VERSION = "visao_rep.v2";

export type CreationMode = "ai_generated" | "imported_ready";
export type ConfidenceLevel = "alto" | "medio" | "baixo";
export type EvidenceStatus =
  | "relato_individual"
  | "corroborado_por_outras_entrevistas"
  | "validado_por_documento"
  | "validado_por_dados"
  | "hipotese_a_validar";
export type LineClassification = "forte" | "potencial" | "pressionada" | "sem_evidencia_suficiente";

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  alto: "Confiança alta",
  medio: "Confiança média",
  baixo: "Confiança baixa",
};

export const EVIDENCE_LABEL: Record<EvidenceStatus, string> = {
  relato_individual: "Relato individual",
  corroborado_por_outras_entrevistas: "Corroborado por outras entrevistas",
  validado_por_documento: "Validado por documento",
  validado_por_dados: "Validado por dados",
  hipotese_a_validar: "Hipótese a validar",
};

export const CLASSIFICATION_LABEL: Record<LineClassification, string> = {
  forte: "Forte",
  potencial: "Potencial",
  pressionada: "Pressionada",
  sem_evidencia_suficiente: "Sem evidência suficiente",
};

export const PERSPECTIVE_TITLES = [
  "Percepção de marca e preço",
  "Mix ofertado e esforço de venda",
  "Competição de mercado",
  "Argumento técnico no ponto de venda",
  "Critério de decisão do cliente",
  "Oportunidades, ameaças e cuidados",
  "Governança comercial e autonomia",
  "Informações adicionais",
] as const;

export type PrioritySignal = {
  title: string | null;
  finding: string | null;
  business_impact: string | null;
  recommended_action: string | null;
  confidence_level: ConfidenceLevel | null;
  evidence_status: EvidenceStatus | null;
  source_chapter: string | null;
  source_quote: string | null;
};

export type Metadata = {
  schema_version: string;
  representative_id: string | null;
  representative_name: string | null;
  region: string | null;
  interview_date: string | null;
  report_date: string | null;
  creation_mode: CreationMode;
  source_file_name: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ExecutiveView = {
  central_thesis: string | null;
  strategic_risk: string | null;
  priority_signals: PrioritySignal[];
  decisions_required: string[];
  validation_required: string[];
  final_synthesis: string | null;
};

export type RepresentativeContext = {
  represented_brands: string[];
  region_summary: string | null;
  service_model: string | null;
  regional_structure: string | null;
  additional_context: string | null;
};

export type StrategicClient = {
  client_name: string | null;
  strategic_reason: string | null;
  perceived_potential: string | null;
  identified_opportunity: string | null;
  priority_product_lines: string | null;
  main_competitor: string | null;
  recommended_next_action: string | null;
  attention_point: string | null;
};

export type ProductLineView = {
  product_line: string | null;
  summary: string | null;
  classification: LineClassification | null;
  what_works: string | null;
  main_barrier: string | null;
  main_competitor: string | null;
  competitor_advantage: string | null;
  opportunity: string | null;
  recommended_action: string | null;
  evidence: string | null;
  source_quote: string | null;
};

export type Perspective = {
  perspective_number: number;
  perspective_title: string;
  executive_finding: string | null;
  business_impact: string | null;
  recommended_action: string | null;
  evidence: string | null;
  source_quote: string | null;
  confidence_level: ConfidenceLevel | null;
  evidence_status: EvidenceStatus | null;
  comparative_classification: string | null;
  full_reading: string | null;
  structured_fields: Record<string, string | string[]>;
};

export type ConsensusPoint = {
  statement: string | null;
  supporting_source_count: number | null;
  comparable_source_count: number | null;
  supporting_sources: string[];
};

export type UnaddressedTopic = {
  statement: string | null;
  question_was_asked: boolean | null;
  comparison_is_valid: boolean | null;
  classification: string | null;
  methodological_note: string | null;
};

export type Divergence = {
  topic: string | null;
  predominant_view: string | null;
  representative_view: string | null;
  sources_supporting_predominant_view: string[];
  sources_supporting_representative_view: string[];
  evidence: string | null;
};

export type ExclusiveReading = {
  statement: string | null;
  region: string | null;
  supporting_evidence: string | null;
  validation_required: string | null;
};

export type ComparativeView = {
  comparable_source_count: number | null;
  comparable_point_count: number | null;
  supported_points: number | null;
  consensus_points: ConsensusPoint[];
  unaddressed_topics: UnaddressedTopic[];
  divergences: Divergence[];
  exclusive_readings: ExclusiveReading[];
  methodology_note: string | null;
};

export type PerformanceConnection = {
  upload_id: string | null;
  periodo_label: string | null;
  linked: boolean;
};

export type SourceControl = {
  creation_mode: CreationMode;
  source_file: string | null;
  schema_version: string;
  import_date: string | null;
  imported_by: string | null;
  last_update: string | null;
  content_hash: string | null;
};

export type VisaoRep2 = {
  metadata: Metadata;
  executive_view: ExecutiveView;
  representative_context: RepresentativeContext;
  strategic_clients: StrategicClient[];
  product_line_views: ProductLineView[];
  perspectives: Perspective[];
  comparative_view: ComparativeView;
  performance_connection: PerformanceConnection;
  source_control: SourceControl;
  /** Campos herdados da Visão Rep original (percentuais de alinhamento etc.). */
  legacy?: Record<string, string | number | boolean | null>;
};

export const MAX_SIGNALS = 5;
export const MAX_DECISIONS = 3;
export const MAX_VALIDATIONS = 3;
export const MAX_CLIENTS = 5;

export function emptyPerspective(i: number): Perspective {
  return {
    perspective_number: i + 1,
    perspective_title: PERSPECTIVE_TITLES[i] ?? `Perspectiva ${i + 1}`,
    executive_finding: null,
    business_impact: null,
    recommended_action: null,
    evidence: null,
    source_quote: null,
    confidence_level: null,
    evidence_status: null,
    comparative_classification: null,
    full_reading: null,
    structured_fields: {},
  };
}

export function emptyVisaoRep2(partial?: Partial<Metadata>): VisaoRep2 {
  return {
    metadata: {
      schema_version: VISAO_REP_SCHEMA_VERSION,
      representative_id: null,
      representative_name: null,
      region: null,
      interview_date: null,
      report_date: null,
      creation_mode: "ai_generated",
      source_file_name: null,
      created_by: null,
      created_at: null,
      updated_at: null,
      ...partial,
    },
    executive_view: {
      central_thesis: null,
      strategic_risk: null,
      priority_signals: [],
      decisions_required: [],
      validation_required: [],
      final_synthesis: null,
    },
    representative_context: {
      represented_brands: [],
      region_summary: null,
      service_model: null,
      regional_structure: null,
      additional_context: null,
    },
    strategic_clients: [],
    product_line_views: [],
    perspectives: PERSPECTIVE_TITLES.map((_, i) => emptyPerspective(i)),
    comparative_view: {
      comparable_source_count: null,
      comparable_point_count: null,
      supported_points: null,
      consensus_points: [],
      unaddressed_topics: [],
      divergences: [],
      exclusive_readings: [],
      methodology_note: null,
    },
    performance_connection: { upload_id: null, periodo_label: null, linked: false },
    source_control: {
      creation_mode: "ai_generated",
      source_file: null,
      schema_version: VISAO_REP_SCHEMA_VERSION,
      import_date: null,
      imported_by: null,
      last_update: null,
      content_hash: null,
    },
  };
}

/** Normaliza um objeto vindo do banco (inclusive registros antigos/parciais). */
export function normalizeVisaoRep2(raw: unknown): VisaoRep2 {
  const base = emptyVisaoRep2();
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const merged: VisaoRep2 = {
    ...base,
    ...o,
    metadata: { ...base.metadata, ...(o.metadata ?? {}) },
    executive_view: { ...base.executive_view, ...(o.executive_view ?? {}) },
    representative_context: { ...base.representative_context, ...(o.representative_context ?? {}) },
    strategic_clients: Array.isArray(o.strategic_clients) ? o.strategic_clients : [],
    product_line_views: Array.isArray(o.product_line_views) ? o.product_line_views : [],
    perspectives: Array.isArray(o.perspectives) && o.perspectives.length
      ? PERSPECTIVE_TITLES.map((t, i) => ({
          ...emptyPerspective(i),
          ...(o.perspectives.find((p: any) => Number(p?.perspective_number) === i + 1) ?? {}),
          perspective_number: i + 1,
          perspective_title: o.perspectives.find((p: any) => Number(p?.perspective_number) === i + 1)?.perspective_title || t,
        }))
      : base.perspectives,
    comparative_view: { ...base.comparative_view, ...(o.comparative_view ?? {}) },
    performance_connection: { ...base.performance_connection, ...(o.performance_connection ?? {}) },
    source_control: { ...base.source_control, ...(o.source_control ?? {}) },
  };
  merged.executive_view.priority_signals = (merged.executive_view.priority_signals ?? []).slice(0, MAX_SIGNALS);
  merged.executive_view.decisions_required = (merged.executive_view.decisions_required ?? []).slice(0, MAX_DECISIONS);
  merged.executive_view.validation_required = (merged.executive_view.validation_required ?? []).slice(0, MAX_VALIDATIONS);
  merged.strategic_clients = merged.strategic_clients.slice(0, MAX_CLIENTS);
  return merged;
}

export type ValidationReport = {
  missingRequired: string[];
  missingOptional: string[];
  recognized: string[];
};

const nonEmpty = (v: unknown) => typeof v === "string" && v.trim().length > 0;

/** Valida a estrutura sem alterar nada do conteúdo. */
export function validateVisaoRep2(v: VisaoRep2): ValidationReport {
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  const recognized: string[] = [];

  if (!nonEmpty(v.metadata.representative_name)) missingRequired.push("Metadados › representante");
  else recognized.push("Metadados › representante");

  if (!nonEmpty(v.executive_view.central_thesis)) missingRequired.push("Visão executiva › tese central");
  else recognized.push("Visão executiva › tese central");

  if (!v.executive_view.priority_signals.length) missingRequired.push("Visão executiva › sinais prioritários");
  else recognized.push(`Visão executiva › ${v.executive_view.priority_signals.length} sinal(is) prioritário(s)`);

  const comPersp = v.perspectives.filter(p => nonEmpty(p.executive_finding) || nonEmpty(p.full_reading));
  if (!comPersp.length) missingRequired.push("Perspectivas da entrevista");
  else recognized.push(`Perspectivas › ${comPersp.length} de 8 preenchidas`);

  const optional: [string, boolean][] = [
    ["Metadados › região", nonEmpty(v.metadata.region)],
    ["Metadados › data da entrevista", nonEmpty(v.metadata.interview_date)],
    ["Visão executiva › risco estratégico", nonEmpty(v.executive_view.strategic_risk)],
    ["Visão executiva › decisões requeridas", v.executive_view.decisions_required.length > 0],
    ["Visão executiva › validações necessárias", v.executive_view.validation_required.length > 0],
    ["Visão executiva › síntese final", nonEmpty(v.executive_view.final_synthesis)],
    ["Contexto › marcas representadas", v.representative_context.represented_brands.length > 0],
    ["Contexto › região e modelo de atendimento", nonEmpty(v.representative_context.region_summary)],
    ["Clientes estratégicos", v.strategic_clients.length > 0],
    ["Visão por linha de produto", v.product_line_views.length > 0],
    ["Paralelo › consensos", v.comparative_view.consensus_points.length > 0],
    ["Paralelo › temas não abordados", v.comparative_view.unaddressed_topics.length > 0],
    ["Paralelo › divergências", v.comparative_view.divergences.length > 0],
    ["Paralelo › leituras exclusivas", v.comparative_view.exclusive_readings.length > 0],
  ];
  for (const [label, ok] of optional) (ok ? recognized : missingOptional).push(label);

  return { missingRequired, missingOptional, recognized };
}
