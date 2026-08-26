import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft, MoreHorizontal, Users, Zap, GripVertical, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Board, KCard, KList } from "@/lib/kanban-types";
import { midPosition } from "@/lib/kanban-types";
import { KanbanCard } from "@/components/kanban/KanbanCard";
import { NewCardDialog, type NewCardClient } from "@/components/kanban/NewCardDialog";
import { DuplicateCardDialog } from "@/components/kanban/DuplicateCardDialog";
import { CardDetailDialog } from "@/components/kanban/CardDetailDialog";
import { BoardMembersDialog } from "@/components/kanban/BoardMembersDialog";
import { BoardMembersListDialog } from "@/components/kanban/BoardMembersListDialog";
import { BoardAutomationsDialog } from "@/components/kanban/BoardAutomationsDialog";
import { logActivity } from "@/lib/kanban-activity";
import { runAutomationsForMove } from "@/lib/kanban-automations";
import { cn } from "@/lib/utils";
import { useIsMasterAdmin } from "@/hooks/use-is-admin";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSuggested } from "@/lib/kanban-suggested";


const searchSchema = z.object({ card: z.string().optional() });

export const Route = createFileRoute("/_authenticated/tarefas/b/$boardId")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Board — PoolFlux" }] }),
  component: BoardPage,
});

function BoardPage() {
  const { boardId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [openSettingsMembers, setOpenSettingsMembers] = useState(false);
  const [openExecutionMembers, setOpenExecutionMembers] = useState(false);
  const [openAutomations, setOpenAutomations] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(search.card ?? null);

  useEffect(() => { setOpenCardId(search.card ?? null); }, [search.card]);

  const { data: board } = useQuery({
    queryKey: ["kanban-board", boardId],
    queryFn: async () => {
      const { data, error } = await supabase.from("kanban_boards").select("*").eq("id", boardId).single();
      if (error) throw error;
      return data as Board;
    },
  });

  const { data: lists = [] } = useQuery({
    queryKey: ["kanban-lists", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_lists").select("*")
        .eq("board_id", boardId).is("archived_at", null)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as KList[];
    },
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["kanban-cards", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_cards").select("*")
        .eq("board_id", boardId).is("archived_at", null)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as KCard[];
    },
  });

  const [fStatus, setFStatus] = useState("all");
  const [fClient, setFClient] = useState("all");
  const [fRep, setFRep] = useState("all");
  const [fPriority, setFPriority] = useState("all");

  const clientOptions = useMemo(() => {
    const s = new Set<string>();
    cards.forEach((c) => {
      const n = (c.metadata as any)?.client_name;
      if (typeof n === "string" && n.trim()) s.add(n.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cards]);

  const repOptions = useMemo(() => {
    const s = new Set<string>();
    cards.forEach((c) => {
      const n = (c.metadata as any)?.rep_name;
      if (typeof n === "string" && n.trim()) s.add(n.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cards]);

  const hasFilters = fStatus !== "all" || fClient !== "all" || fRep !== "all" || fPriority !== "all";

  const visibleCards = useMemo(() => {
    return cards.filter((c) => {
      const meta = (c.metadata ?? {}) as any;
      if (fStatus !== "all") {
        const s = getSuggested(c);
        if (!s.suggested || s.status !== fStatus) return false;
      }
      if (fClient !== "all" && (meta.client_name ?? "") !== fClient) return false;
      if (fRep !== "all" && (meta.rep_name ?? "") !== fRep) return false;
      if (fPriority !== "all" && c.priority !== fPriority) return false;
      return true;
    });
  }, [cards, fStatus, fClient, fRep, fPriority]);

  const cardsByList = useMemo(() => {
    const m: Record<string, KCard[]> = {};
    lists.forEach((l) => { m[l.id] = []; });
    visibleCards.forEach((c) => { (m[c.list_id] ??= []).push(c); });
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.position - b.position));
    return m;
  }, [lists, visibleCards]);


  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeCard, setActiveCard] = useState<KCard | null>(null);

  function onDragStart(e: DragStartEvent) {
    const card = cards.find((c) => c.id === e.active.id);
    if (card) setActiveCard(card);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeCard = cards.find((c) => c.id === activeId);
    if (!activeCard) return;

    // Determine target list
    let targetListId = activeCard.list_id;
    let overCard: KCard | undefined;
    if (lists.some((l) => l.id === overId)) {
      targetListId = overId;
    } else {
      overCard = cards.find((c) => c.id === overId);
      if (overCard) targetListId = overCard.list_id;
    }

    // Compute new position
    const targetList = cardsByList[targetListId] ?? [];
    const withoutActive = targetList.filter((c) => c.id !== activeId);
    let newPos: number;
    if (!overCard) {
      // dropped on empty list or same list header — append to end
      const last = withoutActive[withoutActive.length - 1];
      newPos = midPosition(last?.position ?? null, null);
    } else {
      const overIdx = withoutActive.findIndex((c) => c.id === overCard!.id);
      const prev = withoutActive[overIdx - 1];
      const next = withoutActive[overIdx];
      newPos = midPosition(prev?.position ?? null, next?.position ?? null);
    }

    const oldListId = activeCard.list_id;
    const patch: Partial<KCard> = { position: newPos };
    if (targetListId !== oldListId) patch.list_id = targetListId;

    // Optimistic
    qc.setQueryData<KCard[]>(["kanban-cards", boardId], (old) =>
      (old ?? []).map((c) => c.id === activeId ? { ...c, ...patch } as KCard : c),
    );

    const { error } = await supabase.from("kanban_cards").update(patch as any).eq("id", activeId);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["kanban-cards", boardId] });
      return;
    }
    if (targetListId !== oldListId) {
      const newList = lists.find((l) => l.id === targetListId);
      await logActivity(boardId, "card_moved", { from_list: oldListId, to_list: targetListId, list_name: newList?.name }, activeId);
      await runAutomationsForMove(boardId, activeId, targetListId).catch(() => {});
      qc.invalidateQueries({ queryKey: ["kanban-cards", boardId] });
    }
  }

  async function addList() {
    const name = prompt("Nome da lista:")?.trim();
    if (!name) return;
    const lastPos = lists[lists.length - 1]?.position ?? 0;
    const { error } = await supabase.from("kanban_lists").insert({
      board_id: boardId, name, position: lastPos + 1000,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kanban-lists", boardId] });
  }

  const openCard = openCardId ? cards.find((c) => c.id === openCardId) : null;

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tarefas"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="h-6 w-2 rounded" style={{ background: board?.color ?? "#3B82F6" }} />
          <h2 className="font-semibold">{board?.name ?? "Board"}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpenExecutionMembers(true)}>
            <Users className="h-4 w-4" /> Membros
          </Button>

          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="aprovada">Aprovada</SelectItem>
              <SelectItem value="pendente">Aguardando aprovação</SelectItem>
              <SelectItem value="reprovada">Reprovada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={fClient} onValueChange={setFClient}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clientOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={fRep} onValueChange={setFRep}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Representante" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todos os representantes</SelectItem>
              {repOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={fPriority} onValueChange={setFPriority}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setFStatus("all"); setFClient("all"); setFRep("all"); setFPriority("all"); }}
            >
              Limpar
            </Button>
          )}

          <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpenSettingsMembers(true)}>
            <Users className="h-4 w-4" /> Workspace
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpenAutomations(true)}>
            <Zap className="h-4 w-4" /> Automações
          </Button>
        </div>
      </div>


      <div className="flex-1 overflow-auto p-4">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-3">
            <SortableContext items={lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
              {lists.map((list) => (
                <ListColumn
                  key={list.id}
                  list={list}
                  cards={cardsByList[list.id] ?? []}
                  onOpenCard={(id) => {
                    setOpenCardId(id);
                    navigate({ to: "/tarefas/b/$boardId", params: { boardId }, search: { card: id }, replace: true });
                  }}
                />
              ))}
            </SortableContext>
            <button
              onClick={addList}
              className="h-fit w-72 shrink-0 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50"
            >
              <Plus className="mr-1 inline h-4 w-4" /> Nova lista
            </button>
          </div>
          <DragOverlay>
            {activeCard && <KanbanCard card={activeCard} onClick={() => {}} isDragging />}
          </DragOverlay>
        </DndContext>
      </div>

      {openCard && (
        <CardDetailDialog
          card={openCard}
          board={board!}
          lists={lists}
          open={!!openCard}
          onOpenChange={(o) => {
            if (!o) {
              setOpenCardId(null);
              navigate({ to: "/tarefas/b/$boardId", params: { boardId }, search: {}, replace: true });
            }
          }}
        />
      )}
      {board && (
        <BoardMembersListDialog 
          board={board} 
          lists={lists} 
          cards={cards} 
          open={openExecutionMembers} 
          onOpenChange={setOpenExecutionMembers} 
        />
      )}
      {board && <BoardMembersDialog board={board} open={openSettingsMembers} onOpenChange={setOpenSettingsMembers} />}
      {board && <BoardAutomationsDialog board={board} lists={lists} open={openAutomations} onOpenChange={setOpenAutomations} />}
    </div>
  );
}

function ListColumn({ list, cards, onOpenCard }: { list: KList; cards: KCard[]; onOpenCard: (id: string) => void }) {
  const qc = useQueryClient();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: list.id, data: { type: "list" } });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [adding, setAdding] = useState(false);

  async function createCard(title: string, client: NewCardClient, rep?: { id: string; name: string } | null) {
    const { data: u } = await supabase.auth.getUser();
    const lastPos = cards[cards.length - 1]?.position ?? 0;
    const metadata: Record<string, unknown> = {};
    if (client) { metadata.client_id = client.id; metadata.client_name = client.name; }
    if (rep) { metadata.rep_id = rep.id; metadata.rep_name = rep.name; }
    const { data, error } = await supabase.from("kanban_cards").insert({
      list_id: list.id, board_id: list.board_id, title,
      position: lastPos + 1000, created_by: u.user!.id,
      metadata: metadata as any,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    if (data) await logActivity(list.board_id, "card_created", { title, list_id: list.id, client_id: client?.id ?? null, rep_id: rep?.id ?? null }, data.id);
    qc.invalidateQueries({ queryKey: ["kanban-cards", list.board_id] });
  }


  async function renameList() {
    const name = prompt("Nome da lista:", list.name)?.trim();
    if (!name) return;
    const { error } = await supabase.from("kanban_lists").update({ name }).eq("id", list.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kanban-lists", list.board_id] });
  }

  async function archiveList() {
    if (!confirm("Arquivar esta lista? Os cards também serão arquivados.")) return;
    await supabase.from("kanban_cards").update({ archived_at: new Date().toISOString() }).eq("list_id", list.id);
    await supabase.from("kanban_lists").update({ archived_at: new Date().toISOString() }).eq("id", list.id);
    qc.invalidateQueries({ queryKey: ["kanban-lists", list.board_id] });
    qc.invalidateQueries({ queryKey: ["kanban-cards", list.board_id] });
  }

  return (
    <div ref={setNodeRef} style={style} className="flex h-fit w-72 shrink-0 flex-col rounded-lg bg-muted/60 p-2">
      <div className="mb-2 flex items-center justify-between px-1" {...attributes} {...listeners}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{list.name}</span>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{cards.length}</Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={renameList}>Renomear</DropdownMenuItem>
            <DropdownMenuItem onClick={archiveList} className="text-destructive">Arquivar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {cards.map((c) => <SortableCard key={c.id} card={c} onClick={() => onOpenCard(c.id)} />)}
        </div>
      </SortableContext>
      <button
        onClick={() => setAdding(true)}
        className="mt-2 flex items-center gap-1 rounded p-1.5 text-xs text-muted-foreground hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar card
      </button>
      <NewCardDialog open={adding} onOpenChange={setAdding} onCreate={createCard} />
    </div>
  );
}

function SortableCard({ card, onClick }: { card: KCard; onClick: () => void }) {
  const qc = useQueryClient();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, data: { type: "card" } });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const isMaster = useIsMasterAdmin();
  const [duplicating, setDuplicating] = useState(false);

  async function editCard(e: React.MouseEvent) {
    e.stopPropagation();
    const title = prompt("Título do card:", card.title)?.trim();
    if (!title || title === card.title) return;
    const { error } = await supabase.from("kanban_cards").update({ title }).eq("id", card.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kanban-cards", card.board_id] });
  }
  async function deleteCard(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Excluir card "${card.title}"?`)) return;
    const { error } = await supabase.from("kanban_cards").update({ archived_at: new Date().toISOString() }).eq("id", card.id);
    if (error) return toast.error(error.message);
    toast.success("Card excluído");
    qc.invalidateQueries({ queryKey: ["kanban-cards", card.board_id] });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative"
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label="Arrastar card"
        className="absolute right-1.5 top-1.5 z-10 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted group-hover:opacity-100"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {
        <div className="absolute right-7 top-1.5 z-10 opacity-60 transition hover:opacity-100 group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDuplicating(true); }}>
                <Copy className="mr-2 h-3.5 w-3.5" /> Duplicar ação
              </DropdownMenuItem>
              {isMaster && <DropdownMenuItem onClick={editCard}>Editar</DropdownMenuItem>}
              {isMaster && <DropdownMenuItem onClick={deleteCard} className="text-destructive">Excluir</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      <KanbanCard card={card} onClick={onClick} />
      <DuplicateCardDialog card={card} open={duplicating} onOpenChange={setDuplicating} />
    </div>
  );
}
