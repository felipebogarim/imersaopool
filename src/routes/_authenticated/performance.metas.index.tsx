import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarChart3, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { MetasCarteiraList } from "@/components/performance-metas/MetasCarteiraList";
import { MetasBiPanel } from "@/components/performance-metas/MetasBiPanel";
import { useMetasViewer } from "@/components/performance-metas/use-metas-viewer";

type MetasView = "clientes" | "bi";

export const Route = createFileRoute("/_authenticated/performance/metas/")({
  head: () => ({ meta: [{ title: "Metas — Performance — PoolFlux" }] }),
  validateSearch: (search: Record<string, unknown>): { view?: MetasView } => ({
    view: search.view === "bi" ? "bi" : undefined,
  }),
  component: MetasIndexPage,
});

const VIEWS: Array<{ key: MetasView; label: string; icon: typeof ListChecks }> = [
  { key: "clientes", label: "Metas por cliente", icon: ListChecks },
  { key: "bi", label: "BI Metas", icon: BarChart3 },
];

function MetasIndexPage() {
  const viewer = useMetasViewer();
  const isRepView = viewer.role === "representante";
  const { view } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  // BI consolida a empresa inteira (valores em R$): só gestão.
  const current: MetasView = !isRepView && view === "bi" ? "bi" : "clientes";

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Metas" subtitle="Metas mensais individualizadas por cliente e portfólio" />
      <div className="p-3 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-4">
        {!viewer.loading && !isRepView && (
          <div className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm">
            {VIEWS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() =>
                  navigate({ search: { view: key === "bi" ? "bi" : undefined }, replace: true })
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  current === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        )}
        {viewer.loading ? null : current === "bi" ? (
          <MetasBiPanel />
        ) : (
          <MetasCarteiraList restrictToRepIds={isRepView ? viewer.repIds : null} />
        )}
      </div>
    </div>
  );
}
