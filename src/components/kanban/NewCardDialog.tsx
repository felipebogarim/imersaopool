import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAllKanbanClients } from "@/lib/kanban-clients";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type NewCardClient = { id: string; name: string } | null;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string, client: NewCardClient) => Promise<void> | void;
}

export function NewCardDialog({ open, onOpenChange, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [hasClient, setHasClient] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<NewCardClient>(null);
  const [saving, setSaving] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["kanban-clients-all"],
    enabled: open && hasClient,
    staleTime: 5 * 60_000,
    queryFn: fetchAllKanbanClients,
  });


  const term = search.trim().toLowerCase();
  const filtered = term
    ? clients.filter(
        (c) =>
          c.nome_fantasia?.toLowerCase().includes(term) ||
          c.razao_social?.toLowerCase().includes(term),
      )
    : clients;

  function reset() {
    setTitle(""); setHasClient(false); setSearch(""); setSelected(null);
  }

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate(title.trim(), hasClient ? selected : null);
      reset();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo card</DialogTitle>
          <DialogDescription>Informe o título e, se aplicável, vincule a um cliente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-card-title">Título</Label>
            <Input
              id="new-card-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Revisar mix da linha X"
              onKeyDown={(e) => { if (e.key === "Enter" && !hasClient) submit(); }}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="pr-3">
              <p className="text-sm font-medium">Esta ação está associada a um cliente?</p>
              <p className="text-xs text-muted-foreground">Vincule o card a um cliente da carteira.</p>
            </div>
            <Switch checked={hasClient} onCheckedChange={(v) => { setHasClient(v); if (!v) setSelected(null); }} />
          </div>

          {hasClient && (
            <div className="space-y-2">
              <Label>Cliente</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar cliente..."
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border">
                {isLoading ? (
                  <p className="p-3 text-sm text-muted-foreground">Carregando clientes...</p>
                ) : filtered.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                ) : (
                  filtered.slice(0, 200).map((c) => {
                    const name = c.nome_fantasia || c.razao_social || "Sem nome";
                    const active = selected?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelected({ id: c.id, name })}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                          active && "bg-muted",
                        )}
                      >
                        <span className="truncate">{name}</span>
                        {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={submit} disabled={!title.trim() || saving || (hasClient && !selected)}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
