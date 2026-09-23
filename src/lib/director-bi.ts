import { AREA_LABEL, type ExecArea } from "@/lib/executive-report/types";
import type { KCard, KanbanPriority } from "@/lib/kanban-types";

export const DIRECTOR_AREAS: ExecArea[] = ["commercial", "governance", "marketing", "product"];
export type DirectorFilter = "active" | "completed" | "all";

export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/** Categorias são os próprios quadros, incluindo nomes legados das migrações. */
export function directorArea(boardName: string): ExecArea | null {
  const name = normalize(boardName);
  const area = DIRECTOR_AREAS.find((key) => normalize(AREA_LABEL[key]) === name);
  if (area) return area;
  const legacy: Record<string, ExecArea> = {
    "planos de acao": "commercial",
    diretoria: "governance",
    "inteligencia de mercado": "marketing",
    produtos: "product",
  };
  return legacy[name] ?? null;
}

export function metaText(metadata: Record<string, unknown>, key: string): string {
  return typeof metadata[key] === "string" ? metadata[key] : "";
}

export type DirectorAction = KCard & {
  area: ExecArea | null;
  stage: string;
  responsible: string;
  representative: string;
  checklistDone: number;
  checklistTotal: number;
};

export function isDirectorComplete(action: Pick<DirectorAction, "completed_at" | "stage">) {
  // Arrastar para a lista final não preenche completed_at no Kanban atual.
  return (
    Boolean(action.completed_at) || ["concluido", "concluida"].includes(normalize(action.stage))
  );
}

/** Prazo é uma data civil, inclusive quando o editor a grava à meia-noite UTC. */
export function dueState(due: string | null, completed: boolean, now = new Date()) {
  if (!due || completed) return null;
  const day = Date.parse(due.slice(0, 10) + "T00:00:00Z");
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((day - today) / 86_400_000);
  if (!Number.isFinite(days)) return null;
  if (days < 0) return "Atrasada";
  if (days === 0) return "Vence hoje";
  if (days <= 3) return "Prazo próximo";
  return null;
}

export function shortDescription(description: string | null) {
  const text = (description ?? "").replace(/\s+/g, " ").trim();
  return text.length > 150 ? text.slice(0, 147).trimEnd() + "…" : text;
}

/** Ações visíveis no BI Diretor, em qualquer área, ignorando arquivadas. */
export function visibleDirectorActions(actions: DirectorAction[]) {
  return actions.filter(
    (action) => action.metadata?.show_in_director_bi === true && !action.archived_at,
  );
}

export type DirectorStatusBucket = "todo" | "in_progress" | "overdue" | "completed";

export function directorStatusBucket(
  action: Pick<DirectorAction, "stage" | "due_date" | "completed_at">,
): DirectorStatusBucket {
  if (isDirectorComplete(action)) return "completed";
  if (dueState(action.due_date, false) === "Atrasada") return "overdue";
  return normalize(action.stage) === "a fazer" ? "todo" : "in_progress";
}

export type DirectorKpis = {
  total: number;
  inProgress: number;
  overdue: number;
  completed: number;
  activeResponsibles: number;
};

/** KPIs do cabeçalho do BI Diretor, sobre todas as áreas visíveis. */
export function computeDirectorKpis(actions: DirectorAction[]): DirectorKpis {
  const visible = visibleDirectorActions(actions);
  let inProgress = 0;
  let overdue = 0;
  let completed = 0;
  const activeResponsibles = new Set<string>();
  for (const action of visible) {
    const bucket = directorStatusBucket(action);
    if (bucket === "in_progress" || bucket === "todo") {
      inProgress += bucket === "in_progress" ? 1 : 0;
      activeResponsibles.add(action.responsible);
    } else if (bucket === "overdue") {
      overdue += 1;
      activeResponsibles.add(action.responsible);
    } else {
      completed += 1;
    }
  }
  return {
    total: visible.length,
    inProgress,
    overdue,
    completed,
    activeResponsibles: activeResponsibles.size,
  };
}

export type DirectorStatusCount = { bucket: DirectorStatusBucket; label: string; value: number };

const STATUS_BUCKET_LABEL: Record<DirectorStatusBucket, string> = {
  in_progress: "Em andamento",
  todo: "A Fazer",
  completed: "Concluídas",
  overdue: "Atrasadas",
};

/** Distribuição das ações visíveis por status, para o gráfico de rosca. */
export function computeStatusBreakdown(actions: DirectorAction[]): DirectorStatusCount[] {
  const visible = visibleDirectorActions(actions);
  const counts: Record<DirectorStatusBucket, number> = {
    in_progress: 0,
    todo: 0,
    completed: 0,
    overdue: 0,
  };
  for (const action of visible) counts[directorStatusBucket(action)] += 1;
  return (["in_progress", "todo", "completed", "overdue"] as const).map((bucket) => ({
    bucket,
    label: STATUS_BUCKET_LABEL[bucket],
    value: counts[bucket],
  }));
}

export type DirectorResponsibleCount = { responsible: string; value: number };

/** Quantidade de ações visíveis por responsável, para o gráfico de barras. */
export function computeActionsByResponsible(actions: DirectorAction[]): DirectorResponsibleCount[] {
  const visible = visibleDirectorActions(actions);
  const counts = new Map<string, number>();
  for (const action of visible)
    counts.set(action.responsible, (counts.get(action.responsible) ?? 0) + 1);
  return Array.from(counts, ([responsible, value]) => ({ responsible, value })).sort(
    (a, b) => b.value - a.value || a.responsible.localeCompare(b.responsible, "pt-BR"),
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function filterDirectorActions(
  actions: DirectorAction[],
  area: ExecArea,
  filter: DirectorFilter,
  repId = "all",
) {
  const priority: Record<KanbanPriority, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
  return actions
    .filter((action) => {
      if (
        action.metadata?.show_in_director_bi !== true ||
        action.archived_at ||
        action.area !== area
      )
        return false;
      if (area === "commercial" && repId !== "all" && action.metadata.rep_id !== repId)
        return false;
      const complete = isDirectorComplete(action);
      return filter === "all" || (filter === "completed" ? complete : !complete);
    })
    .sort((a, b) => {
      const aDone = isDirectorComplete(a),
        bDone = isDirectorComplete(b);
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (aDone) {
        const delta =
          Date.parse(b.completed_at ?? b.updated_at) - Date.parse(a.completed_at ?? a.updated_at);
        if (delta) return delta;
      } else {
        if (Boolean(a.due_date) !== Boolean(b.due_date)) return a.due_date ? -1 : 1;
        const due = (a.due_date?.slice(0, 10) ?? "").localeCompare(b.due_date?.slice(0, 10) ?? "");
        if (due) return due;
        const rank = priority[a.priority] - priority[b.priority];
        if (rank) return rank;
      }
      return a.title.localeCompare(b.title, "pt-BR") || a.id.localeCompare(b.id);
    });
}
