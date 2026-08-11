import type { KCard } from "./kanban-types";

export type SuggestedStatus = "pendente" | "aprovada" | "reprovada";

export type SuggestedAction = {
  suggested: boolean;
  status: SuggestedStatus;
  decided_by_name?: string | null;
  decided_at?: string | null;
  note?: string | null;
};

export function getSuggested(card: Pick<KCard, "metadata">): SuggestedAction {
  const m = (card.metadata ?? {}) as any;
  const s = m.suggested_action;
  if (!s || typeof s !== "object") return { suggested: false, status: "pendente" };
  const status: SuggestedStatus =
    s.status === "aprovada" || s.status === "reprovada" ? s.status : "pendente";
  return {
    suggested: !!s.suggested,
    status,
    decided_by_name: s.decided_by_name ?? null,
    decided_at: s.decided_at ?? null,
    note: s.note ?? null,
  };
}

export function withSuggested(
  card: Pick<KCard, "metadata">,
  next: SuggestedAction | null,
): Record<string, unknown> {
  const m = { ...((card.metadata ?? {}) as Record<string, unknown>) };
  if (next === null) delete m.suggested_action;
  else m.suggested_action = next;
  return m;
}

export const SUGGESTED_LABEL: Record<SuggestedStatus, string> = {
  pendente: "Aguardando aprovação",
  aprovada: "Ação aprovada",
  reprovada: "Ação reprovada",
};

export const SUGGESTED_COLOR: Record<SuggestedStatus, string> = {
  pendente: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  aprovada: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  reprovada: "bg-red-500/15 text-red-700 dark:text-red-300",
};
