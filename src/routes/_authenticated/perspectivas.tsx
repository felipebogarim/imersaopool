import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/perspectivas")({
  head: () => ({ meta: [{ title: "Perspectivas — PoolFlux" }] }),
  component: PerspectivasPage,
});

const STATUS_TABS = [
  { value: "ia_sugerida", label: "Sugeridas pela IA" },
  { value: "em_revisao", label: "Em revisão" },
  { value: "aprovada", label: "Aprovadas" },
  { value: "descartada", label: "Descartadas" },
] as const;

function PerspectivasPage() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]["value"]>("ia_sugerida");
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["perspectivas", tab],
    queryFn: async () =>
      (
        await supabase
          .from("perspectivas")
          .select("id, lente, escopo_tipo, escopo_ref_id, conteudo, origem, status, created_at, sessao_id")
          .eq("status", tab)
          .order("created_at", { ascending: false })
          .limit(200)
      ).data ?? [],
  });

  async function updateStatus(id: string, status: "aprovada" | "descartada" | "em_revisao") {
    const { data: u } = await supabase.auth.getUser();
    const patch: any = { status };
    if (status === "aprovada") {
      patch.aprovada_por = u.user?.id;
      patch.aprovada_em = new Date().toISOString();
    }
    const { error } = await supabase.from("perspectivas").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    qc.invalidateQueries({ queryKey: ["perspectivas"] });
  }

  return (
    <div>
      <PageHeader
        title="Perspectivas"
        subtitle="Revisão humana das leituras geradas a partir das sessões"
      />
      <div className="p-8">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            {STATUS_TABS.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {STATUS_TABS.map((s) => (
            <TabsContent key={s.value} value={s.value} className="mt-6">
              {isLoading ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : data.length === 0 ? (
                <div className="surface rounded-xl p-8 text-center text-sm text-muted-foreground">
                  Nada aqui ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.map((p: any) => (
                    <article key={p.id} className="surface rounded-xl p-5">
                      <header className="flex items-center gap-2 mb-3 flex-wrap">
                        <Badge variant="outline">{p.lente}</Badge>
                        <Badge variant="secondary">escopo: {p.escopo_tipo}</Badge>
                        <span className="text-xs text-muted-foreground">
                          origem: {p.origem ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(p.created_at).toLocaleString("pt-BR")}
                        </span>
                      </header>
                      <div className="space-y-2">
                        {Object.entries(p.conteudo ?? {}).map(([k, v]) => (
                          <div key={k} className="text-sm">
                            <span className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
                              {k}
                            </span>
                            <p className="whitespace-pre-wrap">{String(v ?? "")}</p>
                          </div>
                        ))}
                      </div>
                      {tab !== "aprovada" && tab !== "descartada" && (
                        <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-border">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(p.id, "descartada")}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Descartar
                          </Button>
                          <Button size="sm" onClick={() => updateStatus(p.id, "aprovada")}>
                            <Check className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
