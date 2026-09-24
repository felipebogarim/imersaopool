import { createFileRoute } from "@tanstack/react-router";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ExecutiveTable } from "@/components/director-bi/ExecutiveTable";
import { RepresentativeTable } from "@/components/director-bi/RepresentativeTable";
import { StatusDonutChart } from "@/components/director-bi/DirectorCharts";
import { useDirectorBI } from "@/hooks/useDirectorBI";
import { DIRECTOR_AREAS, computeStatusBreakdown, filterDirectorActions } from "@/lib/director-bi";
import { AREA_LABEL, type ExecArea } from "@/lib/executive-report/types";

export const Route = createFileRoute("/_authenticated/bi-diretor")({
  head: () => ({ meta: [{ title: "BI Diretor — PoolFlux" }] }),
  component: BIDiretorPage,
});

function BIDiretorPage() {
  type DirectorTab = ExecArea | "reps";
  const tabs: DirectorTab[] = [...DIRECTOR_AREAS, "reps"];
  const [area, setArea] = useState<DirectorTab>("commercial");
  const queryClient = useQueryClient();
  const repNotesFetching = useIsFetching({ queryKey: ["director-rep-notes"] });
  const query = useDirectorBI();
  const isRefreshing = query.isFetching || repNotesFetching > 0;
  const actions = useMemo(() => query.data?.actions ?? [], [query.data]);
  // Todas as ações da área selecionada, em qualquer status — contexto executivo geral.
  // Os filtros de coluna da tabela atuam depois, só sobre a lista já mostrada.
  const areaActions = useMemo(
    () => (area === "reps" ? [] : filterDirectorActions(actions, area, "all")),
    [actions, area],
  );
  const statusBreakdown = useMemo(() => computeStatusBreakdown(areaActions), [areaActions]);
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
        compact
        actions={
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                Última atualização {lastUpdated}
              </span>
            )}
            <Button
              disabled={isRefreshing}
              onClick={() =>
                void Promise.all([
                  query.refetch(),
                  queryClient.refetchQueries({ queryKey: ["director-rep-notes"], type: "active" }),
                ])
              }
            >
              <RefreshCw className={isRefreshing ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />{" "}
              Atualizar
            </Button>
          </div>
        }
      />
      <div className="mx-auto max-w-[1600px] space-y-2 bg-muted/30 px-3 py-2 sm:px-6 lg:px-8">
        <Tabs value={area} onValueChange={(value) => setArea(value as DirectorTab)}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[220px_minmax(0,28rem)]">
            <div className="rounded-xl border bg-card p-2">
              <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Selecione
              </p>
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-transparent p-0">
                {tabs.map((key) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="justify-center rounded-lg border px-2 py-1.5 text-[10px] font-medium uppercase leading-tight data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    {key === "reps" ? "Reps" : AREA_LABEL[key]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {area !== "reps" && !query.isPending && !query.isError && (
              <StatusDonutChart data={statusBreakdown} />
            )}
          </div>
          {tabs.map((key) => (
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
              ) : key === "reps" ? (
                <RepresentativeTable representatives={query.data?.reps ?? []} />
              ) : (
                <ExecutiveTable key={area} actions={areaActions} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
