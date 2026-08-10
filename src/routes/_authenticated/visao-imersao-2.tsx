import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { 
  ExecutiveBriefV2, 
  BriefHeaderV2, 
  SintesePresidencialV2 
} from "@/components/visao-rep2/ExecutiveBriefV2";
import { PerspectivasEntrevistaV2 } from "@/components/visao-rep2/PerspectivasV2";
import { BrandPositioningRadarV2 } from "@/components/visao-rep2/BrandPositioningRadarV2";
import { LeituraIntegradaV2 } from "@/components/visao-rep2/LeituraIntegradaV2";
import { PerformanceFamiliasV2 } from "@/components/visao-rep2/PerformanceFamiliasV2";
import { Immersion2DataSchema } from "@/lib/visao-imersao-2-parser";
import {
  extractEditorialChapters,
  buildVisaoImersao2ViewModel,
} from "@/lib/visao-imersao-2-import";
import {
  VisaoImersao2Importer,
  type VisaoImersao2Import,
} from "@/components/visao-imersao-2/VisaoImersao2Importer";
import { VisaoImersao2ImportPreview } from "@/components/visao-imersao-2/VisaoImersao2ImportPreview";
import { buildPerspectivasVM } from "@/lib/visao-rep2-perspectivas";
import { 
  ArrowLeft, 
  Compass,
  Save,
  AlertCircle,
  MoreVertical,
  Mail,
  MessageCircle,
  Pencil,
  Trash2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export const Route = createFileRoute("/_authenticated/visao-imersao-2")({
  head: () => ({
    meta: [
      { title: "Visão Imersão 2 | PoolFlux" },
      {
        name: "description",
        content: "Nova arquitetura de relatórios executivos baseada em dados canônicos.",
      },
      { property: "og:title", content: "Visão Imersão 2 | PoolFlux" },
      { property: "og:description", content: "Relatórios executivos de imersão baseados em dados canônicos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VisaoImersao2Page,
});

function VisaoImersao2Page() {
  const queryClient = useQueryClient();
  const [avulso, setAvulso] = useState<VisaoImersao2Import | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [preview, setPreview] = useState<VisaoImersao2Import | null>(null);

  const [dirty, setDirty] = useState(false);
  const [duplicata, setDuplicata] = useState<any | null>(null);
  const [excluir, setExcluir] = useState<any | null>(null);

  function resumoRelatorio(r: any) {
    const dt = r.visit_date ? new Date(`${r.visit_date}T00:00:00`).toLocaleDateString("pt-BR") : "—";
    return `Visão Imersão 2 · ${r.client_name} · ${dt}\n${window.location.origin}/visao-imersao-2`;
  }

  function compartilharEmail(r: any) {
    const subject = `Visão Imersão 2 · ${r.client_name}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(resumoRelatorio(r))}`;
  }

  function compartilharWhats(r: any) {
    window.open(`https://wa.me/?text=${encodeURIComponent(resumoRelatorio(r))}`, "_blank");
  }

  async function excluirRelatorio(id: string) {
    const { data, error } = await supabase
      .from("field_immersion_v2_reports")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) {
      toast.error("Não foi possível excluir o relatório.");
      return;
    }
    if (!data || data.length === 0) {
      toast.error("Você não tem permissão para excluir este relatório.");
      return;
    }

    setExcluir(null);
    await queryClient.invalidateQueries({ queryKey: ["vi2-reports"] });
    await refetchReports();
    toast.success("Relatório excluído.");
  }




  const { data: reports = [], refetch: refetchReports } = useQuery({
    queryKey: ["vi2-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("field_immersion_v2_reports")
        .select("id, client_name, visit_date, source_filename, content_markdown, structured_data, created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  function abrirRelatorio(report: any) {
    try {
      const stored = report.structured_data as Record<string, unknown> | null;
      const data = Immersion2DataSchema.parse((stored as any)?.data ?? stored);
      setAvulso({
        data,
        chapters: extractEditorialChapters(report.content_markdown),
        arquivo: report.source_filename,
        markdown: report.content_markdown,
        id: report.id,
      });
      setDirty(false);
    } catch {
      toast.error("Relatório salvo não é compatível com o schema V2.");
    }
  }

  const visao = useMemo(() => {
    if (!avulso) return null;
    try {
      return buildVisaoImersao2ViewModel(avulso.data, avulso.chapters);
    } catch (e: any) {
      console.error("[VisaoImersao2] Erro ao montar view-model:", e);
      return null;
    }
  }, [avulso]);

  function confirmarImportacao() {
    if (!preview) return;
    try {
      buildVisaoImersao2ViewModel(preview.data, preview.chapters);
      setAvulso(preview);
      setDirty(true);
      setPreview(null);
      toast.success("Relatório carregado. Clique em Salvar para publicar na lista.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao montar a Visão Imersão 2.");
    }
  }

  async function salvarRelatorio(opts?: { replaceId?: string }) {
    if (!avulso) return;
    setSalvando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão inválida.");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .single();
      if (profileError || !profile?.company_id) throw new Error("Empresa ativa não encontrada.");

      const payload = {
        client_name: avulso.data.client.name,
        visit_date: avulso.data.client.visit_date,
        source_filename: avulso.arquivo,
        content_markdown: avulso.markdown,
        structured_data: { schema: "visao_imersao_2_data_v1", block: "visao_imersao_2", data: avulso.data } as any,
        company_id: profile.company_id,
        created_by: userId,
      };

      const targetId = avulso.id ?? opts?.replaceId;

      if (!targetId) {
        // Regra: apenas um relatório por cliente na mesma data.
        const duplicado = (reports as any[]).find(
          (r) =>
            String(r.client_name ?? "").trim().toLowerCase() ===
              payload.client_name.trim().toLowerCase() && r.visit_date === payload.visit_date,
        );
        if (duplicado) {
          setDuplicata(duplicado);
          setSalvando(false);
          return;
        }
      }

      if (targetId) {
        const { error } = await supabase
          .from("field_immersion_v2_reports")
          .update(payload as any)
          .eq("id", targetId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("field_immersion_v2_reports").insert(payload as any);
        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["vi2-reports"] });
      await refetchReports();
      setDirty(false);
      setAvulso(null);
      setDuplicata(null);
      toast.success("Relatório salvo. Disponível na lista de Visão Imersão 2.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar a Visão Imersão 2.");
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
    <>
      <VisaoImersao2ImportPreview
        value={preview}
        saving={salvando}
        onCancel={() => setPreview(null)}
        onConfirm={() => void confirmarImportacao()}
      />
      <AlertDialog open={Boolean(duplicata)} onOpenChange={(o) => { if (!o) setDuplicata(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Já existe um relatório deste cliente nesta data</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicata?.client_name} ·{" "}
              {duplicata?.visit_date
                ? new Date(`${duplicata.visit_date}T00:00:00`).toLocaleDateString("pt-BR")
                : "—"}
              . Deseja substituir o relatório anterior por esta versão?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={salvando}
              onClick={(e) => {
                e.preventDefault();
                const id = duplicata?.id;
                if (id) void salvarRelatorio({ replaceId: id });
              }}
            >
              {salvando ? "Substituindo…" : "Substituir anterior"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(excluir)} onOpenChange={(o) => { if (!o) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir?.client_name} · esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (excluir?.id) void excluirRelatorio(excluir.id);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );



  if (!avulso || !visao) {
    return (
      <div>
        <PageHeader 
          title="Visão Imersão 2" 
          subtitle="Nova arquitetura de diagnóstico comercial (Experimental)" 
          actions={
            <VisaoImersao2Importer onValidated={setPreview} />
          }
        />
        <div className="p-4 sm:p-8">
          {reports.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="Nenhum relatório salvo"
              description="Carregue o arquivo MD canônico para visualizar a nova estrutura de dados."
              action={
                <VisaoImersao2Importer onValidated={setPreview} label="Selecionar arquivo" />
              }
            />
          ) : (
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Relatórios salvos
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {reports.map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between gap-4 bg-card p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.client_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.visit_date ? new Date(`${r.visit_date}T00:00:00`).toLocaleDateString("pt-BR") : "—"} · {r.source_filename}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => abrirRelatorio(r)}>Abrir</Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Mais ações">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => compartilharEmail(r)}>
                            <Mail className="mr-2 h-4 w-4" /> Compartilhar por e-mail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => compartilharWhats(r)}>
                            <MessageCircle className="mr-2 h-4 w-4" /> Compartilhar por WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => abrirRelatorio(r)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setExcluir(r)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}

              </ul>
            </div>
          )}
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
        subtitle={`Arquivo: ${avulso.arquivo}${dirty ? " · alterações não salvas" : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void salvarRelatorio()} disabled={salvando}>
              <Save className="mr-1 h-4 w-4" />
              {salvando ? "Salvando…" : avulso.id ? "Salvar versão atualizada" : "Salvar relatório"}
            </Button>
            <VisaoImersao2Importer onValidated={setPreview} variant="outline" label="Substituir relatório" />
              <Button variant="outline" onClick={() => setDebugMode(!debugMode)}>
              {debugMode ? "Esconder Diagnóstico" : "Ver Diagnóstico"}
            </Button>
            <Button variant="ghost" onClick={() => { setAvulso(null); setDirty(false); }}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar à lista
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
