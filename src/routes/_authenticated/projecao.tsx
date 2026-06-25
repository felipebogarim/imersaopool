import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/projecao")({
  head: () => ({ meta: [{ title: "Projeção Categoria / Benefício — PoolFlux" }] }),
  component: ProjecaoPage,
});

function ProjecaoPage() {
  return (
    <div>
      <PageHeader
        title="Projeção Categoria / Benefício"
        subtitle="Em breve"
      />
      <div className="p-8">
        <div className="surface rounded-xl p-12 text-center text-muted-foreground">
          Esta área está em construção. Em breve traremos a projeção de categoria e os benefícios.
        </div>
      </div>
    </div>
  );
}
