import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { BISection } from "@/components/BISection";

export const Route = createFileRoute("/_authenticated/performance/bi-clientes")({
  head: () => ({ meta: [{ title: "BI Clientes — PoolFlux" }] }),
  component: BIClientesPage,
});

function BIClientesPage() {
  return (
    <div>
      <PageHeader
        title="BI Clientes"
        subtitle="Análise consolidada por cliente e categoria"
      />
      <div className="p-4 sm:p-8">
        <BISection />
      </div>
    </div>
  );
}
