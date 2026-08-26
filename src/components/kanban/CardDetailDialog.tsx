import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllKanbanClients } from "@/lib/kanban-clients";
import { fetchAllKanbanReps } from "@/lib/kanban-reps";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Calendar as CalendarIcon, MessageSquare, CheckSquare, Paperclip, Users, Tag, Archive, Trash2, Plus, X, Upload,
  Sparkles, ThumbsUp, ThumbsDown, Shield, User, UserRound, Check,

} from "lucide-react";
import { toast } from "sonner";
import type { Board, KCard, KList, KanbanPriority } from "@/lib/kanban-types";
import { PRIORITY_COLOR, PRIORITY_LABEL } from "@/lib/kanban-types";
import { getSuggested, withSuggested, SUGGESTED_LABEL, SUGGESTED_COLOR } from "@/lib/kanban-suggested";
import { useIsMasterAdmin } from "@/hooks/use-is-admin";
import { logActivity } from "@/lib/kanban-activity";
import { cn } from "@/lib/utils";

interface Props {
  card: KCard;
  board: Board;
  lists: KList[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CardDetailDialog({ card, board, lists, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");

  async function patch(data: Partial<KCard>) {
    const { error } = await supabase.from("kanban_cards").update(data as any).eq("id", card.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["kanban-cards", card.board_id] });
    qc.invalidateQueries({ queryKey: ["kanban-card-meta", card.id] });
  }

  async function saveTitle() {
    if (title.trim() && title !== card.title) {
      await patch({ title: title.trim() });
      await logActivity(card.board_id, "card_updated", { field: "title" }, card.id);
    }
  }
  async function saveDescription() {
    if (description !== (card.description ?? "")) {
      await patch({ description: description.trim() || null });
      await logActivity(card.board_id, "card_updated", { field: "description" }, card.id);
    }
  }
  async function toggleComplete() {
    const next = card.completed_at ? null : new Date().toISOString();
    await patch({ completed_at: next });
  }
  async function archive() {
    if (!confirm("Arquivar este card?")) return;
    await patch({ archived_at: new Date().toISOString() });
    await logActivity(card.board_id, "card_archived", {}, card.id);
    onOpenChange(false);
  }
  async function del() {
    if (!confirm("Excluir permanentemente este card?")) return;
    await supabase.from("kanban_cards").delete().eq("id", card.id);
    await logActivity(card.board_id, "card_deleted", { title: card.title });
    qc.invalidateQueries({ queryKey: ["kanban-cards", card.board_id] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <div className="grid max-h-[90vh] grid-cols-1 md:grid-cols-[1fr_240px]">
          <div className="overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle className="sr-only">Detalhes do card</DialogTitle>
            </DialogHeader>
            <div className="flex items-start gap-3">
              <Checkbox checked={!!card.completed_at} onCheckedChange={toggleComplete} className="mt-1.5" />
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              em <ListSelector card={card} lists={lists} />
            </div>

            <div className="mt-6">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={saveDescription}
                placeholder="Adicione mais detalhes…"
                className="mt-2"
                rows={4}
              />
            </div>

            <ChecklistsSection cardId={card.id} boardId={card.board_id} />
            <AttachmentsSection cardId={card.id} boardId={card.board_id} />
            <CommentsSection cardId={card.id} boardId={card.board_id} />
            <ActivitySection cardId={card.id} />
          </div>

          <aside className="overflow-y-auto border-l bg-muted/30 p-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                <Select value={card.priority} onValueChange={(v) => patch({ priority: v as KanbanPriority })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_LABEL) as KanbanPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Prazo</label>
                <Input
                  type="date"
                  value={card.due_date ? card.due_date.split("T")[0] : ""}
                  onChange={async (e) => {
                    const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                    await patch({ due_date: v });
                    await logActivity(card.board_id, "due_date_changed", { due_date: v }, card.id);
                  }}
                  className="mt-1"
                />
              </div>
              <ClientLinkSection card={card} patch={patch} />
              <RepLinkSection card={card} patch={patch} />

              <LabelsPicker cardId={card.id} boardId={card.board_id} />
              <MembersPicker cardId={card.id} boardId={card.board_id} workspaceId={board.workspace_id} card={card} patch={patch} />
              <SuggestedActionSection card={card} patch={patch} />


              <div className="space-y-2 border-t pt-4">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setDuplicating(true)}>
                  <Copy className="h-4 w-4" /> Duplicar ação
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={archive}>
                  <Archive className="h-4 w-4" /> Arquivar
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive" onClick={del}>
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </div>
              <DuplicateCardDialog card={card} open={duplicating} onOpenChange={setDuplicating} />

            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListSelector({ card, lists }: { card: KCard; lists: KList[] }) {
  const qc = useQueryClient();
  return (
    <Select value={card.list_id} onValueChange={async (v) => {
      await supabase.from("kanban_cards").update({ list_id: v }).eq("id", card.id);
      await logActivity(card.board_id, "card_moved", { to_list: v }, card.id);
      qc.invalidateQueries({ queryKey: ["kanban-cards", card.board_id] });
    }}>
      <SelectTrigger className="inline-flex h-6 w-auto border-0 bg-transparent px-1 py-0 text-xs shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
      <SelectContent>{lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
    </Select>
  );
}


// ============ CLIENTE VINCULADO ============
function ClientLinkSection({ card, patch }: { card: KCard; patch: (d: Partial<KCard>) => Promise<void> }) {
  const meta = (card.metadata ?? {}) as any;
  const currentId: string | null = typeof meta.client_id === "string" ? meta.client_id : null;
  const currentName: string | null = typeof meta.client_name === "string" ? meta.client_name : null;
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["kanban-clients-all"],
    enabled: open,
    staleTime: 5 * 60_000,
    queryFn: fetchAllKanbanClients,
  });


  const q = term.trim().toLowerCase();
  const filtered = q
    ? clients.filter((c: any) =>
        (c.razao_social ?? "").toLowerCase().includes(q) ||
        (c.nome_fantasia ?? "").toLowerCase().includes(q))
    : clients;

  async function link(id: string | null, name: string | null) {
    const next = { ...meta };
    if (id) { next.client_id = id; next.client_name = name; }
    else { delete next.client_id; delete next.client_name; }
    await patch({ metadata: next as any });
    setOpen(false);
    setTerm("");
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">Cliente vinculado</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="mt-1 w-full justify-start gap-2 truncate">
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">{currentName || "Vincular cliente"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <div className="border-b p-2">
            <Input
              autoFocus
              placeholder="Pesquisar cliente..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Carregando clientes...</p>
            ) : filtered.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
            ) : (
              filtered.slice(0, 200).map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => link(c.id, c.razao_social || c.nome_fantasia || "")}
                  className={cn(
                    "block w-full px-3 py-2 text-left text-sm hover:bg-muted",
                    currentId === c.id && "bg-muted font-medium",
                  )}
                >
                  {c.razao_social || c.nome_fantasia}
                </button>
              ))
            )}
          </div>
          {currentId && (
            <div className="border-t p-2">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive" onClick={() => link(null, null)}>
                <X className="h-4 w-4" /> Remover vínculo
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ============ REPRESENTANTE VINCULADO ============
function RepLinkSection({ card, patch }: { card: KCard; patch: (d: Partial<KCard>) => Promise<void> }) {
  const meta = (card.metadata ?? {}) as any;
  const currentId: string | null = typeof meta.rep_id === "string" ? meta.rep_id : null;
  const currentName: string | null = typeof meta.rep_name === "string" ? meta.rep_name : null;
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const { data: reps = [], isLoading } = useQuery({
    queryKey: ["kanban-reps-all"],
    enabled: open,
    staleTime: 5 * 60_000,
    queryFn: fetchAllKanbanReps,
  });

  const q = term.trim().toLowerCase();
  const filtered = q
    ? reps.filter((r) =>
        (r.nome ?? "").toLowerCase().includes(q) || (r.regiao ?? "").toLowerCase().includes(q))
    : reps;

  async function link(id: string | null, name: string | null) {
    const next = { ...meta };
    if (id) { next.rep_id = id; next.rep_name = name; }
    else { delete next.rep_id; delete next.rep_name; }
    await patch({ metadata: next as any });
    setOpen(false);
    setTerm("");
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">Representante vinculado</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="mt-1 w-full justify-start gap-2 truncate">
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">{currentName || "Vincular representante"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <div className="border-b p-2">
            <Input
              autoFocus
              placeholder="Pesquisar representante..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Carregando representantes...</p>
            ) : filtered.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nenhum representante encontrado.</p>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => link(r.id, r.nome || "")}
                  className={cn(
                    "block w-full px-3 py-2 text-left text-sm hover:bg-muted",
                    currentId === r.id && "bg-muted font-medium",
                  )}
                >
                  {r.nome}
                  {r.regiao ? <span className="text-muted-foreground"> · {r.regiao}</span> : null}
                </button>
              ))
            )}
          </div>
          {currentId && (
            <div className="border-t p-2">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive" onClick={() => link(null, null)}>
                <X className="h-4 w-4" /> Remover vínculo
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ============ AÇÃO SUGERIDA ============

function SuggestedActionSection({ card, patch }: { card: KCard; patch: (d: Partial<KCard>) => Promise<void> }) {
  const isMaster = useIsMasterAdmin();
  const s = getSuggested(card);

  async function setState(next: Parameters<typeof withSuggested>[1]) {
    await patch({ metadata: withSuggested(card, next) as any });
  }

  async function toggleSuggested() {
    if (s.suggested) {
      await setState(null);
      await logActivity(card.board_id, "card_updated", { field: "suggested_action", value: false }, card.id);
      toast.success("Marcação de ação sugerida removida");
      return;
    }
    await setState({ suggested: true, status: "pendente" });
    await logActivity(card.board_id, "card_updated", { field: "suggested_action", value: true }, card.id);
    toast.success("Card marcado como Ação Sugerida — aguardando aprovação");
  }

  async function decide(status: "aprovada" | "reprovada") {
    const { data: u } = await supabase.auth.getUser();
    const name = (u.user?.user_metadata as any)?.full_name || u.user?.email || "Gestor master";
    await setState({ suggested: true, status, decided_by_name: name, decided_at: new Date().toISOString() });
    await logActivity(card.board_id, "card_updated", { field: "suggested_action_status", value: status }, card.id);
    toast.success(status === "aprovada" ? "Ação aprovada" : "Ação reprovada");
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <label className="text-xs font-medium text-muted-foreground">Ação sugerida</label>
      <Button
        variant={s.suggested ? "secondary" : "outline"}
        size="sm"
        className="w-full justify-start gap-2"
        onClick={toggleSuggested}
      >
        <Sparkles className="h-4 w-4" />
        {s.suggested ? "Desmarcar ação sugerida" : "Marcar como Ação Sugerida"}
      </Button>

      {s.suggested && (
        <div className="space-y-2 rounded-md border bg-background p-2">
          <Badge variant="outline" className={cn("text-[10px]", SUGGESTED_COLOR[s.status])}>
            {SUGGESTED_LABEL[s.status]}
          </Badge>
          {s.decided_at && (
            <p className="text-[11px] text-muted-foreground">
              por {s.decided_by_name} em {new Date(s.decided_at).toLocaleDateString("pt-BR")}
            </p>
          )}
          {isMaster ? (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1" onClick={() => decide("aprovada")}>
                <ThumbsUp className="h-3.5 w-3.5" /> Aprovar
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => decide("reprovada")}>
                <ThumbsDown className="h-3.5 w-3.5" /> Reprovar
              </Button>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              A aprovação é feita pelo gestor master.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============ CHECKLISTS ============
function ChecklistsSection({ cardId, boardId }: { cardId: string; boardId: string }) {
  const qc = useQueryClient();
  const { data: checklists = [] } = useQuery({
    queryKey: ["kanban-checklists", cardId],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_checklists").select("*").eq("card_id", cardId).order("position");
      return data ?? [];
    },
  });

  async function addChecklist() {
    const title = prompt("Título do checklist:")?.trim();
    if (!title) return;
    const { error } = await supabase.from("kanban_checklists").insert({ card_id: cardId, title, position: checklists.length });
    if (error) return toast.error(error.message);
    await logActivity(boardId, "checklist_added", { title }, cardId);
    qc.invalidateQueries({ queryKey: ["kanban-checklists", cardId] });
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium"><CheckSquare className="h-4 w-4" /> Checklists</div>
        <Button size="sm" variant="ghost" onClick={addChecklist} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
      </div>
      {checklists.map((cl: any) => <Checklist key={cl.id} checklist={cl} boardId={boardId} cardId={cardId} />)}
    </div>
  );
}

function Checklist({ checklist, boardId, cardId }: { checklist: any; boardId: string; cardId: string }) {
  const qc = useQueryClient();
  const [newItem, setNewItem] = useState("");
  const { data: items = [] } = useQuery({
    queryKey: ["kanban-checklist-items", checklist.id],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_checklist_items").select("*").eq("checklist_id", checklist.id).order("position");
      return data ?? [];
    },
  });
  const done = items.filter((i: any) => i.done).length;
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  async function addItem() {
    if (!newItem.trim()) return;
    await supabase.from("kanban_checklist_items").insert({ checklist_id: checklist.id, content: newItem.trim(), position: items.length });
    setNewItem("");
    qc.invalidateQueries({ queryKey: ["kanban-checklist-items", checklist.id] });
    qc.invalidateQueries({ queryKey: ["kanban-card-meta", cardId] });
  }
  async function toggleItem(item: any) {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("kanban_checklist_items").update({
      done: !item.done,
      completed_at: !item.done ? new Date().toISOString() : null,
      completed_by: !item.done ? u.user?.id : null,
    }).eq("id", item.id);
    await logActivity(boardId, "checklist_item_toggled", { content: item.content, done: !item.done }, cardId);
    qc.invalidateQueries({ queryKey: ["kanban-checklist-items", checklist.id] });
    qc.invalidateQueries({ queryKey: ["kanban-card-meta", cardId] });
  }
  async function delItem(id: string) {
    await supabase.from("kanban_checklist_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["kanban-checklist-items", checklist.id] });
    qc.invalidateQueries({ queryKey: ["kanban-card-meta", cardId] });
  }
  async function delChecklist() {
    if (!confirm("Excluir este checklist?")) return;
    await supabase.from("kanban_checklists").delete().eq("id", checklist.id);
    qc.invalidateQueries({ queryKey: ["kanban-checklists", cardId] });
  }

  return (
    <div className="mb-4 rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">{checklist.title}</div>
        <button onClick={delChecklist}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
      </div>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span>{pct}%</span>
      </div>
      <ul className="space-y-1">
        {items.map((i: any) => (
          <li key={i.id} className="group flex items-center gap-2">
            <Checkbox checked={i.done} onCheckedChange={() => toggleItem(i)} />
            <span className={cn("flex-1 text-sm", i.done && "text-muted-foreground line-through")}>{i.content}</span>
            <button onClick={() => delItem(i.id)} className="opacity-0 group-hover:opacity-100">
              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
          placeholder="Adicionar item…"
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={addItem}>+</Button>
      </div>
    </div>
  );
}

// ============ LABELS ============
function LabelsPicker({ cardId, boardId }: { cardId: string; boardId: string }) {
  const qc = useQueryClient();
  const { data: labels = [] } = useQuery({
    queryKey: ["kanban-labels", boardId],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_labels").select("*").eq("board_id", boardId).order("name");
      return data ?? [];
    },
  });
  const { data: cardLabels = [] } = useQuery({
    queryKey: ["kanban-card-labels", cardId],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_card_labels").select("label_id").eq("card_id", cardId);
      return (data ?? []).map((r) => r.label_id);
    },
  });

  async function toggle(labelId: string, active: boolean) {
    if (active) {
      await supabase.from("kanban_card_labels").delete().eq("card_id", cardId).eq("label_id", labelId);
      await logActivity(boardId, "label_removed", { label_id: labelId }, cardId);
    } else {
      await supabase.from("kanban_card_labels").insert({ card_id: cardId, label_id: labelId });
      await logActivity(boardId, "label_added", { label_id: labelId }, cardId);
    }
    qc.invalidateQueries({ queryKey: ["kanban-card-labels", cardId] });
    qc.invalidateQueries({ queryKey: ["kanban-card-meta", cardId] });
  }
  async function createLabel() {
    const name = prompt("Nome do label:")?.trim();
    if (!name) return;
    await supabase.from("kanban_labels").insert({ board_id: boardId, name, color: "#3B82F6" });
    qc.invalidateQueries({ queryKey: ["kanban-labels", boardId] });
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">Labels</label>
      <div className="mt-1 flex flex-wrap gap-1">
        {labels.filter((l: any) => cardLabels.includes(l.id)).map((l: any) => (
          <Badge key={l.id} style={{ background: l.color, color: "white" }}>{l.name}</Badge>
        ))}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="mt-2 w-full gap-2"><Tag className="h-3.5 w-3.5" /> Gerenciar</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          {labels.map((l: any) => (
            <DropdownMenuCheckboxItem
              key={l.id}
              checked={cardLabels.includes(l.id)}
              onCheckedChange={() => toggle(l.id, cardLabels.includes(l.id))}
            >
              <span className="mr-2 inline-block h-2 w-6 rounded" style={{ background: l.color }} />
              {l.name}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuItem onClick={createLabel}><Plus className="mr-2 h-3.5 w-3.5" /> Novo label</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============ MEMBERS ============
function MembersPicker({ cardId, boardId, workspaceId, card, patch }: { cardId: string; boardId: string; workspaceId: string; card: KCard; patch: (d: Partial<KCard>) => Promise<void> }) {
  const qc = useQueryClient();
  const [memberTerm, setMemberTerm] = useState("");
  const [respTerm, setRespTerm] = useState("");

  const { data: allUsers = [] } = useQuery({
    queryKey: ["kanban-all-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      return data ?? [];
    },
  });

  const { data: wsMembers = [] } = useQuery({
    queryKey: ["kanban-ws-members", workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("kanban_workspace_members")
        .select("user_id, role, profiles(full_name, email)")
        .eq("workspace_id", workspaceId);
      return data ?? [];
    },
  });

  const { data: reps = [] } = useQuery({
    queryKey: ["kanban-reps-all"],
    staleTime: 5 * 60_000,
    queryFn: fetchAllKanbanReps,
  });
  
  const { data: assigned = [] } = useQuery({
    queryKey: ["kanban-card-members", cardId],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_card_members").select("user_id").eq("card_id", cardId);
      return (data ?? []).map((r: any) => r.user_id);
    },
  });

  const cardMeta = (card.metadata ?? {}) as any;
  const responsibleId = cardMeta.responsible_id;

  async function toggle(userId: string, active: boolean) {
    if (active) {
      await supabase.from("kanban_card_members").delete().eq("card_id", cardId).eq("user_id", userId);
      await logActivity(boardId, "member_removed", { user_id: userId }, cardId);
    } else {
      await supabase.from("kanban_card_members").insert({ card_id: cardId, user_id: userId });
      await logActivity(boardId, "member_assigned", { user_id: userId }, cardId);
    }
    qc.invalidateQueries({ queryKey: ["kanban-card-members", cardId] });
    qc.invalidateQueries({ queryKey: ["kanban-cards", boardId] });
  }

  async function setResponsible(id: string | null, name: string | null) {
    const meta = { ...cardMeta };
    if (id) {
      meta.responsible_id = id;
      meta.responsible_name = name;
      const isUser = wsMembers.some((m: any) => m.user_id === id);
      if (isUser && !assigned.includes(id)) {
        await supabase.from("kanban_card_members").insert({ card_id: cardId, user_id: id });
        qc.invalidateQueries({ queryKey: ["kanban-card-members", cardId] });
      }
    } else {
      delete meta.responsible_id;
      delete meta.responsible_name;
    }
    await patch({ metadata: meta as any });
    await logActivity(boardId, "card_updated", { field: "responsible", user_id: id }, cardId);
  }

  const responsibleDisplayName = cardMeta.responsible_name || responsibleId || "Definir responsável";

  const filteredAllUsersResp = respTerm.trim().toLowerCase() 
    ? allUsers.filter((u: any) => (u.full_name ?? "").toLowerCase().includes(respTerm.toLowerCase()) || (u.email ?? "").toLowerCase().includes(respTerm.toLowerCase()))
    : allUsers;

  const filteredRepsResp = respTerm.trim().toLowerCase()
    ? reps.filter((r) => (r.nome ?? "").toLowerCase().includes(respTerm.toLowerCase()))
    : reps;

  const filteredWsMembersMem = memberTerm.trim().toLowerCase()
    ? wsMembers.filter((m: any) => (m.profiles?.full_name ?? "").toLowerCase().includes(memberTerm.toLowerCase()) || (m.profiles?.email ?? "").toLowerCase().includes(memberTerm.toLowerCase()))
    : wsMembers;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Responsável</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="mt-1 w-full justify-start gap-2">
              <Shield className="h-3.5 w-3.5" />
              <span className="truncate">{responsibleDisplayName}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="border-b p-2">
              <Input 
                placeholder="Pesquisar..." 
                value={respTerm} 
                onChange={e => setRespTerm(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {responsibleId && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start text-[11px] h-7 text-destructive" 
                  onClick={() => setResponsible(null, null)}
                >
                  Remover responsável
                </Button>
              )}
              
              {filteredAllUsersResp.length > 0 && (
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Usuários</div>
              )}
              {filteredAllUsersResp.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => setResponsible(u.id, u.full_name || u.email)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-[13px] hover:bg-accent",
                    responsibleId === u.id && "bg-accent"
                  )}
                >
                  <User className="h-3.5 w-3.5 opacity-50" />
                  <span className="truncate">{u.full_name || u.email}</span>
                </button>
              ))}

              {filteredRepsResp.length > 0 && (
                <div className="mt-2 px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t">Representantes</div>
              )}
              {filteredRepsResp.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setResponsible(r.id, r.nome)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-[13px] hover:bg-accent",
                    responsibleId === r.id && "bg-accent"
                  )}
                >
                  <UserRound className="h-3.5 w-3.5 opacity-50" />
                  <span className="truncate">{r.nome}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Membros / Acompanhadores</label>
        <div className="mt-1 space-y-1">
          {wsMembers.filter((m: any) => assigned.includes(m.user_id)).map((m: any) => (
            <div key={m.user_id} className="flex items-center justify-between rounded-md border bg-background px-2 py-1 text-sm">
              <div className="flex items-center gap-2 overflow-hidden">
                <User className="h-3 w-3 shrink-0 opacity-50" />
                <span className="truncate">{m.profiles?.full_name ?? m.profiles?.email ?? "—"}</span>
              </div>
              <button 
                onClick={() => toggle(m.user_id, true)}
                className="ml-2 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="mt-2 w-full gap-2">
              <Plus className="h-3.5 w-3.5" /> Adicionar membro
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="border-b p-2">
              <Input 
                placeholder="Pesquisar usuários..." 
                value={memberTerm} 
                onChange={e => setMemberTerm(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filteredWsMembersMem.map((m: any) => (
                <button
                  key={m.user_id}
                  onClick={() => toggle(m.user_id, assigned.includes(m.user_id))}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left text-[13px] hover:bg-accent",
                    assigned.includes(m.user_id) && "bg-accent"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <User className="h-3.5 w-3.5 opacity-50" />
                    <span className="truncate">{m.profiles?.full_name || m.profiles?.email}</span>
                  </div>
                  {assigned.includes(m.user_id) && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ============ ATTACHMENTS ============
function AttachmentsSection({ cardId, boardId }: { cardId: string; boardId: string }) {
  const qc = useQueryClient();
  const { data: attachments = [] } = useQuery({
    queryKey: ["kanban-attachments", cardId],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_attachments").select("*").eq("card_id", cardId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function upload(f: File) {
    const { data: u } = await supabase.auth.getUser();
    const path = `${u.user!.id}/${cardId}/${Date.now()}-${f.name}`;
    const { error: upErr } = await supabase.storage.from("kanban-attachments").upload(path, f);
    if (upErr) return toast.error(upErr.message);
    const { data: signed } = await supabase.storage.from("kanban-attachments").createSignedUrl(path, 60 * 60 * 24 * 7);
    await supabase.from("kanban_attachments").insert({
      card_id: cardId, uploaded_by: u.user!.id,
      file_name: f.name, file_path: path, file_size: f.size, mime_type: f.type, url: signed?.signedUrl ?? null,
    });
    await logActivity(boardId, "attachment_added", { file_name: f.name }, cardId);
    qc.invalidateQueries({ queryKey: ["kanban-attachments", cardId] });
    qc.invalidateQueries({ queryKey: ["kanban-card-meta", cardId] });
  }

  async function download(a: any) {
    const { data } = await supabase.storage.from("kanban-attachments").createSignedUrl(a.file_path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }
  async function remove(a: any) {
    if (!confirm("Remover anexo?")) return;
    await supabase.storage.from("kanban-attachments").remove([a.file_path]);
    await supabase.from("kanban_attachments").delete().eq("id", a.id);
    await logActivity(boardId, "attachment_removed", { file_name: a.file_name }, cardId);
    qc.invalidateQueries({ queryKey: ["kanban-attachments", cardId] });
    qc.invalidateQueries({ queryKey: ["kanban-card-meta", cardId] });
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium"><Paperclip className="h-4 w-4" /> Anexos</div>
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <span className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted">
            <Upload className="h-3 w-3" /> Enviar
          </span>
        </label>
      </div>
      <ul className="space-y-1">
        {attachments.map((a: any) => (
          <li key={a.id} className="group flex items-center justify-between rounded border p-2 text-sm">
            <button onClick={() => download(a)} className="truncate text-left hover:underline">{a.file_name}</button>
            <button onClick={() => remove(a)} className="opacity-0 group-hover:opacity-100"><X className="h-3 w-3 text-muted-foreground hover:text-destructive" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============ COMMENTS ============
function CommentsSection({ cardId, boardId }: { cardId: string; boardId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data: comments = [] } = useQuery({
    queryKey: ["kanban-comments", cardId],
    queryFn: async () => {
      const { data } = await supabase
        .from("kanban_comments")
        .select("*, profiles!kanban_comments_user_id_fkey(full_name, email)")
        .eq("card_id", cardId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  async function send() {
    if (!text.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("kanban_comments").insert({ card_id: cardId, user_id: u.user!.id, content: text.trim() });
    await logActivity(boardId, "comment_added", {}, cardId);
    setText("");
    qc.invalidateQueries({ queryKey: ["kanban-comments", cardId] });
    qc.invalidateQueries({ queryKey: ["kanban-card-meta", cardId] });
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium"><MessageSquare className="h-4 w-4" /> Comentários</div>
      <div className="space-y-3">
        {comments.map((c: any) => (
          <div key={c.id} className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs font-medium">{c.profiles?.full_name ?? c.profiles?.email ?? "—"}
              <span className="ml-2 text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{c.content}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva um comentário…" />
        <Button onClick={send} disabled={!text.trim()}>Enviar</Button>
      </div>
    </div>
  );
}

// ============ ACTIVITY ============
function ActivitySection({ cardId }: { cardId: string }) {
  const { data: acts = [] } = useQuery({
    queryKey: ["kanban-activities", cardId],
    queryFn: async () => {
      const { data } = await supabase
        .from("kanban_activities")
        .select("*, profiles!kanban_activities_user_id_fkey(full_name, email)")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });
  if (acts.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="mb-2 text-sm font-medium">Atividade</div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {acts.map((a: any) => (
          <li key={a.id}>
            <span className="font-medium">{a.profiles?.full_name ?? a.profiles?.email ?? "—"}</span>
            {" · "}{a.type.replaceAll("_", " ")}
            <span className="ml-2 opacity-70">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
