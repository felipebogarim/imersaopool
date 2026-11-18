import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrazo } from "@/lib/action-tracking";
import { decideExtension } from "@/lib/rep-portal.functions";

export type PendingExtension = {
  id: string;
  card_id: string;
  current_due: string | null;
  requested_due: string;
  justification: string;
  created_at: string;
  title: string;
  rep: string;
};

/** Pedidos de prorrogação feitos pelos representantes: a equipe aprova (muda o prazo) ou recusa. */
export function ExtensionsDialog({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: PendingExtension[];
}) {
  const qc = useQueryClient();
  const decideFn = useServerFn(decideExtension);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const decide = useMutation({
    mutationFn: (v: { id: string; decision: "aprovada" | "recusada" }) =>
      decideFn({ data: { ...v, note: notes[v.id] || undefined } }),
    onSuccess: (_r, v) => {
      toast.success(v.decision === "aprovada" ? "Prazo atualizado." : "Pedido recusado.");
      void qc.invalidateQueries({ queryKey: ["acoes-reps"] });
      void qc.invalidateQueries({ queryKey: ["acoes-reps-ext"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pedidos de prorrogação</DialogTitle>
          <DialogDescription>
            Aprovar atualiza o prazo da ação e avisa o representante por e-mail.
          </DialogDescription>
        </DialogHeader>
        {!items.length && <p className="text-sm text-muted-foreground">Nenhum pedido pendente.</p>}
        <ul className="space-y-3">
          {items.map((x) => (
            <li key={x.id} className="space-y-2 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{x.title}</p>
                <p className="text-xs text-muted-foreground">
                  {x.rep} · prazo {formatPrazo(x.current_due)} →{" "}
                  <strong>{formatPrazo(x.requested_due)}</strong>
                </p>
              </div>
              <p className="whitespace-pre-line rounded bg-muted/50 p-2">{x.justification}</p>
              <Input
                placeholder="Observação ao representante (opcional)"
                value={notes[x.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [x.id]: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: x.id, decision: "aprovada" })}
                >
                  {decide.isPending && decide.variables?.id === x.id && (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  )}
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: x.id, decision: "recusada" })}
                >
                  Recusar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
