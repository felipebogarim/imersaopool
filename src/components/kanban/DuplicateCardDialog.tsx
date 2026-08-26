import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllKanbanClients } from "@/lib/kanban-clients";
import { fetchAllKanbanReps } from "@/lib/kanban-reps";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { KCard, KanbanPriority } from "@/lib/kanban-types";
import { logActivity } from "@/lib/kanban-activity";

type Pick = { id: string; name: string } | null;

interface Props {
  card: KCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuplicateCardDialog({ card, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<KanbanPriority>("media");
  const [dueDate, setDueDate] = useState("");
  const [hasClient, setHasClient] = useState(false);
  const [client, setClient] = useState<Pick>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [hasRep, setHasRep] = useState(false);
  const [rep, setRep] = useState<Pick>(null);
  const [repSearch, setRepSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !card) return;
    const meta = (card.metadata ?? {}) as any;
    setTitle(`${card.title} (cópia)`);
    setDescription(card.description ?? "");
    setPriority(card.priority ?? "media");
    setDueDate(card.due_date ? String(card.due_date).slice(0, 10) : "");
    setHasClient(Boolean(meta.client_id));
    setClient(meta.client_id ? { id: meta.client_id, name: meta.client_name ?? "" } : null);
    setHasRep(Boolean(meta.rep_id));
    setRep(meta.rep_id ? { id: meta.rep_id, name: meta.rep_name ?? "" } : null);
    setClientSearch(""); setRepSearch("");
  }, [open, card]);

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["kanban-clients-all"],
    enabled: open && hasClient,
    staleTime: 5 * 60_000,
    queryFn: fetchAllKanbanClients,
  });
  const { data: reps = [], isLoading: loadingReps } = useQuery({
    queryKey: ["kanban-reps-all"],
    enabled: open && hasRep,
    staleTime: 5 * 60_000,
    queryFn: fetchAllKanbanReps,
  });

  const ct = clientSearch.trim().toLowerCase();
  const filteredClients = ct
    ? clients.filter((c) => c.nome_fantasia?.toLowerCase().includes(ct) || c.razao_social?.toLowerCase().includes(ct))
    : clients;
  const rt = repSearch.trim().toLowerCase();
  const filteredReps = rt
    ? reps.filter((r) => r.nome?.toLowerCase().includes(rt) || r.regiao?.toLowerCase().includes(rt))
    : reps;

  async function submit() {
    if (!card || !title.trim()) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const baseMeta = { ...((card.metadata ?? {}) as Record<string, unknown>) };
      delete baseMeta.client_id; delete baseMeta.client_name;
      delete baseMeta.rep_id; delete baseMeta.rep_name;
      if (hasClient && client) { baseMeta.client_id = client.id; baseMeta.client_name = client.name; }
      if (hasRep && rep) { baseMeta.rep_id = rep.id; baseMeta.rep_name = rep.name; }

      const { data, error } = await supabase.from("kanban_cards").insert({
        list_id: card.list_id,
        board_id: card.board_id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
        cover_color: card.cover_color,
        position: (card.position ?? 0) + 1,
        created_by: u.user!.id,
        metadata: baseMeta as any,
      }).select("id").single();
      if (error) { toast.error(error.message); return; }

      if (data) {
        await logActivity(card.board_id, "card_created", { title: title.trim(), duplicated_from: card.id }, data.id);
      }
      toast.success("Ação duplicada");
      qc.invalidateQueries({ queryKey: ["kanban-cards", card.board_id] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicar ação</DialogTitle>
          <DialogDescription>Revise e edite os dados antes de criar a cópia.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="dup-title">Título</Label>
            <Input id="dup-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dup-desc">Descrição</Label>
            <Textarea id="dup-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as KanbanPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dup-due">Prazo</Label>
              <Input id="dup-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <p className="pr-3 text-sm font-medium">Vincular a um cliente</p>
            <Switch checked={hasClient} onCheckedChange={(v) => { setHasClient(v); if (!v) setClient(null); }} />
          </div>
          {hasClient && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Pesquisar cliente..." />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border">
                {loadingClients ? (
                  <p className="p-3 text-sm text-muted-foreground">Carregando clientes...</p>
                ) : filteredClients.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                ) : filteredClients.slice(0, 200).map((c) => {
                  const name = c.nome_fantasia || c.razao_social || "Sem nome";
                  const active = client?.id === c.id;
                  return (
                    <button key={c.id} type="button" onClick={() => setClient({ id: c.id, name })}
                      className={cn("flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted", active && "bg-muted")}>
                      <span className="truncate">{name}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <p className="pr-3 text-sm font-medium">Vincular a um representante</p>
            <Switch checked={hasRep} onCheckedChange={(v) => { setHasRep(v); if (!v) setRep(null); }} />
          </div>
          {hasRep && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" value={repSearch} onChange={(e) => setRepSearch(e.target.value)} placeholder="Pesquisar representante..." />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border">
                {loadingReps ? (
                  <p className="p-3 text-sm text-muted-foreground">Carregando representantes...</p>
                ) : filteredReps.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Nenhum representante encontrado.</p>
                ) : filteredReps.map((r) => {
                  const name = r.nome || "Sem nome";
                  const active = rep?.id === r.id;
                  return (
                    <button key={r.id} type="button" onClick={() => setRep({ id: r.id, name })}
                      className={cn("flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted", active && "bg-muted")}>
                      <span className="truncate">{name}{r.regiao ? <span className="text-muted-foreground"> · {r.regiao}</span> : null}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!title.trim() || saving || (hasClient && !client) || (hasRep && !rep)}>
            Duplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
