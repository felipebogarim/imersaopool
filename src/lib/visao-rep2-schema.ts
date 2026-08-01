// Modelo canônico da Visão Rep.
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
  /** Vínculos opcionais (Leitura integrada da Visão Rep). Relatórios antigos não possuem. */
  signal_id?: string | null;
  validation_note?: string | null;
  related_perspectives?: number[];
  /** Comparação com o grupo enviada dentro do próprio sinal (relatórios novos). */
  comparison_classification?: string | null;
  comparable_sources?: number | null;
  group_comparison?: string | null;
};


export type Metadata = {
  schema_version: string;
  /** Modelo de leitura do relatório (ex.: "executive_brief_v1" no schema 3.0). */
  view_model?: string | null;
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
  /** Vínculo opcional com os sinais executivos (Leitura integrada). */
  signal_ids?: string[];
};

export type ConsensusPoint = {
  statement: string | null;
  supporting_source_count: number | null;
  comparable_source_count: number | null;
  supporting_sources: string[];
  signal_id?: string | null;
};

export type UnaddressedTopic = {
  statement: string | null;
  question_was_asked: boolean | null;
  comparison_is_valid: boolean | null;
  classification: string | null;
  methodological_note: string | null;
  signal_id?: string | null;
};

export type Divergence = {
  topic: string | null;
  predominant_view: string | null;
  representative_view: string | null;
  sources_supporting_predominant_view: string[];
  sources_supporting_representative_view: string[];
  evidence: string | null;
  signal_id?: string | null;
};

export type ExclusiveReading = {
  statement: string | null;
  region: string | null;
  supporting_evidence: string | null;
  validation_required: string | null;
  signal_id?: string | null;
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

/** Tema estratégico do modelo executive_brief_v1 (schema 3.0). */
export type ExecutiveTheme = {
  id: string | null;
  /** Rótulo curto do seletor de temas. */
  selector: string | null;
  /** Título conclusivo do tema (usado no mapeamento interno para priority_signals). */
  title: string | null;
  context: string | null;
  where_appears: string[];
  represents: string | null;
  decision: string | null;
  validation: string | null;
  evidence: string | null;
  comparison: string | null;
  confidence: string | null;
  perspectives: string[];
  entities: {
    produtos: string[];
    concorrentes: string[];
    clientes: string[];
    ferramentas: string[];
    nota: string | null;
  };
};

/** Bloco executivo do schema 3.0 / executive_brief_v1. */
export type ExecutiveBrief = {
  presidential_synthesis: string | null;
  themes: ExecutiveTheme[];
};

/* ---------- Teia comparativa de posicionamento (brand_positioning_v1) ---------- */

export const BRAND_POSITIONING_VERSION = "brand_positioning_v1";

/** Seis dimensões, sempre nesta ordem, iguais para todos os representantes. */
export const BRAND_DIMENSIONS = [
  { key: "qualidade", label: "Qualidade", longLabel: "Qualidade" },
  { key: "preco_competitivo", label: "Preço competitivo", longLabel: "Preço competitivo" },
  { key: "portfolio", label: "Portfólio", longLabel: "Portfólio" },
  { key: "disponibilidade", label: "Disponibilidade", longLabel: "Disponibilidade" },
  { key: "preferencia", label: "Preferência", longLabel: "Preferência e afiliação" },
  { key: "especificacao", label: "Especificação", longLabel: "Especificação" },
] as const;

export type BrandDimensionKey = (typeof BRAND_DIMENSIONS)[number]["key"];

export type BrandDimension = {
  /** 0 a 100. null quando não há evidência suficiente (nunca zero). */
  score: number | null;
  confidence: string | null;
  reading: string | null;
  perspective_ids: string[];
  evidence_count: number | null;
};

export type BrandPositioning = {
  scoring_version: string | null;
  dimensions: Record<BrandDimensionKey, BrandDimension>;
};

export function emptyBrandDimension(): BrandDimension {
  return { score: null, confidence: null, reading: null, perspective_ids: [], evidence_count: null };
}

export type VisaoRep2 = {
  metadata: Metadata;
  executive_view: ExecutiveView;
  /** Presente apenas em relatórios schema 3.0 com view_model executive_brief_v1. */
  executive_brief?: ExecutiveBrief | null;
  /** Opcional: índices analíticos da teia comparativa. Ausente em relatórios antigos. */
  brand_positioning?: BrandPositioning | null;

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

export const VISAO_REP_VIEW_MODEL_BRIEF = "executive_brief_v1";

/** Extrai o major numérico do schema_version ("3.0" → 3; "visao_rep.v2" → 2). */
export function schemaMajor(version: string | null | undefined): number {
  const s = String(version ?? "").trim();
  const direto = /^v?(\d+)/i.exec(s);
  if (direto) return Number(direto[1]);
  const comSufixo = /v(\d+)/i.exec(s);
  return comSufixo ? Number(comSufixo[1]) : 0;
}

/**
 * Relatórios schema 3.0 no modelo executive_brief_v1 substituem
 * "tese central" por "Síntese presidencial" e "sinais prioritários"
 * por "Temas estratégicos".
 */
export function isExecutiveBriefV1(v: VisaoRep2): boolean {
  const vm = (v.metadata.view_model ?? "").trim();
  return schemaMajor(v.metadata.schema_version) >= 3 && vm === VISAO_REP_VIEW_MODEL_BRIEF;
}

export function emptyExecutiveTheme(): ExecutiveTheme {
  return {
    id: null,
    selector: null,
    title: null,
    context: null,
    where_appears: [],
    represents: null,
    decision: null,
    validation: null,
    evidence: null,
    comparison: null,
    confidence: null,
    perspectives: [],
    entities: { produtos: [], concorrentes: [], clientes: [], ferramentas: [], nota: null },
  };
}

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

// ---- Coerção defensiva ----------------------------------------------------
// A IA às vezes devolve objetos ({title, description, impact}) onde o modelo
// canônico espera texto. Renderizar isso quebra a página (React #31), então
// tudo que deve ser texto é achatado aqui, sem perder conteúdo.

const TEXT_KEYS = [
  "text", "texto", "statement", "title", "titulo", "topic", "tema", "name", "nome",
  "finding", "descricao", "description", "detalhe", "detail", "value", "valor",
  "impact", "business_impact", "impacto", "action", "recommended_action", "acao", "quote",
];

function asText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const partes = v.map(asText).filter(Boolean) as string[];
    return partes.length ? partes.join(" · ") : null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const ordenadas = [
      ...TEXT_KEYS.filter(k => k in o),
      ...Object.keys(o).filter(k => !TEXT_KEYS.includes(k)),
    ];
    const partes: string[] = [];
    for (const k of ordenadas) {
      const t = asText(o[k]);
      if (t && !partes.includes(t)) partes.push(t);
    }
    return partes.length ? partes.join(" — ") : null;
  }
  return null;
}

function asTextList(v: unknown): string[] {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map(asText).filter((s): s is string => !!s);
}

const asNum = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Aplica asText a todos os campos de texto conhecidos de um registro. */
function coerceRecord<T extends Record<string, any>>(
  base: T,
  raw: unknown,
  listKeys: (keyof T)[] = [],
  keepKeys: (keyof T)[] = [],
): T {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const out = { ...base } as Record<string, any>;
  for (const k of Object.keys(base)) {
    if (!(k in o)) continue;
    if (keepKeys.includes(k as keyof T)) out[k] = o[k];
    else if (listKeys.includes(k as keyof T)) out[k] = asTextList(o[k]);
    else if (typeof base[k] === "number" || base[k] === null) out[k] = asText(o[k]);
    else out[k] = asText(o[k]) ?? base[k];
  }
  return out as T;
}

const emptySignal: PrioritySignal = {
  title: null, finding: null, business_impact: null, recommended_action: null,
  confidence_level: null, evidence_status: null, source_chapter: null, source_quote: null,
};
const emptyClient: StrategicClient = {
  client_name: null, strategic_reason: null, perceived_potential: null, identified_opportunity: null,
  priority_product_lines: null, main_competitor: null, recommended_next_action: null, attention_point: null,
};
const emptyLine: ProductLineView = {
  product_line: null, summary: null, classification: null, what_works: null, main_barrier: null,
  main_competitor: null, competitor_advantage: null, opportunity: null, recommended_action: null,
  evidence: null, source_quote: null,
};
const emptyConsensus: ConsensusPoint = {
  statement: null, supporting_source_count: null, comparable_source_count: null, supporting_sources: [],
};
const emptyUnaddressed: UnaddressedTopic = {
  statement: null, question_was_asked: null, comparison_is_valid: null, classification: null, methodological_note: null,
};
const emptyDivergence: Divergence = {
  topic: null, predominant_view: null, representative_view: null,
  sources_supporting_predominant_view: [], sources_supporting_representative_view: [], evidence: null,
};
const emptyExclusive: ExclusiveReading = {
  statement: null, region: null, supporting_evidence: null, validation_required: null,
};

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

/** Lista de números de perspectiva (1..8) informada explicitamente no relatório. */
const asNumList = (v: unknown): number[] =>
  asArray(v)
    .map(x => {
      const t = asText(x);
      const n = t ? Number(/(\d{1,2})/.exec(t)?.[1]) : NaN;
      return Number.isFinite(n) ? n : null;
    })
    .filter((n): n is number => n != null && n >= 1 && n <= 8);


function coerceStructuredFields(v: unknown): Record<string, string | string[]> {
  const o = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  const out: Record<string, string | string[]> = {};
  for (const [k, val] of Object.entries(o)) {
    if (Array.isArray(val)) {
      const list = asTextList(val);
      if (list.length) out[k] = list;
    } else {
      const t = asText(val);
      if (t) out[k] = t;
    }
  }
  return out;
}

/** Normaliza o bloco executivo do schema 3.0 sem inventar conteúdo. */
function normalizeExecutiveBrief(raw: unknown): ExecutiveBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, any>;
  const themes = asArray(o.themes).map(t => {
    const th = (t && typeof t === "object" ? t : {}) as Record<string, any>;
    const ent = (th.entities && typeof th.entities === "object" ? th.entities : {}) as Record<string, any>;
    return {
      ...emptyExecutiveTheme(),
      id: asText(th.id),
      selector: asText(th.selector),
      title: asText(th.title),
      context: asText(th.context),
      where_appears: asTextList(th.where_appears),
      represents: asText(th.represents),
      decision: asText(th.decision),
      validation: asText(th.validation),
      evidence: asText(th.evidence),
      comparison: asText(th.comparison),
      confidence: asText(th.confidence),
      perspectives: asTextList(th.perspectives),
      entities: {
        produtos: asTextList(ent.produtos),
        concorrentes: asTextList(ent.concorrentes),
        clientes: asTextList(ent.clientes),
        ferramentas: asTextList(ent.ferramentas),
        nota: asText(ent.nota),
      },
    };
  });
  const synthesis = asText(o.presidential_synthesis);
  if (!synthesis && !themes.length) return null;
  return { presidential_synthesis: synthesis, themes };
}

/** Normaliza a teia comparativa. Retorna null quando o relatório não possui a seção. */
export function normalizeBrandPositioning(raw: unknown): BrandPositioning | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, any>;
  const dimsRaw = (o.dimensions ?? o.dimensoes ?? {}) as Record<string, any>;
  const dimensions = {} as Record<BrandDimensionKey, BrandDimension>;
  let algum = false;
  for (const d of BRAND_DIMENSIONS) {
    const r = (dimsRaw?.[d.key] ?? {}) as Record<string, any>;
    const score = asNum(r.score);
    const dim: BrandDimension = {
      score: score == null ? null : Math.max(0, Math.min(100, score)),
      confidence: asText(r.confidence ?? r.confianca),
      reading: asText(r.reading ?? r.leitura),
      perspective_ids: asTextList(r.perspective_ids ?? r.perspectivas_relacionadas),
      evidence_count: asNum(r.evidence_count ?? r.evidencias_relacionadas),
    };
    if (dim.score != null || dim.reading) algum = true;
    dimensions[d.key] = dim;
  }
  if (!algum) return null;
  return { scoring_version: asText(o.scoring_version) ?? BRAND_POSITIONING_VERSION, dimensions };
}




/** Normaliza um objeto vindo do banco ou da IA (inclusive registros antigos/parciais). */
export function normalizeVisaoRep2(raw: unknown): VisaoRep2 {
  const base = emptyVisaoRep2();
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const ev = (o.executive_view ?? {}) as Record<string, any>;
  const ctx = (o.representative_context ?? {}) as Record<string, any>;
  const cv = (o.comparative_view ?? {}) as Record<string, any>;

  const merged: VisaoRep2 = {
    ...base,
    ...o,
    metadata: { ...base.metadata, ...(o.metadata ?? {}) },
    executive_view: {
      central_thesis: asText(ev.central_thesis) ?? null,
      strategic_risk: asText(ev.strategic_risk) ?? null,
      priority_signals: asArray(ev.priority_signals)
        .map(s =>
          typeof s === "string"
            ? { ...emptySignal, finding: s }
            : {
                ...coerceRecord(emptySignal, s),
                signal_id: asText((s as any)?.signal_id),
                validation_note: asText((s as any)?.validation_note ?? (s as any)?.validacao),
                related_perspectives: asNumList((s as any)?.related_perspectives),
                comparison_classification: asText(
                  (s as any)?.comparison_classification ?? (s as any)?.classificacao_comparativa,
                ),
                comparable_sources: (() => {
                  const raw = (s as any)?.comparable_sources ?? (s as any)?.fontes_comparaveis;
                  const n = typeof raw === "string" ? Number(raw.replace(/[^\d.-]/g, "")) : Number(raw);
                  return Number.isFinite(n) ? n : null;
                })(),
                group_comparison: asText((s as any)?.group_comparison ?? (s as any)?.comparacao_grupo),
              },
        )
        .slice(0, MAX_SIGNALS),

      decisions_required: asTextList(ev.decisions_required).slice(0, MAX_DECISIONS),
      validation_required: asTextList(ev.validation_required).slice(0, MAX_VALIDATIONS),
      final_synthesis: asText(ev.final_synthesis) ?? null,
    },
    executive_brief: normalizeExecutiveBrief(o.executive_brief),
    brand_positioning: normalizeBrandPositioning(o.brand_positioning),


    representative_context: {
      represented_brands: asTextList(ctx.represented_brands),
      region_summary: asText(ctx.region_summary) ?? null,
      service_model: asText(ctx.service_model) ?? null,
      regional_structure: asText(ctx.regional_structure) ?? null,
      additional_context: asText(ctx.additional_context) ?? null,
    },
    strategic_clients: asArray(o.strategic_clients)
      .map(c => (typeof c === "string" ? { ...emptyClient, client_name: c } : coerceRecord(emptyClient, c)))
      .slice(0, MAX_CLIENTS),
    product_line_views: asArray(o.product_line_views).map(l =>
      typeof l === "string" ? { ...emptyLine, product_line: l } : coerceRecord(emptyLine, l),
    ),
    perspectives: PERSPECTIVE_TITLES.map((t, i) => {
      const bruto = asArray(o.perspectives).find((p: any) => Number(p?.perspective_number) === i + 1);
      const p = coerceRecord(emptyPerspective(i), bruto, [], ["perspective_number", "structured_fields"]);
      return {
        ...p,
        perspective_number: i + 1,
        perspective_title: asText((bruto as any)?.perspective_title) || t,
        structured_fields: coerceStructuredFields((bruto as any)?.structured_fields),
        signal_ids: asTextList((bruto as any)?.signal_ids),
      };
    }),
    comparative_view: {
      comparable_source_count: asNum(cv.comparable_source_count),
      comparable_point_count: asNum(cv.comparable_point_count),
      supported_points: asNum(cv.supported_points),
      consensus_points: asArray(cv.consensus_points).map(c =>
        typeof c === "string"
          ? { ...emptyConsensus, statement: c }
          : {
              ...coerceRecord(emptyConsensus, c, ["supporting_sources"]),
              supporting_source_count: asNum((c as any)?.supporting_source_count),
              comparable_source_count: asNum((c as any)?.comparable_source_count),
              signal_id: asText((c as any)?.signal_id),
            },
      ),
      unaddressed_topics: asArray(cv.unaddressed_topics).map(u =>
        typeof u === "string"
          ? { ...emptyUnaddressed, statement: u }
          : {
              ...coerceRecord(emptyUnaddressed, u, [], ["question_was_asked", "comparison_is_valid"]),
              question_was_asked: typeof (u as any)?.question_was_asked === "boolean" ? (u as any).question_was_asked : null,
              comparison_is_valid: typeof (u as any)?.comparison_is_valid === "boolean" ? (u as any).comparison_is_valid : null,
              signal_id: asText((u as any)?.signal_id),
            },
      ),
      divergences: asArray(cv.divergences).map(d =>
        typeof d === "string"
          ? { ...emptyDivergence, topic: d }
          : {
              ...coerceRecord(emptyDivergence, d, ["sources_supporting_predominant_view", "sources_supporting_representative_view"]),
              signal_id: asText((d as any)?.signal_id),
            },
      ),
      exclusive_readings: asArray(cv.exclusive_readings).map(e =>
        typeof e === "string"
          ? { ...emptyExclusive, statement: e }
          : { ...coerceRecord(emptyExclusive, e), signal_id: asText((e as any)?.signal_id) },
      ),

      methodology_note: asText(cv.methodology_note) ?? null,
    },
    performance_connection: { ...base.performance_connection, ...(o.performance_connection ?? {}) },
    source_control: { ...base.source_control, ...(o.source_control ?? {}) },
  };
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

  const briefV1 = isExecutiveBriefV1(v);

  if (briefV1) {
    // Schema 3.0: "Síntese presidencial" e "Temas estratégicos" substituem
    // "tese central" e "sinais prioritários". Estes últimos não são exigidos
    // nem listados como ausentes.
    const brief = v.executive_brief;
    if (!nonEmpty(brief?.presidential_synthesis ?? null)) missingRequired.push("Síntese presidencial");
    else recognized.push("Síntese presidencial");

    const temas = brief?.themes ?? [];
    if (!temas.length) missingRequired.push("Temas estratégicos");
    else recognized.push(`Temas estratégicos › ${temas.length} tema(s)`);
  } else {
    if (!nonEmpty(v.executive_view.central_thesis)) missingRequired.push("Visão executiva › tese central");
    else recognized.push("Visão executiva › tese central");

    if (!v.executive_view.priority_signals.length) missingRequired.push("Visão executiva › sinais prioritários");
    else recognized.push(`Visão executiva › ${v.executive_view.priority_signals.length} sinal(is) prioritário(s)`);
  }

  // Teia comparativa: sempre opcional. Relatórios antigos seguem válidos.
  if (v.brand_positioning) {
    const preenchidas = BRAND_DIMENSIONS.filter(d => v.brand_positioning?.dimensions[d.key]?.score != null).length;
    recognized.push(`Teia comparativa de posicionamento › ${preenchidas}/${BRAND_DIMENSIONS.length} dimensões`);
  }


  const comPersp = v.perspectives.filter(p => nonEmpty(p.executive_finding) || nonEmpty(p.full_reading));
  if (!comPersp.length) {
    // No briefing executivo as perspectivas podem viver dentro dos temas;
    // ausência só é impeditiva quando não há tema algum.
    if (!briefV1 || !(v.executive_brief?.themes.length ?? 0)) missingRequired.push("Perspectivas da entrevista");
  } else recognized.push(`Perspectivas › ${comPersp.length} de 8 preenchidas`);


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
