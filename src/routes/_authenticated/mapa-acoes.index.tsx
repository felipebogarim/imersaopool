import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutGrid, Target, Compass, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mapa-acoes/")({
  head: () => ({ meta: [{ title: "Mapa de Ações — PoolFlux" }] }),
  component: MapaAcoesPage,
});

function MapaAcoesPage() {
  return (
    <div>
      <PageHeader
        title="Mapa de Ações"
        subtitle="Planejamento estratégico e tático"
      />
      <div className="p-4 sm:p-8 space-y-6">
        <div className="surface rounded-xl p-12 text-center text-muted-foreground">
          <p className="mb-4">O Mapa de Ações é uma ferramenta de desdobramento estratégico em 4 dimensões.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <Card>
              <CardHeader className="flex flex-row items-center space-x-2">
                <Target className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Matriz de Metas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-left">Definição clara de objetivos financeiros e de volume por canal.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center space-x-2">
                <Compass className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Roteiros e Jornada</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-left">Padronização da abordagem comercial em campo.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center space-x-2">
                <LayoutGrid className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Mapa de Oportunidades</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-left">Identificação visual de gaps e white spaces no portfólio.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center space-x-2">
                <Zap className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Ações Imediatas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-left">Gestão de prioridades e correções de rumo em tempo real.</p>
              </CardContent>
            </Card>
          </div>
          <p className="mt-8 text-sm font-medium text-primary">Em desenvolvimento técnico</p>
        </div>
      </div>
    </div>
  );
}
