import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/bi-diretor")({
  head: () => ({ meta: [{ title: "BI Diretor — PoolFlux" }] }),
  component: BIDiretorPage,
});

function BIDiretorPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="BI Diretor" subtitle="Inteligência comercial para a diretoria" />
      <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
        <div className="surface flex flex-col items-center gap-3 rounded-xl border border-border px-6 py-12 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Área em preparação</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Os indicadores e relatórios da diretoria serão disponibilizados aqui.
          </p>
        </div>
      </div>
    </div>
  );
}
