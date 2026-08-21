import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { EmailsAtualizacoes } from "@/components/central-mensagens/EmailsAtualizacoes";

export const Route = createFileRoute("/_authenticated/admin/central-mensagens/")({
  component: CentralMensagensPage,
});

function CentralMensagensPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader 
        title="Central de Mensagens" 
        subtitle="Gestão de comunicados, atualizações do sistema e contatos"
      />
      <div className="p-4 sm:p-8 flex-1 overflow-auto">
        <EmailsAtualizacoes />
      </div>
    </div>
  );
}
