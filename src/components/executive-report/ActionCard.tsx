import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Pencil, X } from "lucide-react";
import {
  AREA_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  type ExecutiveAction,
} from "@/lib/executive-report/types";

export function StatusBadge({ status }: { status: ExecutiveAction["status"] }) {
  const variant =
    status === "validated" || status === "edited"
      ? "default"
      : status === "rejected"
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant as any} className="text-[10px] uppercase tracking-wide">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function OriginBadge({ existing }: { existing?: boolean }) {
  return existing ? (
    <Badge
      variant="outline"
      className="border-amber-500/40 bg-amber-500/10 text-[10px] uppercase tracking-wide text-amber-700"
    >
      Ação já sugerida
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 text-[10px] uppercase tracking-wide text-emerald-700"
    >
      Nova sugestão
    </Badge>
  );
}

export function ActionCard({
  action,
  readOnly,
  origin,
  onValidate,
  onEdit,
  onReject,
}: {
  action: ExecutiveAction;
  readOnly?: boolean;
  /** Vínculo com a ação já existente na Gestão de Tarefas, quando houver. */
  origin?: { existing: boolean; displayTitle: string };
  onValidate?: () => void;
  onEdit?: () => void;
  onReject?: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {AREA_LABEL[action.area]}
        </Badge>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          Prioridade {PRIORITY_LABEL[action.priority]}
        </Badge>
        <StatusBadge status={action.status} />
        {origin && <OriginBadge existing={origin.existing} />}
      </div>
      <p className="mt-2 font-medium leading-snug">{origin?.displayTitle || action.title}</p>
      {action.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
      ) : null}

      {(action.owner || action.due_date || action.note) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {action.owner ? `Responsável: ${action.owner}` : ""}
          {action.owner && action.due_date ? " · " : ""}
          {action.due_date ? `Prazo: ${action.due_date}` : ""}
          {action.note ? `${action.owner || action.due_date ? " · " : ""}${action.note}` : ""}
        </p>
      )}
      {action.status === "rejected" && action.reject_reason ? (
        <p className="mt-2 text-xs text-destructive">Motivo: {action.reject_reason}</p>
      ) : null}
      {!readOnly && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={onValidate} disabled={action.status === "validated"}>
            <Check className="mr-1 h-4 w-4" /> Validar
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="mr-1 h-4 w-4" /> Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject} disabled={action.status === "rejected"}>
            <X className="mr-1 h-4 w-4" /> Rejeitar
          </Button>
        </div>
      )}
    </div>
  );
}
