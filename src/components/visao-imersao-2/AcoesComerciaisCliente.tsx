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
import { MoreVertical, ExternalLink, ClipboardList } from "lucide-react";

type Props = {
  clientId?: string | null;
  clientName?: string | null;
};

type CardRow = {
  id: string;
  title: string;
  board_id: string;
  created_at: string;
  due_date: string | null;
  completed_at: string | null;
  archived_at: string | null;
  metadata: any;
  kanban_lists: { name: string } | null;
};

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
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
      const filters: string[] = [];
      if (clientId) filters.push(`metadata->>client_id.eq.${clientId}`);
      if (clientName) filters.push(`metadata->>client_name.ilike.%${clientName}%`);
      if (!filters.length) return [] as CardRow[];

      const { data, error } = await supabase
        .from("kanban_cards")
        .select("id, title, board_id, created_at, due_date, completed_at, archived_at, metadata, kanban_lists(name)")
        .or(filters.join(","))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CardRow[];
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
            return (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Inserida em {fmt(c.created_at)} · Previsão de conclusão {fmt(c.due_date)}
                  </p>
                </div>
                <Badge className={`shrink-0 border-0 ${st.cls}`}>{st.label}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Ações">
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
