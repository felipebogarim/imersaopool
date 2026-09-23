import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  allowedNextStatuses,
  TICKET_STATUS_LABEL,
  type TicketStatus,
} from "@/lib/internal-tickets/status";
import { updateInternalTicketStatus } from "@/lib/internal-tickets/tickets.functions";

export function StatusChangePanel({
  ticketId,
  currentStatus,
}: {
  ticketId: string;
  currentStatus: TicketStatus;
}) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<TicketStatus | "">("");
  const [observation, setObservation] = useState("");
  const nextStatuses = allowedNextStatuses(currentStatus);

  const mutation = useMutation({
    mutationFn: () =>
      updateInternalTicketStatus({
        data: {
          ticketId,
          toStatus: target as TicketStatus,
          observation: observation.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Status atualizado");
      setTarget("");
      setObservation("");
      qc.invalidateQueries({ queryKey: ["internal-ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["internal-ticket-events", ticketId] });
      qc.invalidateQueries({ queryKey: ["internal-tickets"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar status"),
  });

  if (nextStatuses.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Mudar status
      </p>
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={target === s ? "default" : "outline"}
            onClick={() => setTarget(s)}
          >
            {TICKET_STATUS_LABEL[s]}
          </Button>
        ))}
      </div>
      {target && (
        <div className="space-y-2">
          <Textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Observação (opcional)"
            rows={2}
          />
          <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar {TICKET_STATUS_LABEL[target]}
          </Button>
        </div>
      )}
    </div>
  );
}
