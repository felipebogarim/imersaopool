import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  MapPin,
  Briefcase,
  Users,
  Pencil,
  ShieldCheck,
  Plus,
  List,
  Kanban,
  LayoutDashboard,
  Trash2,
  ArrowLeft,
  Loader2,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { RepBrazilMap } from "@/components/estrutura-rep/RepBrazilMap";
import { TreinamentosSection } from "@/components/estrutura-rep/TreinamentosSection";
import { FrequenciaVisitasSection } from "@/components/estrutura-rep/FrequenciaVisitasSection";
import { TreinamentoEditorModal } from "@/components/estrutura-rep/TreinamentoEditorModal";
import {
  ClienteFrequenciaModal,
  type SaveFrequenciaOptions,
} from "@/components/estrutura-rep/ClienteFrequenciaModal";
import { EstruturaFisicaSection } from "@/components/estrutura-rep/EstruturaFisicaSection";
import { EquipeOrganogramaSection } from "@/components/estrutura-rep/EquipeOrganogramaSection";
import { RepStructureEditorDialog } from "@/components/estrutura-rep/RepStructureEditorDialog";
import { RepListView } from "@/components/estrutura-rep/RepListView";
import { RepKanbanView } from "@/components/estrutura-rep/RepKanbanView";
import { NewRepDialog } from "@/components/estrutura-rep/NewRepDialog";
import { RepMarcasStrip } from "@/components/estrutura-rep/RepMarcasStrip";
import { BrandEditorModal } from "@/components/estrutura-rep/BrandEditorModal";
import {
  loadRepStructure,
  loadAllRepStructures,
  saveRepStructure,
  deleteRepStructure,
} from "@/lib/estrutura-rep/storage";
import { shareRepStructureByWhatsapp } from "@/lib/estrutura-rep/whatsapp";
import type {
  RepStructure,
  RepresentadaItem,
  TreinamentoItem,
  ClienteFrequenciaItem,
} from "@/lib/estrutura-rep/types";
import {
  MODELO_ESCRITORIO_LABEL,
  MODELO_ATUACAO_LABEL,
  RECURSOS_CONFIG,
} from "@/lib/estrutura-rep/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estrutura-rep")({
  validateSearch: (
    search: Record<string, unknown>
  ): { rep?: string; view?: "lista" | "kanban" | "painel" } => ({
    rep: typeof search.rep === "string" ? search.rep : undefined,
    view:
      search.view === "kanban" || search.view === "painel" || search.view === "lista"
        ? (search.view as "lista" | "kanban" | "painel")
        : "lista",
  }),
  head: () => ({
    meta: [
      { title: "Estrutura Rep — Imersões — PoolFlux" },
      {
        name: "description",
        content:
          "Painel executivo com a radiografia visual da estrutura completa da empresa de representação comercial.",
      },
    ],
  }),
  component: EstruturaRepPage,
});

function EstruturaRepPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const viewMode = search.view || "lista";

  // Estados de modais
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRepId, setEditingRepId] = useState<string | null>(null);
  const [editorInitialTab, setEditorInitialTab] = useState<string>("identificacao");
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<RepresentadaItem | null>(null);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<TreinamentoItem | null>(null);
  const [freqModalOpen, setFreqModalOpen] = useState(false);
  const [editingFreq, setEditingFreq] = useState<ClienteFrequenciaItem | null>(null);
  const [freqModalBatchMode, setFreqModalBatchMode] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; nome: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sharingWhats, setSharingWhats] = useState(false);

  // 1. Carrega lista de representantes
  const { data: reps = [], isLoading: loadingReps } = useQuery({
    queryKey: ["estrutura-reps-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("representatives")
        .select("id, nome, representacao, regiao, outras_marcas, email, telefone")
        .order("nome");
      return data ?? [];
    },
  });

  // 2. Carrega estruturas de todos os representantes para listagem e kanban
  const { data: allStructures = {}, isLoading: loadingAllStructures } = useQuery({
    queryKey: ["rep-structures-all", reps],
    enabled: reps.length > 0,
    queryFn: async () => {
      return await loadAllRepStructures(reps);
    },
  });

  // Representante selecionado para visualização em painel/radiografia
  const selectedRepId = search.rep || (reps.length > 0 ? reps[0].id : "");
  const selectedRep = useMemo(
    () => reps.find((r) => r.id === selectedRepId) || reps[0] || null,
    [reps, selectedRepId]
  );

  // Estrutura do representante selecionado (ou da edição ativa)
  const structure = useMemo(() => {
    if (editingRepId && allStructures[editingRepId]) {
      return allStructures[editingRepId];
    }
    if (selectedRep?.id && allStructures[selectedRep.id]) {
      return allStructures[selectedRep.id];
    }
    return null;
  }, [allStructures, editingRepId, selectedRep]);

  // Clientes já cadastrados na estrutura do representante (Top 10 frequencia_visitas e treinamentos)
  const repStructureClients = useMemo(() => {
    const list: Array<{ nome: string; cidade?: string | null; estado?: string | null }> = [];
    const seen = new Set<string>();

    for (const f of structure?.frequencia_visitas || []) {
      const norm = (f.cliente_nome || "").trim().toLowerCase();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        list.push({ nome: f.cliente_nome, cidade: f.cidade, estado: f.uf });
      }
    }

    for (const t of structure?.treinamentos || []) {
      const norm = (t.cliente_nome || "").trim().toLowerCase();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        list.push({ nome: t.cliente_nome });
      }
    }

    return list;
  }, [structure]);

  const setView = (v: "lista" | "kanban" | "painel", repId?: string) => {
    navigate({
      to: "/estrutura-rep",
      search: {
        view: v,
        rep: repId || selectedRepId,
      },
    });
  };

  const handleSelectRep = (repId: string) => {
    navigate({
      to: "/estrutura-rep",
      search: {
        view: "painel",
        rep: repId,
      },
    });
  };

  // Abre visualização detalhada em formato Painel / Radiografia
  const handleViewPanel = (repId: string) => {
    navigate({
      to: "/estrutura-rep",
      search: {
        view: "painel",
        rep: repId,
      },
    });
  };

  // Abre modal de edição completa
  const handleOpenEdit = (repId: string, initialTab: string = "identificacao") => {
    setEditingRepId(repId);
    setEditorInitialTab(initialTab);
    setEditorOpen(true);
  };

  // Abre modal focado em adicionar nova marca
  const handleOpenAddBrand = () => {
    setEditingBrand(null);
    setBrandModalOpen(true);
  };

  // Abre modal focado em editar marca existente ou alterar logo
  const handleOpenEditBrand = (brandId: string) => {
    const found = structure?.marcas_representadas?.find((m) => m.id === brandId) || null;
    setEditingBrand(found);
    setBrandModalOpen(true);
  };

  // Salva estrutura editada
  const handleSaveStructure = async (updated: RepStructure) => {
    await saveRepStructure(updated);
    await queryClient.invalidateQueries({ queryKey: ["rep-structures-all"] });
    await queryClient.invalidateQueries({ queryKey: ["estrutura-reps-list"] });
    toast.success("Estrutura atualizada com sucesso!");
    setEditorOpen(false);
    setEditingRepId(null);
  };

  // Salva marca diretamente e persiste imediatamente na estrutura
  const handleSaveBrand = async (brandItem: RepresentadaItem) => {
    if (!structure) {
      toast.error("Nenhum representante selecionado para vincular a marca.");
      return;
    }

    const currentMarcas = structure.marcas_representadas || [];
    const exists = currentMarcas.some((m) => m.id === brandItem.id);
    const updatedMarcas = exists
      ? currentMarcas.map((m) => (m.id === brandItem.id ? brandItem : m))
      : [...currentMarcas, brandItem];

    const updatedStructure: RepStructure = {
      ...structure,
      marcas_representadas: updatedMarcas,
    };

    await saveRepStructure(updatedStructure);
    await queryClient.invalidateQueries({ queryKey: ["rep-structures-all"] });
    await queryClient.invalidateQueries({ queryKey: ["estrutura-reps-list"] });
    setBrandModalOpen(false);
    setEditingBrand(null);
  };

  // Salva agendamento de treinamento diretamente e persiste
  const handleSaveTreinamento = async (item: TreinamentoItem) => {
    if (!structure) {
      toast.error("Nenhum representante selecionado.");
      return;
    }

    const current = structure.treinamentos || [];
    const exists = current.some((t) => t.id === item.id);
    const updated = exists
      ? current.map((t) => (t.id === item.id ? item : t))
      : [...current, item];

    const updatedStructure: RepStructure = {
      ...structure,
      treinamentos: updated,
    };

    await saveRepStructure(updatedStructure);
    await queryClient.invalidateQueries({ queryKey: ["rep-structures-all"] });
    setTrainingModalOpen(false);
    setEditingTraining(null);
  };

  // Exclui agendamento de treinamento
  const handleDeleteTreinamento = async (trainId: string) => {
    if (!structure) return;

    const current = structure.treinamentos || [];
    const updated = current.filter((t) => t.id !== trainId);

    const updatedStructure: RepStructure = {
      ...structure,
      treinamentos: updated,
    };

    await saveRepStructure(updatedStructure);
    await queryClient.invalidateQueries({ queryKey: ["rep-structures-all"] });
    toast.success("Agendamento de treinamento removido.");
  };

  // Salva cliente e frequência no Top 10 (individual ou em lote) e para os demais clientes
  const handleSaveFrequencia = async (payload: SaveFrequenciaOptions) => {
    if (!structure) {
      toast.error("Nenhum representante selecionado.");
      return;
    }

    let updatedFrequencia = [...(structure.frequencia_visitas || [])];

    if (payload.aplicarTodosTop10 && typeof payload.frequenciaTodosDias === "number") {
      if (updatedFrequencia.length > 0) {
        updatedFrequencia = updatedFrequencia.map((f) => ({
          ...f,
          frequencia_dias: payload.frequenciaTodosDias!,
        }));
      } else {
        updatedFrequencia = Array.from({ length: 10 }, (_, i) => ({
          id: `freq-${i + 1}`,
          posicao: i + 1,
          cliente_nome: `Cliente Top ${i + 1}`,
          frequencia_dias: payload.frequenciaTodosDias!,
        }));
      }
    } else if (payload.item) {
      const exists = updatedFrequencia.some((f) => f.id === payload.item!.id);
      updatedFrequencia = exists
        ? updatedFrequencia.map((f) => (f.id === payload.item!.id ? payload.item! : f))
        : [...updatedFrequencia, payload.item!];
    }

    // Ordena por posição
    updatedFrequencia.sort((a, b) => (a.posicao || 99) - (b.posicao || 99));

    const updatedStructure: RepStructure = {
      ...structure,
      frequencia_visitas: updatedFrequencia,
      frequencia_demais_clientes:
        typeof payload.frequenciaDemaisClientes === "number"
          ? payload.frequenciaDemaisClientes
          : (structure.frequencia_demais_clientes ?? 60),
    };

    await saveRepStructure(updatedStructure);
    await queryClient.invalidateQueries({ queryKey: ["rep-structures-all"] });
    setFreqModalOpen(false);
    setEditingFreq(null);
    setFreqModalBatchMode(false);
  };

  // Exclui cliente do Top 10
  const handleDeleteFrequencia = async (freqId: string) => {
    if (!structure) return;

    const current = structure.frequencia_visitas || [];
    const updated = current.filter((f) => f.id !== freqId);

    const updatedStructure: RepStructure = {
      ...structure,
      frequencia_visitas: updated,
    };

    await saveRepStructure(updatedStructure);
    await queryClient.invalidateQueries({ queryKey: ["rep-structures-all"] });
    toast.success("Cliente removido da lista Top 10.");
  };

  // Confirmação de exclusão
  const handlePromptDelete = (repId: string, nome: string) => {
    setPendingDelete({ id: repId, nome });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteRepStructure(pendingDelete.id);
      toast.success(`Representante "${pendingDelete.nome}" excluído com sucesso.`);
      await queryClient.invalidateQueries({ queryKey: ["estrutura-reps-list"] });
      await queryClient.invalidateQueries({ queryKey: ["rep-structures-all"] });
      setPendingDelete(null);

      // Se apagou o que estava aberto no painel, volta para a lista
      if (selectedRepId === pendingDelete.id) {
        setView("lista");
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha ao excluir representante");
    } finally {
      setDeleting(false);
    }
  };

  // Callback de criação de novo representante
  const handleNewRepSuccess = (created: RepStructure) => {
    queryClient.invalidateQueries({ queryKey: ["estrutura-reps-list"] });
    queryClient.invalidateQueries({ queryKey: ["rep-structures-all"] });
    // Navega para a visualização da radiografia do novo representante
    handleViewPanel(created.representative_id);
  };

  const handleShareCurrentWhats = async () => {
    if (!structure) return;
    setSharingWhats(true);
    try {
      await shareRepStructureByWhatsapp(structure, {
        email: selectedRep?.email,
        telefone: selectedRep?.telefone,
      });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao compartilhar no WhatsApp");
    } finally {
      setSharingWhats(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col bg-muted/10 pb-12">
      {/* PageHeader com Botão de Adicionar Novo e Alternância de Visualização */}
      <PageHeader
        title="Estrutura Rep"
        subtitle="Radiografia executiva da estrutura e capacidade operacional da representação"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Modo de Visualização (Lista / Kanban / Painel) */}
            <div className="flex items-center bg-background rounded-lg border p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setView("lista")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  viewMode === "lista"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Visualização em Lista"
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </button>

              <button
                type="button"
                onClick={() => setView("kanban")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  viewMode === "kanban"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Visualização em Quadro Kanban"
              >
                <Kanban className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>

              <button
                type="button"
                onClick={() => setView("painel")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  viewMode === "painel"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Radiografia Executiva Detalhada"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Radiografia</span>
              </button>
            </div>

            {/* Ações Específicas do Modo Painel */}
            {viewMode === "painel" && (
              <div className="flex items-center gap-1.5">
                <div className="w-48 sm:w-56">
                  <Select
                    value={selectedRepId}
                    onValueChange={handleSelectRep}
                    disabled={loadingReps || reps.length === 0}
                  >
                    <SelectTrigger className="h-9 bg-background text-xs font-semibold">
                      <SelectValue placeholder="Selecione um representante" />
                    </SelectTrigger>
                    <SelectContent>
                      {reps.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="text-xs">
                          {r.nome} {r.representacao ? `(${r.representacao})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShareCurrentWhats}
                  disabled={!structure || sharingWhats}
                  className="gap-1.5 text-xs h-9 shadow-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-500/30"
                  title="Compartilhar no WhatsApp com PDF executivo formatado"
                >
                  {sharingWhats ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  ) : (
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span className="hidden sm:inline">Compartilhar Whats</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedRep && handleOpenEdit(selectedRep.id)}
                  disabled={!structure}
                  className="gap-1.5 text-xs h-9 shadow-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Editar</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => selectedRep && handlePromptDelete(selectedRep.id, selectedRep.nome)}
                  disabled={!selectedRep}
                  className="h-9 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Excluir representante"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Botão de Adicionar Novo em Destaque */}
            <Button
              size="sm"
              onClick={() => setNewDialogOpen(true)}
              className="gap-1.5 text-xs h-9 font-semibold shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adicionar Novo</span>
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1700px] w-full mx-auto">
        {/* ========================================================================= */}
        {/* VISUALIZAÇÃO 1: FORMATO DE LISTA (Padrão) */}
        {/* ========================================================================= */}
        {viewMode === "lista" && (
          <RepListView
            reps={reps}
            structures={allStructures}
            onViewPanel={handleViewPanel}
            onEdit={handleOpenEdit}
            onDelete={handlePromptDelete}
            onAddNew={() => setNewDialogOpen(true)}
          />
        )}

        {/* ========================================================================= */}
        {/* VISUALIZAÇÃO 2: FORMATO KANBAN */}
        {/* ========================================================================= */}
        {viewMode === "kanban" && (
          <RepKanbanView
            reps={reps}
            structures={allStructures}
            onViewPanel={handleViewPanel}
            onEdit={handleOpenEdit}
            onDelete={handlePromptDelete}
            onAddNew={() => setNewDialogOpen(true)}
          />
        )}

        {/* ========================================================================= */}
        {/* VISUALIZAÇÃO 3: RADIOGRAFIA / PAINEL EXECUTIVO */}
        {/* ========================================================================= */}
        {viewMode === "painel" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("lista")}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Voltar para Lista de Representações</span>
              </Button>
            </div>

            {/* Identificação Compacta do Representante + KPIs Estratégicos */}
            {structure && (
              <div className="bg-card rounded-xl border p-4 sm:p-5 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b">
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0 border border-primary/20 shadow-2xs">
                      {structure.nome_representante?.slice(0, 2).toUpperCase() || "RP"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                          {structure.nome_representante}
                        </h2>
                        <Badge
                          variant="secondary"
                          className="text-xs font-semibold bg-primary/10 text-primary border-primary/20"
                        >
                          {MODELO_ATUACAO_LABEL[structure.modelo_atuacao] || "Equipe"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        <strong className="text-foreground/90 font-medium">
                          {structure.empresa_representacao || "Representação Comercial"}
                        </strong>
                        {structure.cidade_base && structure.estado_base && (
                          <span> • Base: {structure.cidade_base}/{structure.estado_base}</span>
                        )}
                        {structure.regiao_principal && (
                          <span> • Região: {structure.regiao_principal}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {selectedRep && (selectedRep.email || selectedRep.telefone) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 bg-muted/40 px-3 py-1.5 rounded-lg border">
                      {selectedRep.email && (
                        <span className="font-medium text-foreground/80">{selectedRep.email}</span>
                      )}
                      {selectedRep.email && selectedRep.telefone && <span>•</span>}
                      {selectedRep.telefone && <span>{selectedRep.telefone}</span>}
                    </div>
                  )}
                </div>

                {/* Faixa Horizontal de Marcas Representadas (Logomarcas de ponta a ponta com Detalhes no Hover) */}
                <RepMarcasStrip
                  marcas={structure.marcas_representadas}
                  onAddBrand={handleOpenAddBrand}
                  onEditBrand={handleOpenEditBrand}
                />
              </div>
            )}

            {/* Dashboard Executivo Integrado (4 Quadrantes em 2x2) */}
            {structure ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 min-h-[500px]">
                  <RepBrazilMap
                    estadosAtendidos={structure.estados_atendidos}
                    detalhesMunicipais={structure.detalhes_municipais}
                    diasCampoPorEstado={structure.dias_campo_por_estado}
                    onSelectEstado={() => selectedRep && handleOpenEdit(selectedRep.id, "territorio")}
                  />
                </div>

                <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[500px]">
                  <TreinamentosSection
                    treinamentos={structure.treinamentos}
                    onAddClick={() => {
                      setEditingTraining(null);
                      setTrainingModalOpen(true);
                    }}
                    onEditClick={(item) => {
                      setEditingTraining(item);
                      setTrainingModalOpen(true);
                    }}
                    onDeleteClick={handleDeleteTreinamento}
                  />

                  <FrequenciaVisitasSection
                    clientes={structure.frequencia_visitas}
                    frequenciaDemaisClientes={structure.frequencia_demais_clientes ?? 60}
                    onAddClick={() => {
                      setEditingFreq(null);
                      setFreqModalBatchMode(false);
                      setFreqModalOpen(true);
                    }}
                    onEditClick={(item) => {
                      setEditingFreq(item);
                      setFreqModalBatchMode(false);
                      setFreqModalOpen(true);
                    }}
                    onBatchEditTop10Click={() => {
                      setEditingFreq(null);
                      setFreqModalBatchMode(true);
                      setFreqModalOpen(true);
                    }}
                    onEditDemaisClick={() => {
                      setEditingFreq(null);
                      setFreqModalBatchMode(false);
                      setFreqModalOpen(true);
                    }}
                    onDeleteClick={handleDeleteFrequencia}
                  />
                </div>

                <div className="lg:col-span-5 min-h-[380px]">
                  <EstruturaFisicaSection
                    modeloEscritorio={structure.modelo_escritorio}
                    recursos={structure.recursos_operacionais}
                    observacoes={structure.recursos_operacionais.observacoes}
                  />
                </div>

                <div className="lg:col-span-7 min-h-[380px]">
                  <EquipeOrganogramaSection
                    equipe={structure.equipe}
                    onAddClick={() => selectedRep && handleOpenEdit(selectedRep.id, "equipe")}
                  />
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-card rounded-xl border">
                <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <h3 className="text-base font-semibold">Carregando estrutura do representante...</h3>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Criação de Novo Representante */}
      <NewRepDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onSuccess={handleNewRepSuccess}
      />

      {/* Modal de Edição Completa da Estrutura */}
      {structure && (
        <RepStructureEditorDialog
          open={editorOpen}
          onOpenChange={(open) => {
            setEditorOpen(open);
            if (!open) setEditingRepId(null);
          }}
          structure={structure}
          onSave={handleSaveStructure}
          initialTab={editorInitialTab}
          allStructures={allStructures}
        />
      )}

      {/* Modal Focado de Cadastro e Upload de Logo de Marca Representada */}
      <BrandEditorModal
        open={brandModalOpen}
        onOpenChange={setBrandModalOpen}
        brand={editingBrand}
        onSaveBrand={handleSaveBrand}
        repNome={selectedRep?.nome}
        allStructures={allStructures}
      />

      {/* Modal de Agendamento e Edição de Treinamento */}
      <TreinamentoEditorModal
        open={trainingModalOpen}
        onOpenChange={setTrainingModalOpen}
        treinamento={editingTraining}
        representativeId={selectedRep?.id}
        repNome={selectedRep?.nome || structure?.nome_representante}
        equipe={structure?.equipe}
        structureClients={repStructureClients}
        onSave={handleSaveTreinamento}
      />

      {/* Modal de Edição de Frequência de Visita dos Top 10 Clientes e Demais Clientes */}
      <ClienteFrequenciaModal
        open={freqModalOpen}
        onOpenChange={(open) => {
          setFreqModalOpen(open);
          if (!open) {
            setEditingFreq(null);
            setFreqModalBatchMode(false);
          }
        }}
        cliente={editingFreq}
        posicaoSugerida={(structure?.frequencia_visitas?.length || 0) + 1}
        representativeId={selectedRep?.id}
        repNome={selectedRep?.nome || structure?.nome_representante}
        equipe={structure?.equipe}
        structureClients={repStructureClients}
        frequenciaVisitas={structure?.frequencia_visitas}
        currentFrequenciaDemais={structure?.frequencia_demais_clientes ?? 60}
        initialBatchMode={freqModalBatchMode}
        onSave={handleSaveFrequencia}
      />

      {/* Diálogo de Confirmação de Exclusão */}
      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Excluir Representante e Estrutura
            </DialogTitle>
            <DialogDescription className="text-xs pt-2">
              Tem certeza que deseja excluir o representante{" "}
              <strong className="text-foreground">{pendingDelete?.nome}</strong>? Esta ação
              removerá definitivamente os dados cadastrais e toda a sua estrutura operacional
              (mapa de cobertura territorial, marcas, equipe e recursos).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="gap-1.5 text-xs font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir Definitivamente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
