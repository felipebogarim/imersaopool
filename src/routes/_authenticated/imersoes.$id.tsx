import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Copy, FileDown, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { ImmersionAttachments } from "@/components/ImmersionAttachments";
import { AgentInputs } from "@/components/AgentInputs";
import { ChapterCapture } from "@/components/ChapterCapture";
import { SessionNotes } from "@/components/SessionNotes";
import { ExportInterviewPdfDialog } from "@/components/ExportInterviewPdfDialog";

export const Route = createFileRoute("/_authenticated/imersoes/$id")({
  head: () => ({ meta: [{ title: "Imersão — PoolFlux" }] }),
  component: ImmersionDetail,
});

function ImmersionDetail() {
  const { id } = Route.useParams();
  const [exportOpen, setExportOpen] = useState(false);
  const { data: imm } = useQuery({
    queryKey: ["immersion", id],
    queryFn: async () => (await supabase
      .from("immersions")
      .select("*, client:clients(nome_fantasia, razao_social, grupo, categoria), representative:representatives(nome)")
      .eq("id", id).single()).data,
  });

  // Fallback da categoria: alguns cadastros não têm categoria no cliente,
  // mas ela existe nos dados de performance (por razão social).
  const razaoSocial = (imm as any)?.client?.razao_social as string | undefined;
  const { data: categoriaFallback } = useQuery({
    queryKey: ["client-categoria-fallback", razaoSocial],
    enabled: !!razaoSocial && !(imm as any)?.client?.categoria,
    queryFn: async () => {
      const { data } = await supabase
        .from("rep_performance_rows")
        .select("categoria")
        .eq("razao_social", razaoSocial!)
        .not("categoria", "is", null)
        .limit(1)
        .maybeSingle();
      return data?.categoria ?? null;
    },
  });


  // Ensure an interview record exists for this immersion (session for chapter capture)
  const roteiroId = (imm as any)?.roteiro_id as string | null | undefined;
  const { data: sessao } = useQuery({
    queryKey: ["immersion-sessao", id, roteiroId],
    enabled: !!imm && !!roteiroId,
    queryFn: async () => {
      const { data: existing } = await supabase
        .from("interviews")
        .select("id, roteiro_id")
        .eq("immersion_id", id)
        .maybeSingle();
      if (existing) {
        if (existing.roteiro_id !== roteiroId && roteiroId) {
          await supabase.from("interviews").update({ roteiro_id: roteiroId } as any).eq("id", existing.id);
        }
        return existing;
      }
      const { data: u } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase.from("interviews").insert({
        immersion_id: id,
        roteiro_id: roteiroId,
        client_id: (imm as any)?.client_id,
        entrevistado_nome: (imm as any)?.titulo ?? "Imersão",
        entrevistado_classificacao: "imersao",
        perfil: "imersao",
        tipo: "presencial",
        entrevistador_nome: u.user?.email ?? "—",
        created_by: u.user?.id,
        respostas: {},
      } as any).select("id").single();
      if (error) throw new Error(error.message);
      return inserted;
    },
  });

  if (!imm) return <div className="p-4 sm:p-8">Carregando...</div>;

  const repUrl = typeof window !== "undefined" ? `${window.location.origin}/r/${imm.representative_token}` : "";

  function copyLink() {
    navigator.clipboard.writeText(repUrl);
    toast.success("Link copiado");
  }

  return (
    <div>
      <ExportInterviewPdfDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        interviewId={sessao?.id || ""}
        defaults={{
          entrevistado: imm.client?.nome_fantasia ?? "",
          modelo: imm.titulo ?? "",
        }}
      />
      <PageHeader
        title={imm.titulo}
        subtitle={imm.client?.nome_fantasia}
        actions={
          <div className="flex gap-2">
            <SessionNotes entityType="immersion" entityId={id} />
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
            </Button>
            <Button variant="outline" asChild>
              <Link to="/imersoes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="space-y-6 min-w-0">
          <section className="surface rounded-xl p-6">
            <h2 className="font-semibold mb-3">Ficha</h2>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Perfil / Tipo:</span>{" "}
                {(imm.observacoes as any)?.perfil || '—'} / {(imm.observacoes as any)?.tipo || '—'}
              </div>
              <div>
                <span className="text-muted-foreground">Cliente:</span>{" "}
                {imm.client?.nome_fantasia || (imm.observacoes as any)?.empresa_manual || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Grupo / Categoria:</span>{" "}
                {[imm.client?.grupo, imm.client?.categoria ?? categoriaFallback].filter(Boolean).join(" / ") || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Representante:</span>{" "}
                {imm.representative?.nome || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <Badge variant="outline">{imm.status.replace(/_/g, " ")}</Badge>
              </div>
            </div>
          </section>

          <Tabs defaultValue={roteiroId ? "roteiro" : "visao"}>
          <TabsList className="flex w-full max-w-5xl flex-wrap h-auto gap-1">
            <TabsTrigger value="visao">Visão geral</TabsTrigger>
            <TabsTrigger value="roteiro">Roteiro</TabsTrigger>
            <TabsTrigger value="antes">Antes</TabsTrigger>
            <TabsTrigger value="rep">Representante</TabsTrigger>
            <TabsTrigger value="campo">Campo</TabsTrigger>
            <TabsTrigger value="gerencia">Gerência</TabsTrigger>
            <TabsTrigger value="price">Price</TabsTrigger>
            <TabsTrigger value="diag">Diagnóstico</TabsTrigger>
            <TabsTrigger value="plano">Plano</TabsTrigger>
          </TabsList>

          <TabsContent value="visao" className="mt-4 surface rounded-xl p-6">
            <h3 className="font-semibold mb-3">Status da imersão</h3>
            <ol className="space-y-2 text-sm">
              {["planejada","antes_visita","visita_campo","em_diagnostico","diagnostico_gerado","plano_acao","concluida"].map((s, i) => (
                <li key={s} className={`flex items-center gap-3 ${s === imm.status ? "text-cyan font-medium" : "text-muted-foreground"}`}>
                  <span className={`h-2 w-2 rounded-full ${s === imm.status ? "bg-cyan" : "bg-border"}`} />
                  {i + 1}. {s.replace(/_/g, " ")}
                </li>
              ))}
            </ol>
          </TabsContent>

          <TabsContent value="roteiro" className="mt-4">
            {!roteiroId ? (
              <div className="surface rounded-xl p-6 text-sm text-muted-foreground">
                Esta imersão não tem roteiro vinculado. Edite a imersão e selecione um roteiro para começar a captura por capítulos.
              </div>
            ) : !sessao ? (
              <div className="surface rounded-xl p-6 text-sm text-muted-foreground">Preparando sessão…</div>
            ) : (
              <div className="space-y-4">
                <ChapterCapture sessaoId={sessao.id} roteiroId={roteiroId} immersionId={id} />
              </div>
            )}

          </TabsContent>

          <TabsContent value="antes" className="mt-4 surface rounded-xl p-6">
            <h3 className="font-semibold mb-1">Antes da visita</h3>
            <p className="text-sm text-muted-foreground mb-4">Envie histórico, planilhas, fotos, vídeos e documentos prévios.</p>
            <ImmersionAttachments immersionId={imm.id} />
          </TabsContent>

          <TabsContent value="rep" className="mt-4 surface rounded-xl p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Visão prévia do representante</h3>
              <p className="text-sm text-muted-foreground mb-4">Envie o link abaixo ao representante. Ele preenche o formulário sem precisar de conta.</p>
              <div className="flex gap-2 items-center bg-muted/40 rounded-lg p-3 border border-border">
                <LinkIcon className="h-4 w-4 text-cyan shrink-0" />
                <code className="text-xs flex-1 truncate">{repUrl}</code>
                <Button size="sm" variant="outline" onClick={copyLink}><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</Button>
              </div>
              {imm.representative_token_expires_at && (
                <p className="text-xs text-muted-foreground mt-2">Expira em {new Date(imm.representative_token_expires_at).toLocaleDateString("pt-BR")}</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="campo" className="mt-4 surface rounded-xl p-6">
            <h3 className="font-semibold mb-3">Visita em campo</h3>
            <AgentInputs immersionId={imm.id} scope="campo" />
          </TabsContent>

          <TabsContent value="gerencia" className="mt-4 surface rounded-xl p-6">
            <h3 className="font-semibold mb-3">Gerência</h3>
            <AgentInputs immersionId={imm.id} scope="gerencia" />
          </TabsContent>

          <TabsContent value="price" className="mt-4 surface rounded-xl p-6">
            <h3 className="font-semibold mb-2">Comparativo Price</h3>
            <p className="text-sm text-muted-foreground">Comparação de preços com competidores relevantes do cliente. Em breve.</p>
          </TabsContent>

          <TabsContent value="diag" className="mt-4 surface rounded-xl p-6">
            <h3 className="font-semibold mb-2">Diagnóstico final</h3>
            <p className="text-sm text-muted-foreground">Diagnóstico estratégico gerado por IA cruzando todas as fontes. Em breve.</p>
          </TabsContent>

          <TabsContent value="plano" className="mt-4 surface rounded-xl p-6">
            <h3 className="font-semibold mb-2">Plano de ação</h3>
            <p className="text-sm text-muted-foreground">Ações, responsáveis, prioridades e prazos. Em breve.</p>
          </TabsContent>
        </Tabs>
        </div>

        <aside className="lg:sticky lg:top-6 space-y-6">
          <InterviewFinalPdf interviewId={sessao?.id || ""} />
        </aside>
      </div>
    </div>
  );
}
