import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type FonteElegivel = {
  id: string;
  titulo: string | null;
  pessoa: string | null;
  regiao: string | null;
  tipo: string;
  updated_at: string;
};

export function NovoConsolidadoDialog({
  open,
  onOpenChange,
  fontes,
  busy,
  onGerar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fontes: FonteElegivel[];
  busy?: boolean;
  onGerar: (args: { titulo: string; fonteIds: string[] }) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [sel, setSel] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSel(fontes.map(f => f.id));
      setTitulo("");
    }
  }, [open, fontes]);

  const todos = sel.length === fontes.length && fontes.length > 0;
  const nomes = useMemo(
    () => new Map(fontes.map(f => [f.id, `${f.pessoa ?? f.titulo ?? "Fonte"}${f.regiao ? ` — ${f.regiao}` : ""}`])),
    [fontes],
  );

  function toggle(id: string) {
    setSel(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo consolidado</DialogTitle>
          <DialogDescription>
            Escolha quais relatórios entram nesta análise. Cada geração cria um consolidado novo na lista.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo-consolidado">Nome do consolidado</Label>
            <Input
              id="titulo-consolidado"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex.: Consolidado Sul — agosto"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Relatórios considerados ({sel.length}/{fontes.length})</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setSel(todos ? [] : fontes.map(f => f.id))}
              >
                {todos ? "Limpar seleção" : "Selecionar todos"}
              </Button>
            </div>
            <div className="max-h-72 space-y-1 overflow-auto rounded-lg border p-2">
              {fontes.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">Nenhuma fonte processada disponível.</p>
              ) : (
                fontes.map(f => (
                  <label
                    key={f.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                      sel.includes(f.id) && "bg-muted/60",
                    )}
                  >
                    <Checkbox checked={sel.includes(f.id)} onCheckedChange={() => toggle(f.id)} />
                    <span className="min-w-0 flex-1 truncate">{nomes.get(f.id)}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button disabled={busy || sel.length === 0} onClick={() => onGerar({ titulo, fonteIds: sel })}>
            <RefreshCw className={cn("mr-1 h-4 w-4", busy && "animate-spin")} /> Gerar consolidado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
