import { createFileRoute } from "@tanstack/react-router";
import { type PerfResumo } from "@/lib/visao-rep";
import { z } from "zod";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { 
  ExecutiveBriefV2
} from "@/components/visao-rep2/ExecutiveBriefV2";

import { AreasAprofundamento } from "@/components/visao-imersao-2/AreasAprofundamento";

import { LeituraIntegradaV2 } from "@/components/visao-rep2/LeituraIntegradaV2";
import { ClientFamiliasChart } from "@/components/ClientFamiliasChart";
import { Immersion2DataSchema } from "@/lib/visao-imersao-2-parser";
import {
  extractEditorialChapters,
  buildVisaoImersao2ViewModel,
} from "@/lib/visao-imersao-2-import";
import { withGroupComparison } from "@/lib/visao-imersao-2-grupo";
import {
  VisaoImersao2Importer,
  type VisaoImersao2Import,
} from "@/components/visao-imersao-2/VisaoImersao2Importer";
import { VisaoImersao2ImportPreview } from "@/components/visao-imersao-2/VisaoImersao2ImportPreview";
import { AcoesComerciaisCliente } from "@/components/visao-imersao-2/AcoesComerciaisCliente";
import { ExecutiveReportButton } from "@/components/executive-report/ExecutiveReportButton";
import { BrandPositioningRadarV2 } from "@/components/visao-rep2/BrandPositioningRadarV2";
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
  validateSearch: z.object({
    report: z.string().optional(),
  }),
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
  const { report: reportQuery } = Route.useSearch();
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

  /** Base comparável: demais relatórios salvos (um por cliente), exceto o aberto. */
  const outrosRelatorios = useMemo(() => {
    if (!avulso) return [] as NonNullable<typeof visao>[];
    const atualNome = (avulso.data.client.name ?? "").trim().toLowerCase();
    const vistos = new Set<string>();
    const out: NonNullable<typeof visao>[] = [];
    for (const r of reports as any[]) {
      if (r.id === avulso.id) continue;
      const nome = String(r.client_name ?? "").trim().toLowerCase();
      if (!nome || nome === atualNome || vistos.has(nome)) continue;
      try {
        const stored = r.structured_data as Record<string, unknown> | null;
        const data = Immersion2DataSchema.parse((stored as any)?.data ?? stored);
        const vm = buildVisaoImersao2ViewModel(data, extractEditorialChapters(r.content_markdown));
        if (!vm) continue;
        vistos.add(nome);
        out.push(vm);
      } catch {
        /* relatório incompatível é ignorado na base comparativa */
      }
    }
    return out;
  }, [reports, avulso]);

  /** Teia exige posicionamento de marcas; o paralelo com o grupo usa toda a base. */
  const comparaveis = useMemo(
    () => outrosRelatorios.filter(v => !!v.brand_positioning),
    [outrosRelatorios],
  );

  /** Relatório enriquecido com o paralelo calculado contra os demais clientes. */
  const visaoComGrupo = useMemo(
    () => (visao ? withGroupComparison(visao, outrosRelatorios) : null),
    [visao, outrosRelatorios],
  );



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


  // 1. Busca vínculo persistente ou candidatos em caso de ambiguidade
  const clientName = visao?.metadata?.client_name;
  const representativeName = visao?.metadata?.representative_name;

  const { data: commercialData, refetch: refetchCommercial } = useQuery({
    queryKey: ["vi2-commercial", avulso?.id, clientName, representativeName, avulso?.data?.resolved_client_id],
    enabled: !!clientName,
    queryFn: async () => {
      // 1. PRIORIDADE: Vínculo em memória (estado local do componente) ou persistido
      const manualId = avulso?.data?.resolved_client_id;
      if (manualId) {
        console.log("[VisaoImersao2] Usando ID de cliente em memória:", manualId);
        return await fetchClientCommercialData(manualId);
      }

      const reportId = avulso?.id;
      if (reportId) {
        const { data: savedReport } = await supabase
          .from("field_immersion_v2_reports")
          .select("structured_data")
          .eq("id", reportId)
          .single();
        
        const savedClientId = (savedReport?.structured_data as any)?.data?.resolved_client_id || (savedReport?.structured_data as any)?.resolved_client_id;
        if (savedClientId) {
          console.log("[VisaoImersao2] Usando ID de cliente persistido:", savedClientId);
          return await fetchClientCommercialData(savedClientId);
        }
      }

      // 2. BUSCA DE CANDIDATOS (CNPJ ou Nome)
      const normalizedSearch = clientName!.trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const { data: candidates } = await supabase
        .from("clients")
        .select(`
          id, 
          razao_social, 
          nome_fantasia, 
          cnpj, 
          cidade, 
          estado,
          categoria,
          representative_id,
          representatives:representative_id (nome, representacao)
        `)
        .or(`razao_social.ilike.%${normalizedSearch}%,nome_fantasia.ilike.%${normalizedSearch}%`)
        .limit(10);

      if (!candidates || candidates.length === 0) return { status: "not_found" };

      // Se houver apenas um match exato ou único, vincula automaticamente
      if (candidates.length === 1) {
        const candidate = candidates[0];
        // Short-circuit: Se o relatório já está salvo e identificamos o cliente único, 
        // persistimos o vínculo imediatamente para evitar re-calculo fuzzy no futuro.
        if (reportId) {
          const { data: current } = await supabase
            .from("field_immersion_v2_reports")
            .select("structured_data")
            .eq("id", reportId)
            .single();
          
          if (!(current?.structured_data as any)?.data?.resolved_client_id && !(current?.structured_data as any)?.resolved_client_id) {
            console.log("[VisaoImersao2] Persistindo vínculo automático único:", candidate.id);
            const currentData = (current?.structured_data as any)?.data || (current?.structured_data as any) || {};
            const newData = {
              ...(current?.structured_data as any || {}),
              data: {
                ...currentData,
                resolved_client_id: candidate.id,
              },
              resolved_client_id: candidate.id,
              resolved_at: new Date().toISOString(),
              resolution_method: "auto_unique"
            };
            await supabase
              .from("field_immersion_v2_reports")
              .update({ structured_data: newData })
              .eq("id", reportId);
            
            // Atualiza estado local também para sincronia imediata
            setAvulso(prev => prev ? {
              ...prev,
              data: { ...prev.data, resolved_client_id: candidate.id }
            } : null);
          }
        }
        return await fetchClientCommercialData(candidate.id);
      }

      // 3. AMBIGUIDADE: Retorna lista de candidatos para seleção manual
      return { 
        status: "ambiguous", 
        candidates: candidates.map(c => ({
          id: c.id,
          razao_social: c.razao_social,
          nome_fantasia: c.nome_fantasia,
          cnpj: c.cnpj,
          local: `${c.cidade || ""} / ${c.estado || ""}`,
          representante: (c as any).representatives?.nome || (c as any).representatives?.representacao || "—",
          categoria: c.categoria
        }))
      };
    }
  });

  async function fetchClientCommercialData(clientId: string) {
    // Busca o cliente primeiro para ter a Razão Social canônica
    const { data: clientInfo } = await supabase
      .from("clients")
      .select("razao_social, categoria, representative_id")
      .eq("id", clientId)
      .single();

    if (!clientInfo) return { status: "not_found" };

    // Busca o BI mais recente pela Razão Social (o schema não tem client_id)
    const { data: biUpload } = await (supabase as any)
      .from("client_bi_uploads")
      .select("data, representative_id, razao_social")
      .eq("razao_social", clientInfo.razao_social)
      .eq("kind", "bi")
      .is("substituida_em", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const biPayload = biUpload?.data as any;
    const client = clientInfo;

    if (!biPayload && !client) return { status: "not_found" };

    const familias = Array.isArray(biPayload?.familias) 
      ? biPayload.familias.map((item: any) => ({
          familia: String(item.familia ?? ""),
          pct: Math.abs(Number(item.atingimento ?? 0)) <= 1.5
            ? Number(item.atingimento ?? 0) * 100
            : Number(item.atingimento ?? 0),
          status: item.farol ?? "normal",
        }))
      : [];

    return {
      status: "linked",
      clientId,
      razaoSocial: client?.razao_social || biUpload?.razao_social,
      representativeId: client?.representative_id || biUpload?.representative_id,
      categoria: client?.categoria || biPayload?.categoria,
      geralPct: biPayload?.geral != null
        ? (Math.abs(Number(biPayload.geral)) <= 1.5 ? Number(biPayload.geral) * 100 : Number(biPayload.geral))
        : null,
      periodoLabel: biPayload?.periodo || "1º Semestre 2026",
      familias
    };
  }

  async function confirmarVinculo(clientId: string) {
    if (!avulso?.id) {
      toast.error("Salve o relatório primeiro para vincular o cliente permanentemente.");
      // Alternativa: Se for relatório novo, guardamos o ID no estado temporário do import
      setAvulso(prev => prev ? {
        ...prev,
        data: {
          ...prev.data,
          resolved_client_id: clientId
        }
      } : null);
      return;
    }

    setSalvando(true);
    try {
      const { data: current, error: fetchError } = await supabase
        .from("field_immersion_v2_reports")
        .select("structured_data")
        .eq("id", avulso.id)
        .single();

      if (fetchError) throw fetchError;

      const currentData = (current?.structured_data as any)?.data || (current?.structured_data as any) || {};
      const newData = {
        ...(current?.structured_data as any || {}),
        data: {
          ...currentData,
          resolved_client_id: clientId,
        },
        resolved_client_id: clientId, // Root para compatibilidade
        resolved_at: new Date().toISOString(),
        resolution_method: "manual"
      };

      const { error: updateError } = await supabase
        .from("field_immersion_v2_reports")
        .update({ structured_data: newData })
        .eq("id", avulso.id);

      if (updateError) throw updateError;
      
      // Forçar atualização do estado local do avulso para evitar que o render atual
      // use structured_data antigo antes do refetch
      setAvulso(prev => prev ? {
        ...prev,
        data: {
          ...prev.data,
          resolved_client_id: clientId
        }
      } : null);

      await queryClient.invalidateQueries({ queryKey: ["vi2-commercial", avulso.id] });
      await refetchCommercial();
      toast.success("Vínculo comercial confirmado e persistido.");
    } catch (e: any) {
      console.error("[VisaoImersao2] Erro na persistência do vínculo:", e);
      toast.error("Erro ao salvar vínculo no banco: " + e.message);
    } finally {
      setSalvando(false);
    }
  }


  const perf = useMemo((): PerfResumo | null => {
    if (!commercialData || (commercialData as any).status !== "linked") return null;
    const cd = commercialData as any;
    
    return {
      geralPct: cd.geralPct,
      periodoLabel: cd.periodoLabel,
      familias: cd.familias,
      mediaGrupoPct: 0,
      diffPp: 0,
      posicao: 0,
      totalReps: 0,
      clientes: 1,
      destaques: [],
      criticas: [],
      farol: [],
      estimado: false,
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
        title={`Visão Imersão 2 · ${visao.metadata.client_name}`} 
        subtitle={`Arquivo: ${avulso.arquivo}${dirty ? " · alterações não salvas" : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ExecutiveReportButton reportId={avulso.id} />
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
        {/* 1, 2, 3, 4. Header (Briefing, Marcas, Atingimento) + Síntese */}
        <div className="space-y-6">
          <ExecutiveBriefV2
            brief={{
              contexto: {
                marcas: visao.representative_context.represented_brands,
                regiaoModelo: visao.representative_context.additional_context || "",
              },
              clientes: visao.strategic_clients.map(c => ({
                nome: c.client_name || "",
                motivo: c.strategic_reason || "",
              })),
              sintese: visao.executive_brief?.presidential_synthesis || "",
              temas: [],
              conclusoes: [],
              perspectivas: [],
              decisoes: visao.executive_view.decisions_required.map(d => ({
                texto: d,
                status: "A decidir",
              })),
              validacoes: visao.executive_view.validation_required.map(v => ({
                texto: v,
                status: "A validar",
              })),
            }}
            nome={visao.metadata.client_name || ""}
            regiao={visao.metadata.region || ""}
            perf={perf}
            visao={visao}
            teia={<BrandPositioningRadarV2 atual={visao} comparaveis={comparaveis} />}
            mode="imersao"
            categoria={commercialData?.status === "linked" ? (commercialData as any).categoria : null}
          />

          {commercialData?.status === "ambiguous" && (
            <Alert variant="destructive" className="bg-destructive/5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ambiguidade comercial</AlertTitle>
              <AlertDescription className="space-y-4">
                <p>Encontramos mais de um cliente compatível com este relatório. Selecione o cadastro correto para vincular os dados de performance:</p>
                <div className="grid gap-2 mt-2">
                  {commercialData?.status === "ambiguous" && (commercialData as any).candidates?.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent transition-colors">
                      <div className="text-sm">
                        <p className="font-bold">{c.razao_social}</p>
                        <p className="text-muted-foreground text-xs">
                          {c.local} · Rep: {c.representante} · Categoria: {c.categoria || "—"}
                        </p>
                        {c.cnpj && <p className="text-[10px] text-muted-foreground">CNPJ: {c.cnpj}</p>}
                      </div>
                      <Button size="sm" onClick={() => confirmarVinculo(c.id)}>
                        Confirmar vínculo
                      </Button>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {commercialData?.status === "not_found" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Aguardando vínculo com a base comercial</AlertTitle>
              <AlertDescription>
                Não foi possível localizar este cliente automaticamente na base PoolFlux. Os indicadores de performance serão exibidos após o vínculo manual ou correção do nome no relatório.
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        {/* 5. RESULTADO POR FAMÍLIA — o mesmo gráfico e a mesma fonte do BI do cliente. */}
        {commercialData?.status === "linked" ? (
          <ClientFamiliasChart
            repId={(commercialData as any).representativeId}
            razaoSocial={(commercialData as any).razaoSocial}

            companyId={null}
            filterFams={[]}
          />
        ) : (
          <section className="surface overflow-hidden rounded-xl" aria-labelledby="vi2-resultado-familia">
            <div className="border-b border-border px-4 py-3">
              <h3 id="vi2-resultado-familia" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Resultado por família
              </h3>
            </div>
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">
                —<br />
                Aguardando vínculo com a base comercial para carregar resultados por família.
              </p>
            </div>
          </section>
        )}


        {/* 6. LEITURA INTEGRADA */}
        <LeituraIntegradaV2 visao={visaoComGrupo ?? visao} defaultOpen={true} />

        {/* 7. ÁREAS DE APROFUNDAMENTO */}
        <AreasAprofundamento
          perspectivas={buildPerspectivasVM(visao)}
          titulo="ÁREAS DE APROFUNDAMENTO"
          defaultOpen={false}
        />


        {/* 8. AÇÕES COMERCIAIS NO CLIENTE (espelho da Gestão de Tarefas) */}
        <AcoesComerciaisCliente
          clientId={commercialData?.status === "linked" ? (commercialData as any).clientId : null}
          clientName={visao.metadata.client_name ?? null}
        />



        {/* Diagnóstico Técnico (Admin Only) */}
        {debugMode && (
          <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-6">
            <h4 className="mb-4 font-bold text-primary">Diagnóstico Técnico da Importação</h4>
            <div className="grid gap-6 text-xs md:grid-cols-2">
              <div className="space-y-2">
                <p><strong>Status do vínculo:</strong> {commercialData?.status === "linked" ? "Resolvido" : commercialData?.status === "ambiguous" ? "Ambíguo" : "Não encontrado"}</p>
                <p><strong>Método:</strong> {(commercialData as any)?.status === "linked" ? "Persistido/Auto" : "N/A"}</p>
                <p><strong>Cliente resolvido:</strong> {commercialData?.status === "linked" ? (commercialData as any).clientId : "Não vinculado"}</p>
                {commercialData?.status === "linked" && (
                  <>
                    <p><strong>Razão:</strong> {(commercialData as any).razaoSocial}</p>
                    <p><strong>Categoria:</strong> {(commercialData as any).categoria || "—"}</p>
                  </>
                )}
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
  );
}
