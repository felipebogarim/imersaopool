// Modelo único do Relatório Executivo da Visão Imersão 2.
// Um único modelo alimenta três renderers: web, PDF e e-mail.

export type ExecArea = "commercial" | "product" | "marketing" | "governance";
export type ExecPriority = "high" | "medium" | "low";
export type ExecStatus = "suggested" | "validated" | "edited" | "rejected";

export const AREA_LABEL: Record<ExecArea, string> = {
  commercial: "Comercial",
  product: "Produto",
  marketing: "Marketing",
  governance: "Governança",
};

export const PRIORITY_LABEL: Record<ExecPriority, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const STATUS_LABEL: Record<ExecStatus, string> = {
  suggested: "Sugerida",
  validated: "Validada",
  edited: "Editada",
  rejected: "Rejeitada",
};

export const AREAS: ExecArea[] = ["commercial", "product", "marketing", "governance"];
export const PRIORITIES: ExecPriority[] = ["high", "medium", "low"];
export const STATUSES: ExecStatus[] = ["suggested", "validated", "edited", "rejected"];

export type ExecutiveActionHistoryEntry = {
  at: string;
  by?: string | null;
  action: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  note?: string;
};

export type ExecutiveAction = {
  /** id do arquivo (external_id no banco) */
  id: string;
  /** id interno (uuid) quando persistido */
  row_id?: string;
  source_decision_id?: string | null;
  area: ExecArea;
  priority: ExecPriority;
  title: string;
  description?: string | null;
  status: ExecStatus;
  owner?: string | null;
  due_date?: string | null;
  note?: string | null;
  reject_reason?: string | null;
  history: ExecutiveActionHistoryEntry[];
  ordem: number;
  validated_at?: string | null;
  validated_by?: string | null;
};

export type ExecutiveEvidence = {
  quote: string;
  author?: string | null;
  role?: string | null;
};

export type ExecutiveDecisionBlock = {
  id: string;
  title: string;
  cause: string;
  impact: string;
  evidence?: ExecutiveEvidence | null;
  action_ids: string[];
};

export type ExecutiveNonPriority = {
  id?: string;
  title: string;
  cause?: string | null;
  decision?: string | null;
};

export type ExecutiveClient = {
  display_name: string;
  visit_date?: string | null;
  location?: string | null;
  representative?: string | null;
  consultant?: string | null;
  category?: string | null;
  attainment?: string | null;
};

export type ExecutiveReportData = {
  id?: string;
  immersion_report_id?: string;
  status: "review" | "closed";
  report_title: string;
  source_filename?: string | null;
  source_schema?: string | null;
  companyName?: string | null;
  client: ExecutiveClient;
  executive_reading: string;
  brands_observed: string[];
  decision_blocks: ExecutiveDecisionBlock[];
  do_not_prioritize: ExecutiveNonPriority[];
  actions: ExecutiveAction[];
  email: { subject?: string | null; intro?: string | null };
  current_version: number;
};

/**
 * Ações indicadas no relatório que não foram referenciadas por nenhum bloco de
 * decisão. É mandatório exibi-las: 100% das ações do arquivo entram no relatório.
 */
export function unassignedActions(data: ExecutiveReportData): ExecutiveAction[] {
  const used = new Set(data.decision_blocks.flatMap((b) => b.action_ids));
  return data.actions.filter((a) => !used.has(a.id));
}

export function actionCounts(actions: ExecutiveAction[]) {
  const c = { total: actions.length, suggested: 0, validated: 0, edited: 0, rejected: 0 };
  for (const a of actions) c[a.status] += 1;
  return c;
}

/** Somente ações validadas/editadas entram na versão final e no PDF. */
export function finalActions(actions: ExecutiveAction[]) {
  return actions.filter((a) => a.status === "validated" || a.status === "edited");
}

/** No e-mail mostramos também as ações ainda em validação (tudo menos rejeitadas). */
export function emailActions(actions: ExecutiveAction[]) {
  return actions.filter((a) => a.status !== "rejected");
}

/** Versão do relatório para e-mail: mantém ações sugeridas com tag "Em validação". */
export function toEmailData(data: ExecutiveReportData): ExecutiveReportData {
  const keep = new Set(emailActions(data.actions).map((a) => a.id));
  return {
    ...data,
    actions: data.actions.filter((a) => keep.has(a.id)),
    decision_blocks: data.decision_blocks.map((b) => ({
      ...b,
      action_ids: b.action_ids.filter((id) => keep.has(id)),
    })),
  };
}


export function canClose(actions: ExecutiveAction[]) {
  return actions.length > 0 && actions.every((a) => a.status !== "suggested");
}

/** Versão do relatório contendo apenas o que entra no documento final. */
export function toFinalData(data: ExecutiveReportData): ExecutiveReportData {
  const keep = new Set(finalActions(data.actions).map((a) => a.id));
  return {
    ...data,
    actions: data.actions.filter((a) => keep.has(a.id)),
    decision_blocks: data.decision_blocks.map((b) => ({
      ...b,
      action_ids: b.action_ids.filter((id) => keep.has(id)),
    })),
  };
}

export function formatVisitDate(value?: string | null): string {
  if (!value) return "—";
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}
