import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarChart3, ListChecks, Users } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import {
  METAS_ACOES_TOPO_ID,
  MetasCarteiraList,
} from "@/components/performance-metas/MetasCarteiraList";
import { MetasBiPanel } from "@/components/performance-metas/MetasBiPanel";
import { MetasRepPanel } from "@/components/performance-metas/MetasRepPanel";
import { useMetasViewer } from "@/components/performance-metas/use-metas-viewer";

type MetasView = "clientes" | "bi" | "reps";

export const Route = createFileRoute("/_authenticated/performance/metas/")({
  head: () => ({ meta: [{ title: "Metas — Performance — PoolFlux" }] }),
  validateSearch: (search: Record<string, unknown>): { view?: MetasView } => ({
    view: search.view === "bi" || search.view === "reps" ? search.view : undefined,
  }),
  component: MetasIndexPage,
});

const VIEWS: Array<{ key: MetasView; label: string; icon: typeof ListChecks }> = [
  { key: "bi", label: "BI Metas", icon: BarChart3 },
  { key: "clientes", label: "Metas por cliente", icon: ListChecks },
  { key: "reps", label: "Metas por Rep", icon: Users },
];

function MetasIndexPage() {
  const viewer = useMetasViewer();
  const isRepView = viewer.role === "representante";
  const { view } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  // BI e Metas por Rep consolidam a empresa inteira (valores em R$): só gestão.
  const current: MetasView = !isRepView && view ? view : "clientes";

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Metas" subtitle="Metas mensais individualizadas por cliente e portfólio" />
      <div className="p-3 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-4">
        {!viewer.loading && !isRepView && (
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="tablist"
              className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted/60 p-1.5 shadow-sm"
            >
              {VIEWS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={current === key}
                  onClick={() =>
                    navigate({
                      search: { view: key === "clientes" ? undefined : key },
                      replace: true,
                    })
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    current === key
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            {/* Ações da carteira (ex.: aplicar mínimos em massa), renderizadas pela lista. */}
            <div id={METAS_ACOES_TOPO_ID} className="flex items-center gap-1" />
          </div>
        )}
        {viewer.loading ? null : current === "bi" ? (
          <MetasBiPanel />
        ) : current === "reps" ? (
          <MetasRepPanel />
        ) : (
          <MetasCarteiraList restrictToRepIds={isRepView ? viewer.repIds : null} />
        )}
      </div>
    </div>
  );
}
