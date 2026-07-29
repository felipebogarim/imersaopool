import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/novo-corp")({
  component: NovoCorpPage,
});

function NovoCorpPage() {
  return (
    <div>
      <PageHeader title="Novo Corp" subtitle="Em breve" />
      <div className="p-4 sm:p-8 text-sm text-muted-foreground">
        Conteúdo desta seção será definido em breve.
      </div>
    </div>
  );
}
