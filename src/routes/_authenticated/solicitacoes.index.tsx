import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, MoreVertical, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listCategories, listInternalTickets, listSectors } from "@/lib/internal-tickets/queries";
import {
  TICKET_STATUS_LABEL,
  TICKET_STATUSES,
  type TicketStatus,
} from "@/lib/internal-tickets/status";
import { TICKET_PRIORITY_LABEL } from "@/lib/internal-tickets/priority";
import { isOverdue } from "@/lib/internal-tickets/sla";
import { deleteInternalTicket } from "@/lib/internal-tickets/ticket-actions.functions";
import { useIsMasterUser } from "@/hooks/use-is-master-user";

export const Route = createFileRoute("/_authenticated/solicitacoes/")({
  head: () => ({ meta: [{ title: "Solicitações Internas — PoolFlux" }] }),
  component: TicketsListPage,
});

const PRIORITY_BADGE: Record<string, string> = {
  urgente: "border-destructive/30 bg-destructive/10 text-destructive",
  alta: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  normal: "border-border bg-muted text-muted-foreground",
  baixa: "border-border bg-muted text-muted-foreground",
};

function TicketsListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isMasterUser = useIsMasterUser();
  const ticketsQuery = useQuery({ queryKey: ["internal-tickets"], queryFn: listInternalTickets });
  const sectorsQuery = useQuery({ queryKey: ["internal-ticket-sectors"], queryFn: listSectors });
  const categoriesQuery = useQuery({
    queryKey: ["internal-ticket-categories"],
    queryFn: listCategories,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");

  const sectorName = (id: string) => sectorsQuery.data?.find((s) => s.id === id)?.name ?? "—";
  const categoryName = (id: string) => categoriesQuery.data?.find((c) => c.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (ticketsQuery.data ?? []).filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.ticket_number.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [ticketsQuery.data, search, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: (ticketId: string) => deleteInternalTicket({ data: { ticketId } }),
    onSuccess: () => {
      toast.success("Ticket excluído");
      qc.invalidateQueries({ queryKey: ["internal-tickets"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao excluir ticket"),
  });

  function handleDelete(ticket: { id: string; ticket_number: string; title: string }) {
    if (
      !confirm(
        `Excluir definitivamente o ticket ${ticket.ticket_number} — "${ticket.title}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    deleteMutation.mutate(ticket.id);
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <PageHeader
        title="Solicitações Internas"
        subtitle="Tickets do Comercial para outros setores"
        actions={
          <Button asChild size="sm" className="gap-2">
            <Link to="/solicitacoes/novo">
              <Plus className="h-4 w-4" /> Novo ticket
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou número…"
            className="h-9 w-64"
          />
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {TICKET_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {TICKET_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                {isMasterUser && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isMasterUser ? 7 : 6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum ticket encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((ticket) => {
                const overdue =
                  isOverdue(
                    ticket.sla_first_response_due_at
                      ? new Date(ticket.sla_first_response_due_at)
                      : null,
                    null,
                  ) && !["respondido", "concluido", "cancelado"].includes(ticket.status);
                return (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() =>
                      navigate({ to: "/solicitacoes/$ticketId", params: { ticketId: ticket.id } })
                    }
                  >
                    <TableCell className="font-medium">
                      <span className="text-xs text-muted-foreground">{ticket.ticket_number}</span>
                      <span className="block">{ticket.title}</span>
                    </TableCell>
                    <TableCell>{sectorName(ticket.sector_id)}</TableCell>
                    <TableCell>{categoryName(ticket.category_id)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={PRIORITY_BADGE[ticket.priority] ?? PRIORITY_BADGE.normal}
                      >
                        {TICKET_PRIORITY_LABEL[ticket.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <Badge variant="outline">{TICKET_STATUS_LABEL[ticket.status]}</Badge>
                        {overdue && (
                          <AlertTriangle
                            className="h-3.5 w-3.5 text-destructive"
                            aria-label="Atrasado"
                          />
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    {isMasterUser && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(ticket)}
                            >
                              <Trash2 className="h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
