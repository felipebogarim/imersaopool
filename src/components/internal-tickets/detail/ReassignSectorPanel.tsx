import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reassignInternalTicketSector } from "@/lib/internal-tickets/tickets.functions";
import type { Sector } from "@/lib/internal-tickets/queries";

export function ReassignSectorPanel({
  ticketId,
  currentSectorId,
  currentSectorName,
  sectors,
}: {
  ticketId: string;
  currentSectorId: string;
  currentSectorName: string;
  sectors: Sector[];
}) {
  const qc = useQueryClient();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      reassignInternalTicketSector({
        data: { ticketId, toSectorId: target, reason: reason.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success("Ticket encaminhado");
      setTarget("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["internal-ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["internal-ticket-events", ticketId] });
      qc.invalidateQueries({ queryKey: ["internal-ticket-sector-stops", ticketId] });
      qc.invalidateQueries({ queryKey: ["internal-tickets"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao encaminhar o ticket"),
  });

  const options = sectors.filter((s) => s.active && s.id !== currentSectorId);

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Encaminhar para outro setor
      </p>
      <p className="text-xs text-muted-foreground">
        Setor atual: <span className="text-foreground">{currentSectorName}</span>
      </p>
      <Select value={target} onValueChange={setTarget}>
        <SelectTrigger className="h-8 w-56 text-xs">
          <SelectValue placeholder="Selecione o setor de destino" />
        </SelectTrigger>
        <SelectContent>
          {options.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {target && (
        <div className="space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo do encaminhamento (opcional)"
            rows={2}
          />
          <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Encaminhar
          </Button>
        </div>
      )}
    </div>
  );
}
