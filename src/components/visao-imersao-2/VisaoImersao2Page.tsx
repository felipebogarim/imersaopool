import { type PerfResumo } from "@/lib/visao-rep";

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
import { resolveClientCommercialData } from "@/lib/client-commercial-resolver";
import { 
  ArrowLeft, 
  Compass,
  Save,
  AlertCircle,
  MoreVertical,
  Mail,
  MessageCircle,
  Link as LinkIcon,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  Building2,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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


import { useNavigate } from "@tanstack/react-router";

export function VisaoImersao2Page({ reportId }: { reportId?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [avulso, setAvulso] = useState<VisaoImersao2Import | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [preview, setPreview] = useState<VisaoImersao2Import | null>(null);

  const [dirty, setDirty] = useState(false);
  const [duplicata, setDuplicata] = useState<any | null>(null);
  const [excluir, setExcluir] = useState<any | null>(null);

  const [vincularOpen, setVincularOpen] = useState(false);
  const [buscaTermo, setBuscaTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [clientesEncontrados, setClientesEncontrados] = useState<any[]>([]);

  function linkRelatorio(r: any) {
    return `${window.location.origin}/visao-imersao-2/${r.id}`;
  }

  function resumoRelatorio(r: any) {
    const dt = r.visit_date ? new Date(`${r.visit_date}T00:00:00`).toLocaleDateString("pt-BR") : "—";
    return `Visão Imersão 2 · ${r.client_name} · ${dt}\n${linkRelatorio(r)}`;
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

  /** Abre diretamente o relatório salvo quando a URL traz /visao-imersao-2/<id>. */
  useEffect(() => {
    if (!reportId || !reports.length) return;
    if (avulso?.id === reportId) return;
    const match = (reports as any[]).find((r) => r.id === reportId);
    if (match) {
      abrirRelatorio(match, { navegar: false });
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, reports.length, avulso?.id]);

  function voltarParaLista() {
    setAvulso(null);
    setDirty(false);
    if (reportId) void navigate({ to: "/visao-imersao-2" });
  }

  function abrirRelatorio(report: any, opts?: { navegar?: boolean }) {
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
      if (opts?.navegar !== false && report.id) {
        void navigate({ to: "/visao-imersao-2/$reportId", params: { reportId: String(report.id) } });
      }
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

      const resolvedId =
        avulso.data.resolved_client_id ||
        (avulso.data.client as any)?.resolved_client_id ||
        (avulso.data.client as any)?.client_id ||
        undefined;

      const payload = {
        client_name: avulso.data.client.name,
        visit_date: avulso.data.client.visit_date,
        source_filename: avulso.arquivo,
        content_markdown: avulso.markdown,
        structured_data: {
          schema: "visao_imersao_2_data_v1",
          block: "visao_imersao_2",
          data: {
            ...avulso.data,
            resolved_client_id: resolvedId,
          },
          resolved_client_id: resolvedId,
        } as any,
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
  const clientTradeName =
    (avulso?.data?.client as any)?.trade_name ||
    (avulso?.data as any)?.trade_name ||
    visao?.metadata?.client_trade_name ||
    "";

  const { data: commercialData, refetch: refetchCommercial } = useQuery({
    queryKey: [
      "vi2-commercial",
      avulso?.id,
      clientName,
      representativeName,
      clientTradeName,
      avulso?.data?.resolved_client_id,
      (avulso?.data?.client as any)?.resolved_client_id,
    ],
    enabled: !!clientName,
    queryFn: async () => {
      // 1. PRIORIDADE: Vínculo em memória (estado local do componente) ou persistido
      const manualId =
        avulso?.data?.resolved_client_id ||
        (avulso?.data?.client as any)?.resolved_client_id ||
        (avulso?.data?.client as any)?.client_id;
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

        const savedClientId =
          (savedReport?.structured_data as any)?.data?.resolved_client_id ||
          (savedReport?.structured_data as any)?.resolved_client_id ||
          (savedReport?.structured_data as any)?.data?.client?.resolved_client_id;
        if (savedClientId) {
          console.log("[VisaoImersao2] Usando ID de cliente persistido:", savedClientId);
          return await fetchClientCommercialData(savedClientId);
        }
      }

      // 2. BUSCA INTELIGENTE DE CANDIDATOS (trade_name, nome fantasia, razão social)
      const cleanCorp = (str: string) =>
        str
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(
            /\b(LTDA|ME|EPP|EIRELI|S\/A|S\.A\.|SA|SOCIEDADE ANONIMA|DISTRIBUIDORA DE MATERIAL ELETRICO E SERVICOS|DISTRIBUIDORA DE MATERIAL ELETRICO|DISTRIBUIDORA)\b/g,
            "",
          )
          .replace(/[^\w\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const searchPhrases = Array.from(
        new Set(
          [
            clientTradeName,
            cleanCorp(clientTradeName),
            clientName,
            cleanCorp(clientName || ""),
          ]
            .filter((s): s is string => Boolean(s && s.trim().length >= 3))
            .map((s) =>
              s
                .trim()
                .toUpperCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, ""),
            ),
        ),
      );

      let candidates: any[] = [];
      if (searchPhrases.length > 0) {
        const orConditions = searchPhrases
          .flatMap((term) => [
            `razao_social.ilike.%${term}%`,
            `nome_fantasia.ilike.%${term}%`,
          ])
          .join(",");

        const { data } = await supabase
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
          .or(orConditions)
          .limit(20);

        candidates = data ?? [];
      }

      if (!candidates || candidates.length === 0) return { status: "not_found" };

      // Se houver mais de um candidato, tentar desempatar por representante ou correspondência exata
      let chosenCandidate = candidates.length === 1 ? candidates[0] : null;

      if (!chosenCandidate && candidates.length > 1) {
        // Desempate 1: Representante
        if (representativeName) {
          const normRep = representativeName
            .toUpperCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
          const repMatches = candidates.filter((c) => {
            const rNome = String((c as any).representatives?.nome || "")
              .toUpperCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");
            const rRep = String((c as any).representatives?.representacao || "")
              .toUpperCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");
            return rNome.includes(normRep) || rRep.includes(normRep) || normRep.includes(rNome);
          });
          if (repMatches.length === 1) {
            chosenCandidate = repMatches[0];
          }
        }

        // Desempate 2: Trade Name exato
        if (!chosenCandidate && clientTradeName) {
          const normTrade = cleanCorp(clientTradeName);
          const tradeMatches = candidates.filter(
            (c) =>
              cleanCorp(c.nome_fantasia || "") === normTrade ||
              cleanCorp(c.razao_social || "") === normTrade,
          );
          if (tradeMatches.length === 1) {
            chosenCandidate = tradeMatches[0];
          }
        }
      }

      if (chosenCandidate) {
        const candidate = chosenCandidate;
        if (reportId) {
          const { data: current } = await supabase
            .from("field_immersion_v2_reports")
            .select("structured_data")
            .eq("id", reportId)
            .single();

          if (
            !(current?.structured_data as any)?.data?.resolved_client_id &&
            !(current?.structured_data as any)?.resolved_client_id
          ) {
            console.log("[VisaoImersao2] Persistindo vínculo automático único:", candidate.id);
            const currentData =
              (current?.structured_data as any)?.data || (current?.structured_data as any) || {};
            const newData = {
              ...((current?.structured_data as any) || {}),
              data: {
                ...currentData,
                resolved_client_id: candidate.id,
              },
              resolved_client_id: candidate.id,
              resolved_at: new Date().toISOString(),
              resolution_method: "auto_unique",
            };
            await supabase
              .from("field_immersion_v2_reports")
              .update({ structured_data: newData })
              .eq("id", reportId);

            setAvulso((prev) =>
              prev
                ? {
                    ...prev,
                    data: { ...prev.data, resolved_client_id: candidate.id },
                  }
                : null,
            );
          }
        } else {
          // Relatório avulso em memória: já anota no estado para que ao clicar em "Salvar" vá vinculado
          setAvulso((prev) =>
            prev && !prev.data.resolved_client_id
              ? {
                  ...prev,
                  data: { ...prev.data, resolved_client_id: candidate.id },
                }
              : prev,
          );
        }
        return await fetchClientCommercialData(candidate.id);
      }

      // 3. AMBIGUIDADE: Retorna lista de candidatos para seleção manual
      return {
        status: "ambiguous",
        candidates: candidates.map((c) => ({
          id: c.id,
          razao_social: c.razao_social,
          nome_fantasia: c.nome_fantasia,
          cnpj: c.cnpj,
          local: `${c.cidade || ""} / ${c.estado || ""}`,
          representante:
            (c as any).representatives?.nome || (c as any).representatives?.representacao || "—",
          categoria: c.categoria,
        })),
      };
    },
  });

  async function fetchClientCommercialData(clientId: string) {
    return await resolveClientCommercialData(clientId);
  }

  function abrirModalVinculo() {
    const initialTerm =
      clientTradeName ||
      visao?.metadata?.client_name ||
      "";
    setBuscaTermo(initialTerm);
    setVincularOpen(true);
    void executarBuscaClientes(initialTerm);
  }

  async function executarBuscaClientes(termo: string) {
    setBuscando(true);
    try {
      const clean = termo.trim();
      let query = supabase
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
        .order("nome_fantasia", { ascending: true })
        .limit(30);

      if (clean) {
        const norm = clean
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        query = query.or(
          `razao_social.ilike.%${norm}%,nome_fantasia.ilike.%${norm}%,cnpj.ilike.%${norm}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      setClientesEncontrados(data ?? []);
    } catch (e: any) {
      console.error("[VisaoImersao2] Erro na busca manual de clientes:", e);
      toast.error("Falha ao buscar clientes na base comercial.");
    } finally {
      setBuscando(false);
    }
  }

  async function confirmarVinculo(clientId: string) {
    // 1. Atualiza estado em memória imediatamente para renderizar na UI
    setAvulso((prev) =>
      prev
        ? {
            ...prev,
            data: {
              ...prev.data,
              resolved_client_id: clientId,
              client: {
                ...prev.data.client,
                resolved_client_id: clientId,
              },
            },
          }
        : null,
    );
    setDirty(true);
    setVincularOpen(false);

    // 2. Se o relatório já foi salvo, persiste no banco
    if (avulso?.id) {
      setSalvando(true);
      try {
        const { data: current, error: fetchError } = await supabase
          .from("field_immersion_v2_reports")
          .select("structured_data")
          .eq("id", avulso.id)
          .single();

        if (fetchError) throw fetchError;

        const currentData =
          (current?.structured_data as any)?.data || (current?.structured_data as any) || {};
        const newData = {
          ...((current?.structured_data as any) || {}),
          data: {
            ...currentData,
            resolved_client_id: clientId,
            client: {
              ...(currentData.client || {}),
              resolved_client_id: clientId,
            },
          },
          resolved_client_id: clientId,
          resolved_at: new Date().toISOString(),
          resolution_method: "manual",
        };

        const { error: updateError } = await supabase
          .from("field_immersion_v2_reports")
          .update({ structured_data: newData })
          .eq("id", avulso.id);

        if (updateError) throw updateError;
        toast.success("Vínculo comercial confirmado e persistido.");
      } catch (e: any) {
        console.error("[VisaoImersao2] Erro na persistência do vínculo:", e);
        toast.error("Erro ao salvar vínculo no banco: " + e.message);
      } finally {
        setSalvando(false);
      }
    } else {
      toast.success("Cliente vinculado em memória. Clique em 'Salvar relatório' para persistir.");
    }

    await queryClient.invalidateQueries({ queryKey: ["vi2-commercial"] });
    await refetchCommercial();
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
                          <DropdownMenuItem
                            onClick={() => {
                              void navigator.clipboard?.writeText(linkRelatorio(r));
                              toast.success("Link da análise copiado.");
                            }}
                          >
                            <LinkIcon className="mr-2 h-4 w-4" /> Copiar link da análise
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
            <Button
              variant="outline"
              onClick={abrirModalVinculo}
              title="Gerenciar vínculo comercial com cliente da base"
            >
              <LinkIcon className="mr-1 h-4 w-4" />
              {commercialData?.status === "linked" ? "Alterar vínculo" : "Vincular cliente"}
            </Button>
            <VisaoImersao2Importer onValidated={setPreview} variant="outline" label="Substituir relatório" />
            <Button variant="outline" onClick={() => setDebugMode(!debugMode)}>
              {debugMode ? "Esconder Diagnóstico" : "Ver Diagnóstico"}
            </Button>
            <Button variant="ghost" onClick={voltarParaLista}>
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

          {commercialData?.status === "linked" && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Vínculo comercial estabelecido: <strong className="font-semibold text-foreground">{(commercialData as any).razaoSocial}</strong>
                  {(commercialData as any).nomeFantasia &&
                    (commercialData as any).nomeFantasia !== (commercialData as any).razaoSocial && (
                      <span className="text-muted-foreground"> ({(commercialData as any).nomeFantasia})</span>
                    )}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={abrirModalVinculo}
              >
                <Pencil className="h-3 w-3" /> Alterar cliente
              </Button>
            </div>
          )}

          {commercialData?.status === "ambiguous" && (
            <Alert variant="destructive" className="bg-destructive/5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>Ambiguidade comercial</span>
                <Button size="sm" variant="outline" onClick={abrirModalVinculo} className="h-7 text-xs gap-1">
                  <Search className="h-3 w-3" /> Buscar outro cadastro
                </Button>
              </AlertTitle>
              <AlertDescription className="space-y-4">
                <p>Encontramos mais de um cliente compatível com este relatório. Selecione o cadastro correto para vincular os dados de performance:</p>
                <div className="grid gap-2 mt-2">
                  {commercialData?.status === "ambiguous" && (commercialData as any).candidates?.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent transition-colors">
                      <div className="text-sm">
                        <p className="font-bold">{c.razao_social}</p>
                        {c.nome_fantasia && c.nome_fantasia !== c.razao_social && (
                          <p className="text-xs text-muted-foreground font-medium">{c.nome_fantasia}</p>
                        )}
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
            <Alert className="border-amber-500/30 bg-amber-500/5">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-amber-900 dark:text-amber-200">Aguardando vínculo com a base comercial</AlertTitle>
              <AlertDescription className="space-y-3">
                <p className="text-muted-foreground">
                  Não foi possível localizar este cliente automaticamente na base comercial. Clique no botão abaixo para buscar e selecionar o cadastro correspondente:
                </p>
                <div>
                  <Button size="sm" onClick={abrirModalVinculo} className="gap-1.5 shadow-sm">
                    <LinkIcon className="h-3.5 w-3.5" /> Buscar e vincular cliente manualmente
                  </Button>
                </div>
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
        {/* Modal de Busca e Vínculo Manual de Cliente */}
        <Dialog open={vincularOpen} onOpenChange={setVincularOpen}>
          <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> Vincular Cliente Comercial
              </DialogTitle>
              <DialogDescription>
                Pesquise pelo nome fantasia, razão social ou CNPJ para vincular este relatório aos dados de atingimento e metas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ex: ALL LED, RSS DISTRIBUIDORA, Salvador..."
                    value={buscaTermo}
                    onChange={(e) => {
                      setBuscaTermo(e.target.value);
                      void executarBuscaClientes(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void executarBuscaClientes(buscaTermo);
                      }
                    }}
                    className="pl-8"
                    autoFocus
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => void executarBuscaClientes(buscaTermo)}
                  disabled={buscando}
                >
                  {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                </Button>
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-border border rounded-lg max-h-[400px]">
                {buscando && (
                  <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando clientes...
                  </div>
                )}
                {!buscando && clientesEncontrados.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Nenhum cliente localizado para "{buscaTermo}". Tente outro termo ou limpe o campo para ver os primeiros cadastros.
                  </div>
                )}
                {!buscando &&
                  clientesEncontrados.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">
                            {c.nome_fantasia || c.razao_social}
                          </p>
                          {c.categoria && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              {c.categoria}
                            </Badge>
                          )}
                        </div>
                        {c.nome_fantasia && c.razao_social && c.nome_fantasia !== c.razao_social && (
                          <p className="text-xs text-muted-foreground truncate">{c.razao_social}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {[
                            c.cidade && c.estado ? `${c.cidade}/${c.estado}` : c.cidade || c.estado,
                            c.representatives?.nome || c.representatives?.representacao
                              ? `Rep: ${c.representatives.nome || c.representatives.representacao}`
                              : null,
                            c.cnpj ? `CNPJ: ${c.cnpj}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="shrink-0"
                        onClick={() => void confirmarVinculo(c.id)}
                      >
                        Vincular
                      </Button>
                    </div>
                  ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setVincularOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

