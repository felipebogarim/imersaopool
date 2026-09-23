import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExecutiveTable } from "@/components/director-bi/ExecutiveTable";
import { useDirectorBI } from "@/hooks/useDirectorBI";
import { DIRECTOR_AREAS, filterDirectorActions, type DirectorFilter } from "@/lib/director-bi";
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
  const query = useDirectorBI();
  const actions = query.data?.actions ?? [];
  const filtered = filterDirectorActions(actions, area, status, representative);
  const unclassified = actions.filter((action) => !action.area).length;

  return (
    <div className="min-h-screen bg-background pb-10">
      <PageHeader
        title="BI Diretor"
        subtitle="Acompanhamento executivo das ações da Imersão Comercial"
      />
      <div className="mx-auto max-w-[1600px] space-y-5 px-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Principais Frentes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ações estratégicas selecionadas para acompanhamento.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>
        <Tabs value={area} onValueChange={(value) => setArea(value as ExecArea)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:w-fit sm:grid-cols-4">
            {DIRECTOR_AREAS.map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                className="px-4 py-2 text-xs uppercase tracking-wide"
              >
                {AREA_LABEL[key]}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="my-5 flex flex-wrap items-end gap-4">
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-muted-foreground">Status</legend>
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    size="sm"
                    variant={status === filter.value ? "secondary" : "ghost"}
                    aria-pressed={status === filter.value}
                    onClick={() => setStatus(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </fieldset>
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
