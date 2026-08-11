import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, ExternalLink, ClipboardList, CalendarClock, AlertCircle } from "lucide-react";
import type { KanbanPriority } from "@/lib/kanban-types";
import { PRIORITY_LABEL, PRIORITY_COLOR } from "@/lib/kanban-types";

type Props = {
  clientId?: string | null;
  clientName?: string | null;
};

type Label = { name: string; color: string };

type Member = { full_name: string | null; email: string | null };

type CardRow = {
  id: string;
  title: string;
  board_id: string;
  list_id: string;
  created_at: string;
  due_date: string | null;
  completed_at: string | null;
  archived_at: string | null;
  priority: KanbanPriority | null;
  metadata: any;
  kanban_lists: { name: string } | null;
  kanban_card_labels: { kanban_labels: Label | null }[] | null;
  kanban_card_members: { profiles: Member | null }[] | null;
};

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

function daysDiff(due: string): number {
  const dueDate = new Date(due);
  const today = new Date();
  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function dueHint(c: CardRow) {
  if (!c.due_date || c.completed_at || c.archived_at) return null;
  const d = daysDiff(c.due_date);
  if (d < 0) return { label: `Atrasada ${Math.abs(d)} dia${Math.abs(d) === 1 ? "" : "s"}`, cls: "text-destructive" };
  if (d === 0) return { label: "Vence hoje", cls: "text-amber-600" };
  if (d === 1) return { label: "Vence amanhã", cls: "text-amber-600" };
  if (d <= 3) return { label: `Vence em ${d} dias`, cls: "text-amber-600" };
  return { label: `Em ${d} dias`, cls: "text-muted-foreground" };
}

function statusOf(c: CardRow) {
  if (c.archived_at) return { label: "Arquivada", cls: "bg-muted text-muted-foreground" };
  if (c.completed_at) return { label: "Concluída", cls: "bg-emerald-500/15 text-emerald-600" };
  const sug = c.metadata?.suggested_action?.status;
  if (sug === "pendente") return { label: "Aguardando aprovação", cls: "bg-amber-500/15 text-amber-600" };
  if (sug === "reprovada") return { label: "Reprovada", cls: "bg-destructive/15 text-destructive" };
  if (c.due_date && new Date(c.due_date) < new Date())
    return { label: "Atrasada", cls: "bg-destructive/15 text-destructive" };
  return { label: c.kanban_lists?.name || "Em andamento", cls: "bg-primary/10 text-primary" };
}

export function AcoesComerciaisCliente({ clientId, clientName }: Props) {
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["acoes-cliente", clientId, clientName],
    enabled: Boolean(clientId || clientName),
    queryFn: async () => {
      // kanban_card_members.user_id aponta para auth.users, então o embed de profiles
      // não é possível via PostgREST — buscamos os responsáveis em uma segunda etapa.
      const select = `id, title, board_id, list_id, created_at, due_date, completed_at, archived_at, priority, metadata,
          kanban_lists(name),
          kanban_card_labels(kanban_labels(name, color)),
          kanban_card_members(user_id)`;

      const byId = new Map<string, CardRow>();

      if (clientId) {
        const { data, error } = await supabase
          .from("kanban_cards")
          .select(select)
          .eq("metadata->>client_id", clientId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        for (const r of (data ?? []) as unknown as CardRow[]) byId.set(r.id, r);
      }

      const name = (clientName ?? "").trim();
      if (name) {
        const { data, error } = await supabase
          .from("kanban_cards")
          .select(select)
          .ilike("metadata->>client_name", `%${name}%`)
          .order("created_at", { ascending: false });
        if (error) throw error;
        for (const r of (data ?? []) as unknown as CardRow[]) byId.set(r.id, r);
      }

      const rows = Array.from(byId.values());

      const userIds = Array.from(
        new Set(rows.flatMap((r) => (r.kanban_card_members ?? []).map((m) => m.user_id))),
      ).filter(Boolean);

      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p as Member]));
        for (const r of rows) {
          r.members = (r.kanban_card_members ?? [])
            .map((m) => map.get(m.user_id))
            .filter(Boolean) as Member[];
        }
      }

      return rows.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
  });



  return (
    <section className="surface overflow-hidden rounded-xl" aria-labelledby="vi2-acoes-cliente">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h3 id="vi2-acoes-cliente" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Ações Comerciais no Cliente
        </h3>
      </div>

      {isLoading ? (
        <p className="p-4 text-sm text-muted-foreground">Carregando ações…</p>
      ) : cards.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          Nenhuma ação vinculada a este cliente na Gestão de Tarefas.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {cards.map((c) => {
            const st = statusOf(c);
            const dh = dueHint(c);
            const labels = (c.kanban_card_labels ?? []).map((l) => l.kanban_labels).filter(Boolean) as Label[];
            const members = (c.kanban_card_members ?? []).map((m) => m.profiles).filter(Boolean) as Member[];
            const priority = c.priority;
            return (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    {priority && (
                      <Badge className={`border-0 px-1.5 py-0 text-[10px] ${PRIORITY_COLOR[priority]}`}>
                        {PRIORITY_LABEL[priority]}
                      </Badge>
                    )}
                    {labels.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        {labels.slice(0, 3).map((l, i) => (
                          <span
                            key={i}
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: l.color || "#94a3b8" }}
                            title={l.name}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>Etapa: <span className="font-medium text-foreground">{c.kanban_lists?.name || "—"}</span></span>
                    <span>Inserida em {fmt(c.created_at)}</span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      Previsão: <span className="font-medium text-foreground">{fmt(c.due_date)}</span>
                      {dh && (
                        <span className={`inline-flex items-center gap-1 font-medium ${dh.cls}`}>
                          <AlertCircle className="h-3 w-3" />
                          {dh.label}
                        </span>
                      )}
                    </span>
                  </p>
                  {members.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Responsável{members.length > 1 ? "es" : ""}:{" "}
                      {members.map((m) => m.full_name || m.email || "—").join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge className={`border-0 ${st.cls}`}>{st.label}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ações">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(`/tarefas/b/${c.board_id}?card=${c.id}`, "_blank", "noopener,noreferrer")
                        }
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ver ação
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        Espelho da Gestão de Tarefas — a ação oficial permanece lá.
      </p>
    </section>
  );
}
