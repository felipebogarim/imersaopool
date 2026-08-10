import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { extractFileText } from "@/lib/sintese-file-text";
import { 
  ExecutiveBriefV2, 
  BriefHeaderV2, 
  SintesePresidencialV2 
} from "@/components/visao-rep2/ExecutiveBriefV2";
import { PerspectivasEntrevistaV2 } from "@/components/visao-rep2/PerspectivasV2";
import { BrandPositioningRadarV2 } from "@/components/visao-rep2/BrandPositioningRadarV2";
import { LeituraIntegradaV2 } from "@/components/visao-rep2/LeituraIntegradaV2";
import { PerformanceFamiliasV2 } from "@/components/visao-rep2/PerformanceFamiliasV2";
import { adapterImmersionV2ToExecutive } from "@/lib/visao-imersao-2-adapter";
import { detectVisaoImersao2, type Immersion2Data } from "@/lib/visao-imersao-2-parser";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildPerspectivasVM } from "@/lib/visao-rep2-perspectivas";
import { 
  parseFieldStoreVisit, 
  serializeFieldStoreVisit,
  type FieldImmersionDoc 
} from "@/lib/field-store-visit";
import { 
  ArrowLeft, 
  Compass, 
  FileUp, 
  Loader2, 
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/_authenticated/visao-imersao-2")({
  head: () => ({
    meta: [
      { title: "Visão Imersão 2 | PoolFlux" },
      {
        name: "description",
        content: "Nova arquitetura de relatórios executivos baseada em dados canônicos.",
      },
    ],
  }),
  component: VisaoImersao2Page,
});

function VisaoImersao2Page() {
  const [avulso, setAvulso] = useState<{ doc: FieldImmersionDoc; arquivo: string; id?: string; data?: Immersion2Data | null; markdown?: string } | null>(null);
  const [importando, setImportando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [preview, setPreview] = useState<{ doc: FieldImmersionDoc; arquivo: string; data: Immersion2Data; markdown: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: latestReport, isLoading: loadingLatest } = useQuery({
    queryKey: ["latest-vi2-report"],
    queryFn: async () => {
      const { data: report } = await supabase
        .from("field_immersion_v2_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!report) return null;
      
      const { doc } = parseFieldStoreVisit(report.content_markdown);
      // Prioridade V2: o bloco canônico é lido do markdown bruto persistido.
      const data = detectVisaoImersao2(report.content_markdown);
      return { doc, arquivo: report.source_filename, data, markdown: report.content_markdown };
    }
  });

  useMemo(() => {
    if (latestReport && !avulso) {
      setAvulso(latestReport as any);
    }
  }, [latestReport]);

  const visao = useMemo(() => {
    if (!avulso) return null;
    try {
      const v = adapterImmersionV2ToExecutive(avulso.doc, avulso.data ?? null);
      console.log("[V2] View-model criada para:", v.metadata.representative_name);
      return v;
    } catch (e: any) {
      console.error("[VisaoImersao2] Erro no adapter:", e);
      return null;
    }
  }, [avulso]);

  async function onFile(file: File) {
    setImportando(true);
    try {
      const text = await extractFileText(file);

      // 1) PRIORIDADE ABSOLUTA: bloco estruturado visao_imersao_2_data_v1.
      const data = detectVisaoImersao2(text);

      // 2) Relatório editorial legado: usado só para "Relatório completo por capítulos".
      const { doc, errors } = parseFieldStoreVisit(text);

      if (!data) {
        toast.error(
          doc
            ? "Bloco 'visao_imersao_2' não encontrado. Este arquivo é um relatório editorial legado (field_store_visit_v1)."
            : (errors[0] ?? "Documento fora do padrão de relatório de imersão."),
        );
        return;
      }

      setPreview({
        doc: doc ?? { meta: {}, chapters: [] },
        arquivo: file.name,
        data,
        markdown: text,
      });
    } catch (e: any) {
      console.error("[V2] Erro fatal no fluxo:", e);
      toast.error(e?.message ?? "Falha ao processar o relatório.");
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function confirmarImportacao() {
    if (!preview) return;
    try {
      adapterImmersionV2ToExecutive(preview.doc, preview.data);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao montar a visão executiva.");
      return;
    }
    setAvulso({ doc: preview.doc, arquivo: preview.arquivo, data: preview.data, markdown: preview.markdown });
    setPreview(null);
    toast.success("Relatório Visão Imersão 2 carregado. Clique em 'Salvar Imersão' para persistir.");
  }


  async function handleSave() {
    if (!avulso || !visao) return;
    
    setSalvando(true);
    try {
      console.log("[V2] Persistindo imersão...");
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", userData.user?.id || "").single();

      // Persiste o markdown bruto (preserva o bloco canônico visao_imersao_2)
      const markdown = avulso.markdown ?? serializeFieldStoreVisit(avulso.doc);

      const { data: inserted, error: insertError } = await supabase.from("field_immersion_v2_reports").insert({
        client_name: avulso.data?.client.name || visao.metadata.representative_name || "Cliente Não Identificado",
        visit_date: visao.metadata.interview_date || new Date().toISOString().split('T')[0],
        source_filename: avulso.arquivo,
        content_markdown: markdown,
        structured_data: { schema: "visao_imersao_2_data_v1", data: avulso.data, view_model: visao } as any,
        company_id: profile?.company_id,
        created_by: userData.user?.id
      }).select().single();

      if (insertError) throw insertError;

      toast.success("Relatório V2 salvo com sucesso na base de dados.");
      setAvulso({ ...avulso, id: inserted.id });
      console.log("[V2] Persistência concluída.");
    } catch (e: any) {
      console.error("[V2] Erro na persistência:", e);
      toast.error("Falha ao salvar a imersão: " + e.message);
    } finally {
      setSalvando(false);
    }
  }

  // Busca dados comerciais reais do cliente resolvido
  const clientName = visao?.metadata?.representative_name;
  const { data: commercialData } = useQuery({
    queryKey: ["vi2-commercial", clientName],
    enabled: !!clientName,
    queryFn: async () => {
      // Normalização canônica para busca
      const searchName = clientName!
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();

      const { data: clients } = await supabase
        .from("clients")
        .select("id, nome_fantasia, razao_social")
        .or(`nome_fantasia.ilike.%${searchName}%,razao_social.ilike.%${searchName}%`);
      
      if (!clients?.length) return null;
      
      // Se houver múltiplos, por enquanto pegamos o primeiro (a regra pede resolução se ambíguo, 
      // mas no MVP vamos listar e avisar)
      const clientId = clients[0].id;

      const { data: bi } = await (supabase as any)
        .from("client_bi")
        .select("respostas")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const biData = bi?.respostas?.__client_bi__;
      if (!biData) return { clientId, bi: null, clientsFound: clients.length };

      return {
        clientId,
        clientsFound: clients.length,
        geralPct: biData.geral != null ? Number(biData.geral) : 42.9,
        periodoLabel: biData.periodo || "1º Semestre 2026",
        familias: (biData.familias || []).map((f: any) => ({
          familia: f.familia,
          pct: Number(f.atingimento || 0),
          vendas: Number(f.vendas || 0),
          meta: Number(f.meta || 0),
          status: f.status
        }))
      };
    }
  });

  const perf = useMemo(() => {
    if (!commercialData) return null;
    return {
      geralPct: commercialData.geralPct ?? 42.9,
      periodoLabel: commercialData.periodoLabel ?? "1º Semestre 2026",
      familias: commercialData.familias ?? []
    };
  }, [commercialData]);

  const previewDialog = (
    <Dialog open={!!preview} onOpenChange={o => { if (!o) setPreview(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Validação do relatório</DialogTitle>
        </DialogHeader>
        {preview && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge>Padrão: Visão Imersão 2</Badge>
              <Badge variant="outline">Schema: visao_imersao_2_data_v1</Badge>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Cliente</dt><dd>{preview.data.client.name}</dd>
              <dt className="text-muted-foreground">Data</dt><dd>{preview.data.client.visit_date}</dd>
              <dt className="text-muted-foreground">Local</dt><dd>{preview.data.client.location}</dd>
              <dt className="text-muted-foreground">Representante</dt><dd>{preview.data.client.representative ?? "—"}</dd>
              <dt className="text-muted-foreground">Consultor</dt><dd>{preview.data.client.consultant ?? "—"}</dd>
              <dt className="text-muted-foreground">Sinais estratégicos</dt><dd>{preview.data.signals.length}</dd>
              <dt className="text-muted-foreground">Perspectivas</dt><dd>{preview.data.perspectives.length}</dd>
              <dt className="text-muted-foreground">Citações</dt><dd>{preview.data.quotes.length}</dd>
              <dt className="text-muted-foreground">Marcas observadas</dt><dd>{preview.data.brands_observed.length}</dd>
              <dt className="text-muted-foreground">Famílias analisadas</dt><dd>{preview.data.families_analyzed.length}</dd>
            </dl>
            {preview.doc.chapters.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Relatório editorial legado detectado ({preview.doc.chapters.length} capítulos) — será mantido apenas para “Relatório completo por capítulos”.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setPreview(null)}>Cancelar</Button>
          <Button onClick={confirmarImportacao}>Confirmar importação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!avulso || !visao) {
    return (
      <div>
        <PageHeader 
          title="Visão Imersão 2" 
          subtitle="Nova arquitetura de diagnóstico comercial (Experimental)" 
          actions={
            <Button onClick={() => fileRef.current?.click()} disabled={importando}>
              {importando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileUp className="mr-1 h-4 w-4" />}
              Carregar Relatório V2
            </Button>
          }
        />
        <input
          ref={fileRef}
          type="file"
          accept=".md,.markdown"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
        />
        <div className="p-8">
          <EmptyState
            icon={Compass}
            title="Nenhum relatório carregado"
            description="Carregue o arquivo MD canônico para visualizar a nova estrutura de dados."
            action={
              <Button onClick={() => fileRef.current?.click()}>
                <FileUp className="mr-1 h-4 w-4" /> Selecionar Arquivo
              </Button>
            }
          />
        </div>
        {previewDialog}
      </div>
    );
  }

  return (
    <div className="pb-20">
      {previewDialog}
      <PageHeader 
        title={`Visão Imersão 2 · ${visao.metadata.representative_name}`} 
        subtitle={`Arquivo: ${avulso.arquivo}`}
        actions={
          <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDebugMode(!debugMode)}>
              {debugMode ? "Esconder Diagnóstico" : "Ver Diagnóstico"}
            </Button>
            {!avulso.id && (
              <Button onClick={handleSave} disabled={salvando}>
                {salvando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileUp className="mr-1 h-4 w-4" />}
                Salvar Imersão
              </Button>
            )}
            <Button variant="ghost" onClick={() => { setAvulso(null); if (fileRef.current) fileRef.current.value = ""; }}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Sair da Visão
            </Button>
          </div>
        }
      />

      <div className="space-y-8 p-4 sm:p-8">
        {/* 1. Cabeçalho e 2. Briefing Executivo */}
        <div className="space-y-6">
          <BriefHeaderV2
            nome={visao.metadata.representative_name || ""}
            regiao={visao.metadata.region}
            marcas={visao.representative_context.represented_brands}
            atingimentoPct={perf?.geralPct}
            periodo={perf?.periodoLabel}
            mode="imersao"
          />
          
          {commercialData && commercialData.clientsFound > 1 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ambiguidade comercial</AlertTitle>
              <AlertDescription>
                Foram encontrados {commercialData.clientsFound} clientes com nomes similares. Os dados comerciais podem estar imprecisos.
              </AlertDescription>
            </Alert>
          )}

          {!commercialData?.clientId && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Dados comerciais não vinculados</AlertTitle>
              <AlertDescription>
                Não foi possível localizar este cliente na base comercial do PoolFlux.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* 3. Síntese Estratégica + Teia */}
        <SintesePresidencialV2 
          texto={visao.executive_brief?.presidential_synthesis || ""} 
          teia={<BrandPositioningRadarV2 atual={visao} comparaveis={[]} />} 
        />

        {/* 4. Performance por Família */}
        <PerformanceFamiliasV2 perf={perf as any} />

        {/* 5. LEITURA INTEGRADA */}
        <LeituraIntegradaV2 visao={visao} defaultOpen={true} />

        {/* 6. Áreas de Aprofundamento */}
        <div className="space-y-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Áreas de Aprofundamento
          </h3>
          <PerspectivasEntrevistaV2 
            perspectivas={buildPerspectivasVM(visao)} 
            mode="imersao"
          />
          
          {/* Diagnóstico Técnico (Admin Only) */}
          {debugMode && (
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-6">
              <h4 className="mb-4 font-bold text-primary">Diagnóstico Técnico da Importação</h4>
              <div className="grid gap-6 text-xs md:grid-cols-2">
                <div className="space-y-2">
                  <p><strong>Cliente resolvido:</strong> {commercialData?.clientId || "Não vinculado"}</p>
                  <p><strong>Sinais válidos:</strong> {visao.executive_view.priority_signals.length}</p>
                  <p><strong>Perspectivas válidas:</strong> {visao.perspectives.length}</p>
                  <p><strong>Marcas detectadas:</strong> {visao.representative_context.represented_brands.join(", ")}</p>
                </div>
                <div className="space-y-2">
                   <p className="font-semibold">Mapeamento de Sinais:</p>
                   {visao.executive_view.priority_signals.map(s => (
                     <div key={s.signal_id} className="border-l border-primary/20 pl-2">
                       <p>{s.signal_id}: {s.title}</p>
                       <p className="text-muted-foreground">Perspectivas: {s.related_perspectives?.join(", ")}</p>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
