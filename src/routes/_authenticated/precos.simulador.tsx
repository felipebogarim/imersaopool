import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/precos/simulador")({
  head: () => ({ meta: [{ title: "Simulador de Preços — PoolFlux" }] }),
  component: SimuladorPrecosPage,
});

function SimuladorPrecosPage() {
  return (
    <div>
      <PageHeader
        title="Simulador de Preços"
        subtitle="Impactos financeiros em cenários de margem"
      />
      <div className="p-4 sm:p-8">
        <div className="surface rounded-xl p-12 text-center text-muted-foreground">
          Área em construção técnica. Ferramenta para simulação de reajustes e impactos em volume/margem.
        </div>
      </div>
    </div>
  );
}
