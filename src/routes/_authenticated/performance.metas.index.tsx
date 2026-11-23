import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { MetasCarteiraList } from "@/components/performance-metas/MetasCarteiraList";
import { useMetasViewer } from "@/components/performance-metas/use-metas-viewer";

export const Route = createFileRoute("/_authenticated/performance/metas/")({
  head: () => ({ meta: [{ title: "Metas — Performance — PoolFlux" }] }),
  component: MetasIndexPage,
});

function MetasIndexPage() {
  const viewer = useMetasViewer();
  const isRepView = viewer.role === "representante";

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Metas"
        subtitle="Metas mensais individualizadas por cliente e família — simulação local"
      />
      <div className="p-3 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        {viewer.loading ? null : (
          <MetasCarteiraList restrictToRepIds={isRepView ? viewer.repIds : null} />
        )}
      </div>
    </div>
  );
}
