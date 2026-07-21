import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trello, LayoutGrid, Calendar, AlertTriangle, CheckCircle2, Clock, ListChecks, Users, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Board, KCard, KanbanPriority, Workspace } from "@/lib/kanban-types";
import { PRIORITY_COLOR, PRIORITY_LABEL } from "@/lib/kanban-types";
import { cn } from "@/lib/utils";
import { useIsMasterAdmin } from "@/hooks/use-is-admin";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/tarefas/")({
  head: () => ({ meta: [{ title: "Gestão de Tarefas — PoolFlux" }] }),
  component: TarefasPage,
});

function TarefasPage() {
  const [openNewWs, setOpenNewWs] = useState(false);

  return (
    <div>
      <PageHeader
        title="Gestão de Tarefas"
        subtitle="Workspaces e boards no estilo Kanban para gerir tudo o que precisa acontecer."
        actions={
          <Dialog open={openNewWs} onOpenChange={setOpenNewWs}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Novo workspace</Button>
            </DialogTrigger>
            <NewWorkspaceDialog onDone={() => setOpenNewWs(false)} />
          </Dialog>
        }
      />

      <div className="px-4 sm:px-8">
        <Tabs defaultValue="boards">
          <TabsList>
            <TabsTrigger value="boards" className="gap-2"><LayoutGrid className="h-4 w-4" /> Boards</TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2"><Trello className="h-4 w-4" /> Dashboard</TabsTrigger>
            <TabsTrigger value="minhas" className="gap-2"><ListChecks className="h-4 w-4" /> Minhas tarefas</TabsTrigger>
          </TabsList>
          <TabsContent value="boards" className="mt-4"><BoardsView /></TabsContent>
          <TabsContent value="dashboard" className="mt-4"><DashboardView /></TabsContent>
          <TabsContent value="minhas" className="mt-4"><MyTasksView /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============= WORKSPACES + BOARDS =============
function BoardsView() {
  const qc = useQueryClient();
  const isMaster = useIsMasterAdmin();
  const [openNewBoard, setOpenNewBoard] = useState<string | null>(null);

  async function editWorkspace(ws: Workspace) {
    const name = prompt("Nome do workspace:", ws.name)?.trim();
    if (!name || name === ws.name) return;
    const { error } = await supabase.from("kanban_workspaces").update({ name }).eq("id", ws.id);
    if (error) return toast.error(error.message);
    toast.success("Workspace atualizado");
    qc.invalidateQueries({ queryKey: ["kanban-workspaces"] });
  }
  async function deleteWorkspace(ws: Workspace) {
    if (!confirm(`Excluir workspace "${ws.name}"? Os boards também serão arquivados.`)) return;
    const now = new Date().toISOString();
    await supabase.from("kanban_boards").update({ archived_at: now }).eq("workspace_id", ws.id);
    const { error } = await supabase.from("kanban_workspaces").update({ archived_at: now }).eq("id", ws.id);
    if (error) return toast.error(error.message);
    toast.success("Workspace excluído");
    qc.invalidateQueries({ queryKey: ["kanban-workspaces"] });
    qc.invalidateQueries({ queryKey: ["kanban-boards-all"] });
  }

  const { data: workspaces = [], isLoading: loadingWs } = useQuery({
    queryKey: ["kanban-workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_workspaces")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Workspace[];
    },
  });

  const { data: boards = [] } = useQuery({
    queryKey: ["kanban-boards-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_boards")
        .select("*")
        .is("archived_at", null)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Board[];
    },
  });

  if (loadingWs) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (workspaces.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <Users className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="mt-3 font-medium">Nenhum workspace ainda</h3>
        <p className="mt-1 text-sm text-muted-foreground">Crie um workspace para começar a organizar tarefas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {workspaces.map((ws) => {
        const wsBoards = boards.filter((b) => b.workspace_id === ws.id);
        return (
          <section key={ws.id}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded" style={{ background: ws.color ?? "#3B82F6" }} />
                <div>
                  <h3 className="font-semibold">{ws.name}</h3>
                  {ws.description && <p className="text-xs text-muted-foreground">{ws.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={openNewBoard === ws.id} onOpenChange={(o) => setOpenNewBoard(o ? ws.id : null)}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2"><Plus className="h-3.5 w-3.5" /> Novo board</Button>
                  </DialogTrigger>
                  <NewBoardDialog workspaceId={ws.id} onDone={() => { setOpenNewBoard(null); qc.invalidateQueries({ queryKey: ["kanban-boards-all"] }); }} />
                </Dialog>
                {isMaster && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => editWorkspace(ws)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteWorkspace(ws)} className="text-destructive">Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            {wsBoards.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Sem boards. Clique em "Novo board" para criar o primeiro.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {wsBoards.map((b) => <BoardCard key={b.id} board={b} isMaster={isMaster} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function BoardCard({ board, isMaster }: { board: Board; isMaster: boolean }) {
  const qc = useQueryClient();
  const { data: counts } = useQuery({
    queryKey: ["board-card-count", board.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("kanban_cards")
        .select("*", { count: "exact", head: true })
        .eq("board_id", board.id)
        .is("archived_at", null);
      return count ?? 0;
    },
  });

  async function editBoard(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const name = prompt("Nome do board:", board.name)?.trim();
    if (!name || name === board.name) return;
    const { error } = await supabase.from("kanban_boards").update({ name }).eq("id", board.id);
    if (error) return toast.error(error.message);
    toast.success("Board atualizado");
    qc.invalidateQueries({ queryKey: ["kanban-boards-all"] });
  }
  async function deleteBoard(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`Excluir board "${board.name}"?`)) return;
    const { error } = await supabase.from("kanban_boards").update({ archived_at: new Date().toISOString() }).eq("id", board.id);
    if (error) return toast.error(error.message);
    toast.success("Board excluído");
    qc.invalidateQueries({ queryKey: ["kanban-boards-all"] });
  }

  return (
    <Link
      to="/tarefas/b/$boardId"
      params={{ boardId: board.id }}
      className="group relative rounded-lg border bg-card p-4 shadow-sm transition hover:shadow-md"
    >
      {isMaster && (
        <div className="absolute right-2 top-2" onClick={(e) => e.preventDefault()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={editBoard}>Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={deleteBoard} className="text-destructive">Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div className="mb-2 h-2 w-16 rounded" style={{ background: board.color ?? "#3B82F6" }} />
      <div className="font-medium">{board.name}</div>
      {board.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{board.description}</p>}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{counts ?? 0} {(counts ?? 0) === 1 ? "card" : "cards"}</span>
        <span className="opacity-0 group-hover:opacity-100">Abrir →</span>
      </div>
    </Link>
  );
}

function NewWorkspaceDialog({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Dê um nome ao workspace");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("kanban_workspaces").insert({
      name: name.trim(),
      description: description.trim() || null,
      color,
      created_by: u.user!.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Workspace criado");
    qc.invalidateQueries({ queryKey: ["kanban-workspaces"] });
    setName(""); setDescription("");
    onDone();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo workspace</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Marketing 2026" autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Descrição</label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Cor</label>
          <div className="flex gap-2">
            {["#3B82F6", "#8B5CF6", "#EF4444", "#F59E0B", "#10B981", "#EC4899", "#6366F1", "#14B8A6"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn("h-8 w-8 rounded ring-offset-2", color === c && "ring-2 ring-primary")}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Criar workspace"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function NewBoardDialog({ workspaceId, onDone }: { workspaceId: string; onDone: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Dê um nome ao board");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("kanban_boards").insert({
      workspace_id: workspaceId,
      name: name.trim(),
      description: description.trim() || null,
      color,
      created_by: u.user!.id,
    }).select("id").single();
    setSaving(false);
    if (error || !data) return toast.error(error?.message ?? "Erro");
    toast.success("Board criado");
    onDone();
    navigate({ to: "/tarefas/b/$boardId", params: { boardId: data.id } });
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo board</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Descrição</label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Cor</label>
          <div className="flex gap-2">
            {["#3B82F6", "#8B5CF6", "#EF4444", "#F59E0B", "#10B981", "#EC4899", "#6366F1", "#14B8A6"].map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={cn("h-8 w-8 rounded", color === c && "ring-2 ring-primary")}
                style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Criando…" : "Criar board"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============= DASHBOARD =============
function DashboardView() {
  const { data: cards = [] } = useQuery({
    queryKey: ["kanban-cards-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_cards")
        .select("*")
        .is("archived_at", null);
      if (error) throw error;
      return (data ?? []) as KCard[];
    },
  });

  const stats = useMemo(() => {
    const now = new Date();
    const overdue = cards.filter((c) => c.due_date && new Date(c.due_date) < now && !c.completed_at).length;
    const dueWeek = cards.filter((c) => {
      if (!c.due_date || c.completed_at) return false;
      const d = new Date(c.due_date);
      const w = new Date(); w.setDate(now.getDate() + 7);
      return d >= now && d <= w;
    }).length;
    const completed = cards.filter((c) => c.completed_at).length;
    const byPriority: Record<KanbanPriority, number> = { baixa: 0, media: 0, alta: 0, urgente: 0 };
    cards.forEach((c) => { byPriority[c.priority]++; });
    return { total: cards.length, overdue, dueWeek, completed, byPriority };
  }, [cards]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={LayoutGrid} label="Total de cards" value={stats.total} />
        <StatCard icon={AlertTriangle} label="Atrasados" value={stats.overdue} tone="text-red-600" />
        <StatCard icon={Clock} label="Vencem em 7 dias" value={stats.dueWeek} tone="text-amber-600" />
        <StatCard icon={CheckCircle2} label="Concluídos" value={stats.completed} tone="text-emerald-600" />
      </div>
      <div className="rounded-lg border p-4">
        <div className="mb-3 text-sm font-medium">Por prioridade</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(stats.byPriority) as KanbanPriority[]).map((p) => (
            <Badge key={p} variant="outline" className={cn("gap-1", PRIORITY_COLOR[p])}>
              {PRIORITY_LABEL[p]}: {stats.byPriority[p]}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4 text-muted-foreground", tone)} />
      </div>
      <div className={cn("mt-2 text-2xl font-semibold", tone)}>{value}</div>
    </div>
  );
}

// ============= MINHAS TAREFAS =============
function MyTasksView() {
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["kanban-my-cards"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data: memberships } = await supabase
        .from("kanban_card_members")
        .select("card_id")
        .eq("user_id", u.user.id);
      const ids = (memberships ?? []).map((m) => m.card_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("kanban_cards")
        .select("*")
        .in("id", ids)
        .is("archived_at", null)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as KCard[];
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (cards.length === 0) return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Você ainda não é responsável por nenhum card.</div>;

  return (
    <ul className="space-y-2">
      {cards.map((c) => (
        <li key={c.id}>
          <Link
            to="/tarefas/b/$boardId"
            params={{ boardId: c.board_id }}
            search={{ card: c.id }}
            className="flex items-center justify-between rounded-lg border bg-card p-3 hover:shadow"
          >
            <div>
              <div className="font-medium">{c.title}</div>
              {c.due_date && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(c.due_date).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
            <Badge className={PRIORITY_COLOR[c.priority]}>{PRIORITY_LABEL[c.priority]}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
