import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/roteiros")({
  head: () => ({ meta: [{ title: "Roteiros — PoolFlux" }] }),
  component: RoteirosPage,
});

function RoteirosPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["roteiros-with-caps"],
    queryFn: async () => {
      const { data: rot } = await supabase
        .from("roteiros")
        .select("id, nome, descricao, perfil_alvo, versao, ativo")
        .order("nome");
      const ids = (rot ?? []).map((r: any) => r.id);
      if (!ids.length) return [];
      const { data: caps } = await supabase
        .from("capitulos")
        .select("id, roteiro_id, ordem, codigo, titulo, orientacao, hipotese, lente_default, campos_matriz")
        .in("roteiro_id", ids)
        .order("ordem");
      return (rot ?? []).map((r: any) => ({
        ...r,
        capitulos: (caps ?? []).filter((c: any) => c.roteiro_id === r.id),
      }));
    },
  });

  return (
    <div>
      <PageHeader
        title="Roteiros de imersão"
        subtitle="Framework de capítulos usados nas sessões de campo"
      />
      <div className="p-8 space-y-6">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground">Nenhum roteiro cadastrado.</p>
        ) : (
          data.map((r: any) => (
            <section key={r.id} className="surface rounded-xl p-6">
              <header className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{r.nome}</h2>
                    <Badge variant="outline">v{r.versao}</Badge>
                    {!r.ativo && <Badge variant="secondary">inativo</Badge>}
                  </div>
                  {r.descricao && <p className="text-sm text-muted-foreground mt-1">{r.descricao}</p>}
                  {r.perfil_alvo && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Perfil-alvo: {r.perfil_alvo}
                    </p>
                  )}
                </div>
              </header>
              <ol className="space-y-3">
                {r.capitulos.map((c: any) => (
                  <li key={c.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">#{c.ordem}</span>
                      <h3 className="font-medium">{c.titulo}</h3>
                      <Badge variant="outline" className="text-[10px]">
                        {c.lente_default}
                      </Badge>
                    </div>
                    {c.orientacao && (
                      <p className="text-sm text-muted-foreground mb-2">{c.orientacao}</p>
                    )}
                    {c.hipotese && (
                      <p className="text-xs italic text-muted-foreground mb-2">
                        Hipótese: {c.hipotese}
                      </p>
                    )}
                    {Array.isArray(c.campos_matriz) && c.campos_matriz.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.campos_matriz.map((f: string) => (
                          <span
                            key={f}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
