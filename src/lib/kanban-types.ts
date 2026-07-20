export type KanbanPriority = "baixa" | "media" | "alta" | "urgente";
export type KanbanRole = "owner" | "admin" | "member" | "observer";

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  created_by: string;
  company_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string | null;
  cover_image: string | null;
  position: number;
  visibility: string;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KList {
  id: string;
  board_id: string;
  name: string;
  position: number;
  color: string | null;
  wip_limit: number | null;
  archived_at: string | null;
}

export interface KLabel {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface KCard {
  id: string;
  list_id: string;
  board_id: string;
  title: string;
  description: string | null;
  position: number;
  priority: KanbanPriority;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  cover_color: string | null;
  cover_image: string | null;
  archived_at: string | null;
  created_by: string;
  origin_action_plan_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const PRIORITY_LABEL: Record<KanbanPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORITY_COLOR: Record<KanbanPriority, string> = {
  baixa: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  media: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  alta: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgente: "bg-red-500/15 text-red-700 dark:text-red-300",
};

/** Simple gap-based ordering: pass the two neighbors and get a midpoint. */
export function midPosition(prev: number | null, next: number | null): number {
  if (prev == null && next == null) return 1000;
  if (prev == null) return (next as number) - 500;
  if (next == null) return prev + 1000;
  return (prev + next) / 2;
}
