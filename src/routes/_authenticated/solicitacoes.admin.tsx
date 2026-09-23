import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectorsTab } from "@/components/internal-tickets/admin/SectorsTab";
import { PeopleTab } from "@/components/internal-tickets/admin/PeopleTab";
import { CategoriesTab } from "@/components/internal-tickets/admin/CategoriesTab";

export const Route = createFileRoute("/_authenticated/solicitacoes/admin")({
  head: () => ({ meta: [{ title: "Admin — Solicitações Internas — PoolFlux" }] }),
  component: AdminSolicitacoesInternasPage,
});

function AdminSolicitacoesInternasPage() {
  return (
    <div className="min-h-screen bg-background pb-10">
      <PageHeader
        title="Admin"
        subtitle="Setores, pessoas e categorias usados para rotear os tickets do Comercial"
      />
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-8">
        <Tabs defaultValue="setores">
          <TabsList>
            <TabsTrigger value="setores">Setores</TabsTrigger>
            <TabsTrigger value="pessoas">Responsáveis</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
          </TabsList>
          <TabsContent value="setores" className="mt-4">
            <SectorsTab />
          </TabsContent>
          <TabsContent value="pessoas" className="mt-4">
            <PeopleTab />
          </TabsContent>
          <TabsContent value="categorias" className="mt-4">
            <CategoriesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
