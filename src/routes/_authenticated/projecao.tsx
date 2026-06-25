import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/projecao")({
  head: () => ({ meta: [{ title: "Projeção de categoria — PoolFlux" }] }),
  component: ProjecaoPage,
});

function ProjecaoPage() {
  return (
    <div>
      <PageHeader
        title="Projeção de categoria / Benefícios"
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
