import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart3, Loader2, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExecutiveTable } from "@/components/director-bi/ExecutiveTable";
import { DirectorKpiRow } from "@/components/director-bi/DirectorKpis";
import { StatusDonutChart, ResponsibleBarChart } from "@/components/director-bi/DirectorCharts";
import { useDirectorBI } from "@/hooks/useDirectorBI";
import {
  DIRECTOR_AREAS,
  computeActionsByResponsible,
  computeDirectorKpis,
  computeStatusBreakdown,
  filterDirectorActions,
  normalize,
  type DirectorFilter,
} from "@/lib/director-bi";
import { AREA_LABEL, type ExecArea } from "@/lib/executive-report/types";

export const Route = createFileRoute("/_authenticated/bi-diretor")({
  head: () => ({ meta: [{ title: "BI Diretor — PoolFlux" }] }),
  component: BIDiretorPage,
});

const FILTERS: { value: DirectorFilter; label: string }[] = [
  { value: "active", label: "Em andamento" },
  { value: "completed", label: "Concluídas" },
  { value: "all", label: "Todas" },
];

function BIDiretorPage() {
  const [area, setArea] = useState<ExecArea>("commercial");
  const [status, setStatus] = useState<DirectorFilter>("active");
  const [representative, setRepresentative] = useState("all");
  const [search, setSearch] = useState("");
  const query = useDirectorBI();
  const actions = useMemo(() => query.data?.actions ?? [], [query.data]);
  // Ações da categoria (e representante, quando aplicável) atualmente selecionada, em qualquer status.
  const areaActions = useMemo(
    () => filterDirectorActions(actions, area, "all", representative),
    [actions, area, representative],
  );
  const kpis = useMemo(() => computeDirectorKpis(areaActions), [areaActions]);
  const statusBreakdown = useMemo(() => computeStatusBreakdown(areaActions), [areaActions]);
  const byResponsible = useMemo(() => computeActionsByResponsible(areaActions), [areaActions]);
  const filteredByStatus = filterDirectorActions(actions, area, status, representative);
  const searchTerm = normalize(search.trim());
  const filtered = searchTerm
    ? filteredByStatus.filter(
        (action) =>
          normalize(action.title).includes(searchTerm) ||
          normalize(action.responsible).includes(searchTerm) ||
          normalize(action.description ?? "").includes(searchTerm),
      )
    : filteredByStatus;
  const unclassified = actions.filter((action) => !action.area).length;
  const lastUpdated = query.dataUpdatedAt
    ? new Date(query.dataUpdatedAt).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-background pb-10">
      <PageHeader
        title="BI Diretor"
        subtitle="Acompanhamento executivo das ações da Imersão Comercial"
        actions={
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                Última atualização {lastUpdated}
              </span>
            )}
            <Button disabled={query.isFetching} onClick={() => void query.refetch()}>
              <RefreshCw
                className={query.isFetching ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"}
              />{" "}
              Atualizar
            </Button>
          </div>
        }
      />
      <div className="mx-auto max-w-[1600px] space-y-3 bg-muted/30 px-3 py-3 sm:px-6 lg:px-8">
        {!query.isPending && !query.isError && (
          <>
            <DirectorKpiRow kpis={kpis} />
            <div className="grid gap-3 lg:grid-cols-2">
              <StatusDonutChart data={statusBreakdown} />
              <ResponsibleBarChart data={byResponsible} />
            </div>
          </>
        )}
        <Tabs value={area} onValueChange={(value) => setArea(value as ExecArea)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-fit sm:grid-cols-4">
            {DIRECTOR_AREAS.map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                className="rounded-md px-4 py-2 text-xs font-medium uppercase tracking-wide data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                {AREA_LABEL[key]}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="my-3 flex flex-wrap items-end gap-4">
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-muted-foreground">Status</legend>
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((filter) => {
                  const count = filterDirectorActions(
                    actions,
                    area,
                    filter.value,
                    representative,
                  ).length;
                  return (
                    <Button
                      key={filter.value}
                      size="sm"
                      variant={status === filter.value ? "default" : "outline"}
                      aria-pressed={status === filter.value}
                      onClick={() => setStatus(filter.value)}
                      className="gap-1.5"
                    >
                      {filter.label}
                      <span
                        className={
                          status === filter.value
                            ? "rounded-full bg-primary-foreground/20 px-1.5 text-xs"
                            : "rounded-full bg-muted px-1.5 text-xs text-muted-foreground"
                        }
                      >
                        {count}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </fieldset>
            <div className="relative w-full sm:ml-auto sm:w-72">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar ação, responsável ou palavra-chave…"
                className="pl-8"
              />
            </div>
            {area === "commercial" && (
              <div className="w-full sm:w-64">
                <label
                  htmlFor="director-representative"
                  className="mb-2 block text-xs font-medium text-muted-foreground"
                >
                  Representante Comercial
                </label>
                <Select value={representative} onValueChange={setRepresentative}>
                  <SelectTrigger id="director-representative">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os representantes</SelectItem>
                    {query.data?.reps.map((rep) => (
                      <SelectItem key={rep.id} value={rep.id}>
                        {rep.nome || "Representante sem nome"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {DIRECTOR_AREAS.map((key) => (
            <TabsContent key={key} value={key}>
              {query.isPending ? (
                <div
                  role="status"
                  className="flex items-center justify-center gap-2 py-16 text-muted-foreground"
                >
                  <Loader2 className="h-5 w-5 animate-spin" /> Carregando frentes…
                </div>
              ) : query.isError ? (
                <div role="alert" className="rounded-xl border p-6 text-sm">
                  Não foi possível atualizar o quadro. {query.error.message}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-3"
                    onClick={() => void query.refetch()}
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <>
                  <p role="status" className="mb-3 text-xs text-muted-foreground">
                    {filtered.length} {filtered.length === 1 ? "ação" : "ações"} · Clique no título
                    para abrir a ação original.
                  </p>
                  {unclassified > 0 && (
                    <p className="mb-3 text-sm text-muted-foreground">
                      Há {unclassified} ação(ões) selecionada(s) fora dos quatro quadros. Confira a
                      categoria na Gestão de Tarefas.
                    </p>
                  )}
                  {filtered.length ? (
                    <ExecutiveTable actions={filtered} />
                  ) : (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-5 py-12 text-center">
                      <BarChart3 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                      <h3 className="font-medium">Nenhuma frente nesta visualização</h3>
                      <p className="max-w-md text-sm text-muted-foreground">
                        Ajuste os filtros ou use “Mostrar no BI Diretor” no menu de uma ação para
                        incluí-la aqui.
                      </p>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
