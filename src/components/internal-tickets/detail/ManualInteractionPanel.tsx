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
import { logManualInteraction } from "@/lib/internal-tickets/tickets.functions";

type Channel = "manual_presencial" | "manual_telefone";

export function ManualInteractionPanel({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<Channel>("manual_presencial");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () => logManualInteraction({ data: { ticketId, channel, note: note.trim() } }),
    onSuccess: () => {
      toast.success("Interação registrada");
      setNote("");
      qc.invalidateQueries({ queryKey: ["internal-ticket-messages", ticketId] });
      qc.invalidateQueries({ queryKey: ["internal-ticket-events", ticketId] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao registrar interação"),
  });

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Registrar interação manual
      </p>
      <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
        <SelectTrigger className="h-8 w-48 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="manual_presencial">Presencial</SelectItem>
          <SelectItem value="manual_telefone">Telefone</SelectItem>
        </SelectContent>
      </Select>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="O que foi conversado?"
        rows={3}
      />
      <Button
        size="sm"
        disabled={!note.trim() || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Registrar
      </Button>
    </div>
  );
}
