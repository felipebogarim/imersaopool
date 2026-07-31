// Modelo de leitura integrada da Visão Rep 2 (exclusivo da V2).
// Fonte única de verdade por sinal executivo: a conclusão vive no sinal,
// as evidências vivem nas perspectivas e a comparação vive no paralelo.
// Nada é inventado: quando o relatório não traz vínculos, eles ficam vazios.

import type {
  ComparativeView,
  ConfidenceLevel,
  EvidenceStatus,
  Perspective,
  PrioritySignal,
  VisaoRep2,
} from "./visao-rep2-schema";

export type ComparisonKind = "consenso" | "nao_abordado" | "divergencia" | "exclusiva";

export const COMPARISON_LABEL: Record<ComparisonKind, string> = {
  consenso: "Confirma o grupo",
  nao_abordado: "Tema não abordado",
  divergencia: "Divergência",
  exclusiva: "Leitura exclusiva",
};

/** Cores já usadas no Paralelo da Visão Rep — mantidas, sem nova paleta. */
export const COMPARISON_TONE: Record<ComparisonKind, string> = {
  consenso: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  nao_abordado: "bg-muted text-muted-foreground",
  divergencia: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  exclusiva: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

export type ComparisonItem = {
  kind: ComparisonKind;
  signal_id: string | null;
  summary: string;
  details: { label: string; value: string }[];
  sources: string[];
  supporting?: number | null;
  comparable?: number | null;
  note?: string | null;
  /** Rótulo/cor derivados de `classificacao_comparativa` do próprio sinal. */
  labelOverride?: string | null;
  toneOverride?: string | null;
};

/** "confirma_o_grupo_com_leitura_regional" → "Confirma o grupo com leitura regional". */
export function formatComparisonClassification(raw: string): string {
  const t = raw.replace(/_/g, " ").trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Cor por família de classificação; o rótulo continua legível sem a cor. */
export function toneForClassification(raw: string | null | undefined): string {
  const v = (raw ?? "").toLowerCase();
  if (v.startsWith("confirma_o_grupo")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (v.startsWith("convergencia_parcial")) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  if (v.startsWith("leitura_exclusiva") || v.startsWith("leitura_regional"))
    return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  if (v.startsWith("divergencia")) return "bg-orange-500/15 text-orange-700 dark:text-orange-300";
  return "bg-muted text-muted-foreground";
}

/** Comparação declarada dentro do próprio sinal (relatórios novos). */
function comparisonFromSignal(s: PrioritySignal, id: string): ComparisonItem | null {
  if (!has(s.group_comparison ?? "")) return null;
  const cls = has(s.comparison_classification ?? "") ? (s.comparison_classification as string) : null;
  const kind: ComparisonKind = !cls
    ? "consenso"
    : cls.toLowerCase().startsWith("divergencia")
      ? "divergencia"
      : cls.toLowerCase().startsWith("leitura")
        ? "exclusiva"
        : cls.toLowerCase().startsWith("sem_comparacao")
          ? "nao_abordado"
          : "consenso";
  return {
    kind,
    signal_id: id,
    summary: (s.group_comparison as string).trim(),
    details: [],
    sources: [],
    supporting: null,
    comparable: s.comparable_sources ?? null,
    labelOverride: cls ? formatComparisonClassification(cls) : null,
    toneOverride: cls ? toneForClassification(cls) : null,
  };
}

export type EntityGroup = { label: string; items: string[] };

export type PerspectiveEvidence = {
  perspective: Perspective;
  finding: string | null;
  entities: EntityGroup[];
  examples: string[];
  evidence: string | null;
  quotes: string[];
  fullReading: string | null;
};

export type LeituraSignal = {
  id: string;
  index: number;
  title: string;
  conclusion: string | null;
  businessImpact: string | null;
  decision: string | null;
  validation: string | null;
  confidence: ConfidenceLevel | null;
  evidence: EvidenceStatus | null;
  perspectives: PerspectiveEvidence[];
  comparisons: ComparisonItem[];
};

const has = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export const signalIdFor = (s: PrioritySignal, i: number) =>
  has(s.signal_id) ? clean(s.signal_id) : `SE_${String(i + 1).padStart(2, "0")}`;

/** Quebra um texto em frases utilizáveis como cards de exemplo. */
function sentences(text: string | null | undefined): string[] {
  if (!has(text)) return [];
  return text
    .split(/(?<=[.;!?])\s+(?=[A-ZÀ-Ú0-9"“])|\n+/)
    .map(clean)
    .filter(s => s.length > 12);
}

const ENTITY_KEYS: { match: RegExp; label: string }[] = [
  { match: /produto|linha|familia|família/i, label: "Produtos e linhas" },
  { match: /marca|concorrente/i, label: "Marcas e concorrentes" },
  { match: /cliente|loja|revend/i, label: "Clientes e lojas" },
  { match: /ferramenta|sistema|app|aplicativo/i, label: "Ferramentas" },
];

/** Entidades citadas — lidas apenas de campos estruturados declarados no relatório. */
function entitiesOf(p: Perspective): EntityGroup[] {
  const groups = new Map<string, string[]>();
  for (const [k, v] of Object.entries(p.structured_fields ?? {})) {
    const def = ENTITY_KEYS.find(e => e.match.test(k));
    if (!def) continue;
    const items = (Array.isArray(v) ? v : String(v).split(/[,;·]/))
      .map(clean)
      .filter(s => s.length > 1 && s.length <= 48);
    if (!items.length) continue;
    groups.set(def.label, [...new Set([...(groups.get(def.label) ?? []), ...items])].slice(0, 12));
  }
  return [...groups].map(([label, items]) => ({ label, items }));
}

function evidenceOf(p: Perspective): PerspectiveEvidence {
  const quotes = [...new Set([p.source_quote].filter(has).map(clean))];
  const examples = sentences(p.evidence).slice(0, 4);
  return {
    perspective: p,
    finding: p.executive_finding,
    entities: entitiesOf(p),
    examples,
    evidence: has(p.evidence) && !examples.length ? p.evidence : null,
    quotes,
    fullReading: p.full_reading,
  };
}

function comparisonsOf(cv: ComparativeView): ComparisonItem[] {
  const out: ComparisonItem[] = [];
  for (const c of cv.consensus_points) {
    if (!has(c.statement)) continue;
    out.push({
      kind: "consenso",
      signal_id: c.signal_id ?? null,
      summary: c.statement,
      details: [],
      sources: c.supporting_sources ?? [],
      supporting: c.supporting_source_count,
      comparable: c.comparable_source_count,
    });
  }
  for (const t of cv.unaddressed_topics) {
    if (!has(t.statement)) continue;
    out.push({
      kind: "nao_abordado",
      signal_id: t.signal_id ?? null,
      summary: t.statement,
      details: [
        ...(has(t.classification) ? [{ label: "Classificação", value: t.classification }] : []),
        ...(t.question_was_asked === false ? [{ label: "Pergunta", value: "Não foi feita nesta entrevista" }] : []),
      ],
      sources: [],
      note: t.methodological_note,
    });
  }
  for (const d of cv.divergences) {
    const titulo = has(d.topic) ? d.topic : has(d.representative_view) ? d.representative_view : null;
    if (!titulo) continue;
    out.push({
      kind: "divergencia",
      signal_id: d.signal_id ?? null,
      summary: titulo,
      details: [
        ...(has(d.representative_view) ? [{ label: "Leitura do representante", value: d.representative_view }] : []),
        ...(has(d.predominant_view) ? [{ label: "Leitura predominante", value: d.predominant_view }] : []),
        ...(has(d.evidence) ? [{ label: "Evidência", value: d.evidence }] : []),
      ],
      sources: [...(d.sources_supporting_predominant_view ?? []), ...(d.sources_supporting_representative_view ?? [])],
    });
  }
  for (const e of cv.exclusive_readings) {
    if (!has(e.statement)) continue;
    out.push({
      kind: "exclusiva",
      signal_id: e.signal_id ?? null,
      summary: e.statement,
      details: [
        ...(has(e.region) ? [{ label: "Região", value: e.region }] : []),
        ...(has(e.supporting_evidence) ? [{ label: "Evidência", value: e.supporting_evidence }] : []),
        ...(has(e.validation_required) ? [{ label: "Validação necessária", value: e.validation_required }] : []),
      ],
      sources: [],
    });
  }
  return out;
}

export type LeituraIntegrada = {
  signals: LeituraSignal[];
  /** Verdadeiro quando o relatório não traz nenhum vínculo entre sinais, perspectivas e paralelo. */
  semVinculos: boolean;
  comparableSourceCount: number | null;
  supportedPoints: number | null;
  comparablePointCount: number | null;
  methodologyNote: string | null;
};

export function buildLeituraIntegrada(v: VisaoRep2): LeituraIntegrada {
  const cv = v.comparative_view;
  const todasComparacoes = comparisonsOf(cv);
  const sinaisBrutos = v.executive_view.priority_signals.slice(0, 5);

  const signals: LeituraSignal[] = sinaisBrutos.map((s, i) => {
    const id = signalIdFor(s, i);
    const explicitas = new Set(s.related_perspectives ?? []);
    const relacionadas = v.perspectives.filter(
      p => explicitas.has(p.perspective_number) || (p.signal_ids ?? []).some(x => clean(x) === id),
    );
    return {
      id,
      index: i + 1,
      title: has(s.title) ? s.title : `Sinal ${i + 1}`,
      conclusion: s.finding,
      businessImpact: s.business_impact,
      decision: s.recommended_action,
      validation: s.validation_note ?? null,
      confidence: s.confidence_level,
      evidence: s.evidence_status,
      perspectives: relacionadas.map(evidenceOf),
      comparisons: [
        ...(comparisonFromSignal(s, id) ? [comparisonFromSignal(s, id) as ComparisonItem] : []),
        ...todasComparacoes.filter(c => has(c.signal_id) && clean(c.signal_id) === id),
      ],
    };
  });

  const semVinculos =
    signals.length > 0 && signals.every(s => s.perspectives.length === 0 && s.comparisons.length === 0);

  return {
    signals,
    semVinculos,
    comparableSourceCount: cv.comparable_source_count,
    supportedPoints: cv.supported_points,
    comparablePointCount: cv.comparable_point_count,
    methodologyNote: cv.methodology_note,
  };
}
