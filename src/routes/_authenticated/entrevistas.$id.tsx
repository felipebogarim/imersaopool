import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import {
  INTERVIEW_SECTIONS,
  CLASSIFICACOES,
  TIPOS_EMPRESA,
} from "@/lib/interview-questions";

export const Route = createFileRoute("/_authenticated/entrevistas/$id")({
  head: () => ({ meta: [{ title: "Entrevista — PoolFlux" }] }),
  component: EntrevistaDetail,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Entrevista não encontrada.</div>,
});

const CLASSIF = Object.fromEntries(CLASSIFICACOES.map(c => [c.value, c.label]));
const TIPO = Object.fromEntries(TIPOS_EMPRESA.map(t => [t.value, t.label]));

function EntrevistaDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["interview", id],
    queryFn: async () => (await supabase.from("interviews").select("*").eq("id", id).maybeSingle()).data,
  });

  async function remove() {
    if (!confirm("Excluir esta entrevista?")) return;
    const { error } = await supabase.from("interviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluída");
    navigate({ to: "/entrevistas" });
  }

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando...</div>;
  if (!data) return <div className="p-8">Não encontrada.</div>;

  const respostas = (data.respostas ?? {}) as Record<string, string>;

  return (
    <div>
      <PageHeader
        title={data.entrevistado_nome}
        subtitle={`${CLASSIF[data.entrevistado_classificacao] ?? data.entrevistado_classificacao}${data.empresa_nome ? " • " + data.empresa_nome : ""}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/entrevistas" })}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
            <Button variant="destructive" onClick={remove}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
          </div>
        }
      />
      <div className="p-8 max-w-4xl space-y-6">
        <section className="surface rounded-xl p-6">
          <h2 className="font-semibold mb-3">Ficha</h2>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Entrevistador:</span> {data.entrevistador_nome}{data.entrevistador_cargo ? ` — ${data.entrevistador_cargo}` : ""}</div>
            <div><span className="text-muted-foreground">Data:</span> {data.data_entrevista ? new Date(data.data_entrevista).toLocaleDateString("pt-BR") : "—"}</div>
            <div>
              <span className="text-muted-foreground">Classificação:</span>{" "}
              <Badge variant="outline">{CLASSIF[data.entrevistado_classificacao] ?? data.entrevistado_classificacao}</Badge>
              {data.entrevistado_classificacao_outro && ` — ${data.entrevistado_classificacao_outro}`}
            </div>
            <div>
              <span className="text-muted-foreground">Tipo da empresa:</span>{" "}
              {data.empresa_tipo ? (TIPO[data.empresa_tipo] ?? data.empresa_tipo) : "—"}
              {data.empresa_tipo_outro && ` — ${data.empresa_tipo_outro}`}
            </div>
            <div><span className="text-muted-foreground">Local:</span> {[data.cidade, data.estado].filter(Boolean).join("/") || "—"}</div>
          </div>
        </section>

        {INTERVIEW_SECTIONS.map(sec => (
          <section key={sec.id} className="surface rounded-xl p-6 space-y-4">
            <h2 className="font-semibold">{sec.titulo}</h2>
            {sec.perguntas.map(q => (
              <div key={q.id}>
                <p className="text-sm font-medium mb-1">
                  {q.pergunta}
                  {q.hipotese !== "—" && <span className="text-[10px] text-muted-foreground ml-2">[{q.hipotese}]</span>}
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {respostas[q.id]?.trim() || <span className="italic">Sem resposta</span>}
                </p>
              </div>
            ))}
          </section>
        ))}

        {data.observacoes && (
          <section className="surface rounded-xl p-6">
            <h2 className="font-semibold mb-2">Observações</h2>
            <p className="text-sm whitespace-pre-wrap">{data.observacoes}</p>
          </section>
        )}
      </div>
    </div>
  );
}
