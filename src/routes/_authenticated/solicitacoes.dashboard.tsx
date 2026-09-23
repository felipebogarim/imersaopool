import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiRow } from "@/components/internal-tickets/dashboard/KpiRow";
import { SlaAverages } from "@/components/internal-tickets/dashboard/SlaAverages";
import { VolumeBarChart } from "@/components/internal-tickets/dashboard/VolumeBarChart";
import { TrendChart } from "@/components/internal-tickets/dashboard/TrendChart";
import { SlowestSectorsChart } from "@/components/internal-tickets/dashboard/SlowestSectorsChart";
import { CriticalTicketsTable } from "@/components/internal-tickets/dashboard/CriticalTicketsTable";
import {
  listCategories,
  listInternalTickets,
  listProfilesByIds,
  listSectors,
  type TicketListRow,
} from "@/lib/internal-tickets/queries";
import {
  computeAvgFirstResponseMinutes,
  computeAvgResolutionMinutes,
  computeCreatedPerWeek,
  computeCriticalTickets,
  computeKpis,
  computeSlowestSectors,
  computeVolume,
  toDashboardTicket,
} from "@/lib/internal-tickets/dashboard-metrics";
import { TICKET_STATUS_LABEL } from "@/lib/internal-tickets/status";
import { TICKET_PRIORITY_LABEL } from "@/lib/internal-tickets/priority";

export const Route = createFileRoute("/_authenticated/solicitacoes/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Solicitações Internas — PoolFlux" }] }),
  component: TicketsDashboardPage,
});

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o período" },
] as const;

function TicketsDashboardPage() {
  const navigate = useNavigate();
  const ticketsQuery = useQuery({ queryKey: ["internal-tickets"], queryFn: listInternalTickets });
  const sectorsQuery = useQuery({ queryKey: ["internal-ticket-sectors"], queryFn: listSectors });
  const categoriesQuery = useQuery({
    queryKey: ["internal-ticket-categories"],
    queryFn: listCategories,
  });

  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]["value"]>("30");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [requesterFilter, setRequesterFilter] = useState("all");

  const allTickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const requesterIds = useMemo(
    () => Array.from(new Set(allTickets.map((t) => t.requester_user_id))),
    [allTickets],
  );
  const profilesQuery = useQuery({
    queryKey: ["internal-ticket-requesters", requesterIds],
    queryFn: () => listProfilesByIds(requesterIds),
    enabled: requesterIds.length > 0,
  });

  const filtered: TicketListRow[] = useMemo(() => {
    const now = Date.now();
    const cutoff = period === "all" ? null : now - Number(period) * 24 * 60 * 60 * 1000;
    return allTickets.filter((t) => {
      if (cutoff && new Date(t.created_at).getTime() < cutoff) return false;
      if (sectorFilter !== "all" && t.sector_id !== sectorFilter) return false;
      if (categoryFilter !== "all" && t.category_id !== categoryFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (requesterFilter !== "all" && t.requester_user_id !== requesterFilter) return false;
      return true;
    });
  }, [
    allTickets,
    period,
    sectorFilter,
    categoryFilter,
    priorityFilter,
    statusFilter,
    requesterFilter,
  ]);

  const dashboardTickets = useMemo(() => filtered.map(toDashboardTicket), [filtered]);

  const sectorName = (id: string) => sectorsQuery.data?.find((s) => s.id === id)?.name ?? "—";
  const categoryName = (id: string) => categoriesQuery.data?.find((c) => c.id === id)?.name ?? "—";
  const ticketTitle = (id: string) => filtered.find((t) => t.id === id)?.title ?? "—";
  const ticketNumber = (id: string) => filtered.find((t) => t.id === id)?.ticket_number ?? "—";

  const kpis = computeKpis(dashboardTickets);
  const criticalTickets = computeCriticalTickets(dashboardTickets);
  const slowestSectors = computeSlowestSectors(dashboardTickets);
  const trend = computeCreatedPerWeek(dashboardTickets, 8);

  return (
    <div className="min-h-screen bg-background pb-10">
      <PageHeader title="Dashboard" subtitle="Indicadores das Solicitações Internas" compact />
      <div className="mx-auto max-w-6xl space-y-4 bg-muted/30 px-4 py-4 sm:px-8">
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {(sectorsQuery.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {(categoriesQuery.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              {Object.entries(TICKET_PRIORITY_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(TICKET_STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={requesterFilter} onValueChange={setRequesterFilter}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="Solicitante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os solicitantes</SelectItem>
              {(profilesQuery.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name ?? p.email ?? p.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <KpiRow kpis={kpis} />
        <SlaAverages
          avgFirstResponseMinutes={computeAvgFirstResponseMinutes(dashboardTickets)}
          avgResolutionMinutes={computeAvgResolutionMinutes(dashboardTickets)}
        />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <VolumeBarChart
            title="Volume por setor"
            buckets={computeVolume(dashboardTickets, (t) => sectorName(t.sectorId))}
          />
          <VolumeBarChart
            title="Volume por categoria"
            buckets={computeVolume(dashboardTickets, (t) => categoryName(t.categoryId))}
          />
          <VolumeBarChart
            title="Volume por prioridade"
            buckets={computeVolume(dashboardTickets, (t) => TICKET_PRIORITY_LABEL[t.priority])}
          />
          <VolumeBarChart
            title="Volume por status"
            buckets={computeVolume(dashboardTickets, (t) => TICKET_STATUS_LABEL[t.status])}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <TrendChart buckets={trend} />
          <SlowestSectorsChart rows={slowestSectors} sectorName={sectorName} />
        </div>

        <CriticalTicketsTable
          tickets={criticalTickets}
          ticketTitle={ticketTitle}
          ticketNumber={ticketNumber}
          sectorName={sectorName}
          onSelect={(ticketId) => navigate({ to: "/solicitacoes/$ticketId", params: { ticketId } })}
        />
      </div>
    </div>
  );
}
