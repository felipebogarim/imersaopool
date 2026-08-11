import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/precos/mapa")({
  head: () => ({ meta: [{ title: "Mapa de Preços — PoolFlux" }] }),
  component: MapaPrecosPage,
});

function MapaPrecosPage() {
  return (
    <div>
      <PageHeader
        title="Mapa de Preços"
        subtitle="Posicionamento relativo no mercado"
      />
      <div className="p-4 sm:p-8">
        <div className="surface rounded-xl p-12 text-center text-muted-foreground">
          Área em construção técnica. Aqui será exibido o mapa de elasticidade e posicionamento competitivo de preços.
        </div>
      </div>
    </div>
  );
}
