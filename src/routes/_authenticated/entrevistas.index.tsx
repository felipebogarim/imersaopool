import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare } from "lucide-react";
import { CLASSIFICACOES } from "@/lib/interview-questions";
import { EmptyState, LoadingRows } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/entrevistas/")({
  head: () => ({ meta: [{ title: "Entrevistas — PoolFlux" }] }),
  component: EntrevistasIndex,
});

const CLASSIF_LABEL = Object.fromEntries(CLASSIFICACOES.map(c => [c.value, c.label]));

function EntrevistasIndex() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["interviews"],
    queryFn: async () =>
      (await supabase
        .from("interviews")
        .select("id, entrevistado_nome, entrevistado_classificacao, empresa_nome, cidade, estado, data_entrevista, created_at")
        .order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div>
      <PageHeader
        title="Entrevistas"
        subtitle="Conversas de campo estruturadas pelo framework de imersão"
        actions={
          <Button asChild>
            <Link to="/entrevistas/nova"><Plus className="h-4 w-4 mr-1" /> Nova entrevista</Link>
          </Button>
        }
      />
      <div className="p-8">
        {isLoading ? (
          <LoadingRows rows={4} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma entrevista ainda"
            description="Comece a estruturar as conversas de campo."
            action={<Button asChild><Link to="/entrevistas/nova"><Plus className="h-4 w-4 mr-1" /> Nova entrevista</Link></Button>}
          />
        ) : (
          <div className="grid gap-3">
            {data.map((e: any) => (
              <Link key={e.id} to="/entrevistas/$id" params={{ id: e.id }} className="surface rounded-xl p-5 hover:border-primary/40 transition block">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold mb-1">{e.entrevistado_nome}</div>
                    <div className="text-sm text-muted-foreground">
                      {e.empresa_nome}
                      {e.cidade && <span className="mx-2">•</span>}{e.cidade}{e.estado ? `/${e.estado}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {e.data_entrevista && <span className="text-xs text-muted-foreground">{new Date(e.data_entrevista).toLocaleDateString("pt-BR")}</span>}
                    <Badge variant="outline">{CLASSIF_LABEL[e.entrevistado_classificacao] ?? e.entrevistado_classificacao}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
