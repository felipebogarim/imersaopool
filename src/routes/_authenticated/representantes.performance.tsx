import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/representantes/performance")({
  head: () => ({ meta: [{ title: "Performance — Representantes" }] }),
  component: PerformancePage,
});

function PerformancePage() {
  return (
    <div>
      <PageHeader title="Performance" subtitle="Em breve" />
      <div className="p-8 text-sm text-muted-foreground">
        Conteúdo do módulo Performance será definido em breve.
      </div>
    </div>
  );
}
