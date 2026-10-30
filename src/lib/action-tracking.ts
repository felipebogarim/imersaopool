// Evolução das Ações — tipos e helpers puros (sem acesso a banco).

export const ACTION_STATUSES = ["nao_iniciado", "em_andamento", "concluido"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

export const ACTION_FILES_BUCKET = "action-updates";
export const ACTION_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const ACTION_REQUEST_TTL_DAYS = 14;
/** Intervalo mínimo entre duas cobranças semanais para o mesmo representante. */
export const ACTION_REQUEST_MIN_INTERVAL_DAYS = 6;

export function isActionStatus(v: unknown): v is ActionStatus {
  return typeof v === "string" && (ACTION_STATUSES as readonly string[]).includes(v);
}

/** Ação sem linha em kanban_action_tracking conta como "não iniciado". */
export function statusOrDefault(v: unknown): ActionStatus {
  return isActionStatus(v) ? v : "nao_iniciado";
}

export type ActionCardMeta = {
  rep_id?: string;
  rep_name?: string;
  client_id?: string;
  client_name?: string;
  responsible_id?: string;
  responsible_name?: string;
};

export function readActionMeta(metadata: unknown): ActionCardMeta {
  const m = (metadata && typeof metadata === "object" ? metadata : {}) as Record<string, unknown>;
  const s = (k: string) => (typeof m[k] === "string" && m[k] ? (m[k] as string) : undefined);
  return {
    rep_id: s("rep_id"),
    rep_name: s("rep_name"),
    client_id: s("client_id"),
    client_name: s("client_name"),
    responsible_id: s("responsible_id"),
    responsible_name: s("responsible_name"),
  };
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(-120) || "arquivo";
}

export function formatPrazo(due: string | null | undefined): string {
  if (!due) return "—";
  const d = new Date(due);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function isOverdue(due: string | null | undefined, status: ActionStatus, now = new Date()) {
  if (!due || status === "concluido") return false;
  const d = new Date(due);
  return !Number.isNaN(d.getTime()) && d.getTime() < now.getTime() - 86_400_000;
}

export type PendenciaInput = {
  description: string;
  assigneeUserId?: string | null;
  assigneeName: string;
};

export type ActionUpdateInput = {
  cardId: string;
  status?: ActionStatus | null;
  note?: string | null;
  pendencias?: PendenciaInput[];
  files?: { path: string; name: string; mime?: string | null; size?: number | null }[];
};

/** Só vira registro o que o representante de fato preencheu/alterou. */
export function hasUpdateContent(u: ActionUpdateInput, currentStatus: ActionStatus): boolean {
  const statusChanged = u.status != null && u.status !== currentStatus;
  return Boolean(
    statusChanged ||
    u.note?.trim() ||
    u.pendencias?.some((p) => p.description.trim() && p.assigneeName.trim()) ||
    u.files?.length,
  );
}
