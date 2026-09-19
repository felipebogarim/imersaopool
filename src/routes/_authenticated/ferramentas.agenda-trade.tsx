import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { TradeCalendar, gridRange, moveCursor, periodTitle, visibleRange } from "@/components/agenda-trade/TradeCalendar";
import { TradeActionDialog } from "@/components/agenda-trade/TradeActionDialog";
import { TradePanel } from "@/components/agenda-trade/TradePanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAgendaUsers } from "@/lib/agenda.functions";
import {
  fetchActions,
  fetchCategories,
  fetchCostCenters,
  fetchTripInvestments,
  fetchTrips,
} from "@/lib/agenda-trade-data";
import { summarize } from "@/lib/agenda-trade-metrics";
import type { TradeAction, TradeView } from "@/lib/agenda-trade-types";
import { TRADE_ACTION_TYPES, TRADE_STATUS, brl, tipoLabel } from "@/lib/agenda-trade-types";
import type { AgendaUser } from "@/lib/agenda-types";
import { fetchAllKanbanClients } from "@/lib/kanban-clients";
import { fetchAllKanbanReps } from "@/lib/kanban-reps";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ferramentas/agenda-trade")({
  head: () => ({
    meta: [
      { title: "Agenda de Trade — PoolFlux" },
      { name: "description", content: "Agenda de ações comerciais com controle de investimentos e rateio por cliente." },
      { property: "og:title", content: "Agenda de Trade — PoolFlux" },
      { property: "og:description", content: "Agenda de ações comerciais com controle de investimentos e rateio por cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaTradePage,
});

const VIEWS: { value: TradeView; label: string }[] = [
  { value: "month", label: "Mês" },
  { value: "week", label: "Semana" },
  { value: "list", label: "Lista" },
];

const ALL = "__all__";
const iso = (date: Date) => format(date, "yyyy-MM-dd");

function panelRange(periodo: string, cursor: Date, customStart: string, customEnd: string) {
  switch (periodo) {
    case "trimestre":
      return { start: iso(startOfQuarter(cursor)), end: iso(endOfQuarter(cursor)) };
    case "semestre": {
      const firstHalf = cursor.getMonth() < 6;
      const start = new Date(cursor.getFullYear(), firstHalf ? 0 : 6, 1);
      const end = new Date(cursor.getFullYear(), firstHalf ? 5 : 11, 1);
      return { start: iso(start), end: iso(endOfMonth(end)) };
    }
    case "ano":
      return { start: iso(startOfYear(cursor)), end: iso(endOfYear(cursor)) };
    case "personalizado":
      return { start: customStart || iso(startOfMonth(cursor)), end: customEnd || iso(endOfMonth(cursor)) };
    default:
      return { start: iso(startOfMonth(cursor)), end: iso(endOfMonth(cursor)) };
  }
}

function AgendaTradePage() {
  const queryClient = useQueryClient();
  const loadUsers = useServerFn(getAgendaUsers);
  const [tab, setTab] = useState("agenda");
  const [view, setView] = useState<TradeView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<TradeAction | null>(null);
  const [initialDate, setInitialDate] = useState(() => iso(new Date()));

  const [clientFilter, setClientFilter] = useState("");
  const [repFilter, setRepFilter] = useState(ALL);
  const [tipoFilter, setTipoFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [ccFilter, setCcFilter] = useState(ALL);

  const [periodo, setPeriodo] = useState("mes");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const range = useMemo(() => {
    if (tab === "painel") return panelRange(periodo, cursor, customStart, customEnd);
    const base = view === "list" ? visibleRange("month", cursor) : gridRange(view, cursor);
    return { start: iso(base.start), end: iso(base.end) };
  }, [cursor, customEnd, customStart, periodo, tab, view]);

  const { data: clients = [] } = useQuery({ queryKey: ["trade-clients"], queryFn: fetchAllKanbanClients, staleTime: 10 * 60_000 });
  const { data: reps = [] } = useQuery({ queryKey: ["trade-reps"], queryFn: fetchAllKanbanReps, staleTime: 10 * 60_000 });
  const { data: users = [] } = useQuery({
    queryKey: ["agenda-users"],
    queryFn: () => loadUsers() as Promise<AgendaUser[]>,
    staleTime: 5 * 60_000,
  });
  const { data: categories = [] } = useQuery({ queryKey: ["trade-categories"], queryFn: fetchCategories, staleTime: 10 * 60_000 });
  const { data: costCenters = [] } = useQuery({ queryKey: ["trade-cost-centers"], queryFn: fetchCostCenters, staleTime: 10 * 60_000 });
  const { data: trips = [] } = useQuery({ queryKey: ["trade-trips"], queryFn: fetchTrips, staleTime: 5 * 60_000 });

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ["trade-actions", range.start, range.end],
    queryFn: () => fetchActions(range.start, range.end),
  });
  const { data: tripInvestments = [] } = useQuery({
    queryKey: ["trade-trip-investments", range.start, range.end],
    queryFn: () => fetchTripInvestments(range.start, range.end),
  });

  const clientNames = useMemo(
    () => new Map(clients.map((c) => [c.id, c.nome_fantasia || c.razao_social || "Cliente"])),
    [clients],
  );
  const userNames = useMemo(() => new Map(users.map((u) => [u.id, u.full_name || u.email || "Usuário"])), [users]);
  const ccNames = useMemo(() => new Map(costCenters.map((c) => [c.id, c.nome])), [costCenters]);

  const filtered = useMemo(() => {
    const term = clientFilter.trim().toLowerCase();
    return actions.filter((action) => {
      if (statusFilter !== ALL && action.status !== statusFilter) return false;
      if (tipoFilter !== ALL && action.tipo_acao !== tipoFilter) return false;
      if (repFilter !== ALL && action.representative_id !== repFilter && action.responsavel_id !== repFilter) return false;
      if (ccFilter !== ALL) {
        const hasCc =
          action.cost_center_id === ccFilter || (action.investments ?? []).some((inv) => inv.cost_center_id === ccFilter);
        if (!hasCc) return false;
      }
      if (term) {
        const names = (action.clients ?? []).map((c) => (clientNames.get(c.client_id) ?? "").toLowerCase());
        if (!names.some((name) => name.includes(term))) return false;
      }
      return true;
    });
  }, [actions, ccFilter, clientFilter, clientNames, repFilter, statusFilter, tipoFilter]);

  const summary = useMemo(() => summarize(filtered, tripInvestments), [filtered, tripInvestments]);

  function openNew(date?: Date) {
    setSelected(null);
    setInitialDate(iso(date ?? new Date()));
    setDialogOpen(true);
  }

  function openAction(action: TradeAction) {
    setSelected(action);
    setInitialDate(action.data_inicio);
    setDialogOpen(true);
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["trade-actions"] });
    void queryClient.invalidateQueries({ queryKey: ["trade-trip-investments"] });
    void queryClient.invalidateQueries({ queryKey: ["trade-trips"] });
  }

  const topTipos = [...summary.porTipo.entries()].sort((a, b) => b[1].planejado - a[1].planejado).slice(0, 4);
  const topCcs = [...summary.porCentroCusto.entries()].sort((a, b) => b[1].planejado - a[1].planejado).slice(0, 4);
  const topClientes = [...summary.porCliente.entries()]
    .sort((a, b) => b[1].planejado + b[1].realizado - (a[1].planejado + a[1].realizado))
    .slice(0, 4);

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Agenda de Trade"
        subtitle="Ações comerciais, investimentos por cliente e rateio de despesas de viagem."
        actions={<Button onClick={() => openNew()}><Plus /> Nova ação</Button>}
      />

      <div className="space-y-4 px-4 py-5 sm:px-8">
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="painel">Painel</TabsTrigger>
          </TabsList>

          <TabsContent value="agenda" className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Período anterior" onClick={() => setCursor((date) => moveCursor(view, date, -1))}>
                  <ChevronLeft />
                </Button>
                <Button variant="outline" onClick={() => setCursor(new Date())}>Hoje</Button>
                <Button variant="outline" size="icon" aria-label="Próximo período" onClick={() => setCursor((date) => moveCursor(view, date, 1))}>
                  <ChevronRight />
                </Button>
                <h2 className="w-full text-base font-semibold capitalize sm:ml-2 sm:w-auto sm:text-lg">{periodTitle(view === "list" ? "month" : view, cursor)}</h2>
              </div>
              <div className="grid grid-cols-3 rounded-md border bg-muted/30 p-1">
                {VIEWS.map((item) => (
                  <Button
                    key={item.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => setView(item.value)}
                    className={cn("shadow-none", view === item.value && "bg-background text-foreground shadow-sm")}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente</Label>
                <Input placeholder="Buscar cliente" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Representante / responsável</Label>
                <Select value={repFilter} onValueChange={setRepFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {reps.map((rep) => (<SelectItem key={rep.id} value={rep.id}>{rep.nome ?? "Representante"}</SelectItem>))}
                    {users.map((user) => (<SelectItem key={user.id} value={user.id}>{user.full_name || user.email}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de ação</Label>
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {TRADE_ACTION_TYPES.map((item) => (<SelectItem key={item} value={item}>{item}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {TRADE_STATUS.map((item) => (<SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Centro de custo</Label>
                <Select value={ccFilter} onValueChange={setCcFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {costCenters.map((cc) => (<SelectItem key={cc.id} value={cc.id}>{cc.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardContent className="grid gap-4 p-4 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total planejado</p>
                  <p className="text-lg font-semibold">{brl(summary.total.planejado)}</p>
                  <p className="text-xs text-muted-foreground">Realizado {brl(summary.total.realizado)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Por cliente</p>
                  {topClientes.map(([id, value]) => (
                    <p key={id} className="truncate text-xs">{clientNames.get(id) ?? "Cliente"} · {brl(value.planejado)}</p>
                  ))}
                  {topClientes.length === 0 && <p className="text-xs text-muted-foreground">Sem lançamentos.</p>}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Por tipo de ação</p>
                  {topTipos.map(([tipo, value]) => (
                    <p key={tipo} className="truncate text-xs">{tipo} · {brl(value.planejado)}</p>
                  ))}
                  {topTipos.length === 0 && <p className="text-xs text-muted-foreground">Sem lançamentos.</p>}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Por centro de custo</p>
                  {topCcs.map(([id, value]) => (
                    <p key={id} className="truncate text-xs">{ccNames.get(id) ?? "Sem centro de custo"} · {brl(value.planejado)}</p>
                  ))}
                  {topCcs.length === 0 && <p className="text-xs text-muted-foreground">Sem lançamentos.</p>}
                </div>
              </CardContent>
            </Card>

            {isLoading ? (
              <div className="grid min-h-[420px] place-items-center rounded-lg border bg-card text-sm text-muted-foreground">
                Carregando agenda de trade…
              </div>
            ) : (
              <TradeCalendar
                view={view}
                cursor={cursor}
                actions={filtered}
                clientNames={clientNames}
                userNames={userNames}
                onSelectDay={(date) => openNew(date)}
                onSelectAction={openAction}
              />
            )}
          </TabsContent>

          <TabsContent value="painel" className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Período</Label>
                <Select value={periodo} onValueChange={setPeriodo}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mes">Mês</SelectItem>
                    <SelectItem value="trimestre">Trimestre</SelectItem>
                    <SelectItem value="semestre">Semestre</SelectItem>
                    <SelectItem value="ano">Ano</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {periodo === "personalizado" ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">De</Label>
                    <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Até</Label>
                    <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" aria-label="Anterior" onClick={() => setCursor((d) => moveCursor("month", d, -1))}>
                    <ChevronLeft />
                  </Button>
                  <span className="text-sm font-medium">{range.start} – {range.end}</span>
                  <Button variant="outline" size="icon" aria-label="Próximo" onClick={() => setCursor((d) => moveCursor("month", d, 1))}>
                    <ChevronRight />
                  </Button>
                </div>
              )}
            </div>

            <TradePanel
              actions={filtered}
              tripInvestments={tripInvestments}
              clientNames={clientNames}
              users={users}
              costCenters={costCenters}
            />
          </TabsContent>
        </Tabs>
      </div>

      <TradeActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={selected}
        initialDate={initialDate}
        clients={clients}
        users={users}
        reps={reps}
        categories={categories}
        costCenters={costCenters}
        trips={trips}
        onSaved={refresh}
      />
    </div>
  );
}

export { tipoLabel };
