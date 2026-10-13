import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  MapPin,
  Briefcase,
  Users,
  Network,
  Pencil,
  Map,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Sparkles,
  ArrowRight,
  Printer,
} from "lucide-react";
import { RepBrazilMap } from "@/components/estrutura-rep/RepBrazilMap";
import { RepresentadasSection } from "@/components/estrutura-rep/RepresentadasSection";
import { EstruturaFisicaSection } from "@/components/estrutura-rep/EstruturaFisicaSection";
import { EquipeOrganogramaSection } from "@/components/estrutura-rep/EquipeOrganogramaSection";
import { RepStructureEditorDialog } from "@/components/estrutura-rep/RepStructureEditorDialog";
import {
  loadRepStructure,
  saveRepStructure,
} from "@/lib/estrutura-rep/storage";
import type { RepStructure } from "@/lib/estrutura-rep/types";
import {
  MODELO_ESCRITORIO_LABEL,
  MODELO_ATUACAO_LABEL,
  RECURSOS_CONFIG,
} from "@/lib/estrutura-rep/types";

export const Route = createFileRoute("/_authenticated/estrutura-rep")({
  validateSearch: (search: Record<string, unknown>): { rep?: string } => ({
    rep: typeof search.rep === "string" ? search.rep : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Estrutura Rep — Imersões — PoolFlux" },
      {
        name: "description",
        content: "Painel executivo com a radiografia visual da estrutura completa da empresa de representação comercial.",
      },
    ],
  }),
  component: EstruturaRepPage,
});

function EstruturaRepPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);

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

  // Representante selecionado
  const selectedRepId = search.rep || (reps.length > 0 ? reps[0].id : "");
  const selectedRep = useMemo(
    () => reps.find((r) => r.id === selectedRepId) || reps[0] || null,
    [reps, selectedRepId]
  );

  // 2. Carrega estrutura do representante selecionado
  const {
    data: structure,
    isLoading: loadingStructure,
    refetch: refetchStructure,
  } = useQuery({
    queryKey: ["rep-structure", selectedRep?.id],
    enabled: Boolean(selectedRep?.id),
    queryFn: async () => {
      if (!selectedRep) return null;
      return await loadRepStructure(selectedRep);
    },
  });

  const handleSelectRep = (repId: string) => {
    navigate({
      to: "/estrutura-rep",
      search: { rep: repId },
    });
  };

  const handleSaveStructure = async (updated: RepStructure) => {
    await saveRepStructure(updated);
    await queryClient.invalidateQueries({ queryKey: ["rep-structure", selectedRep?.id] });
    await refetchStructure();
  };

  // KPIs
  const totalEstados = structure?.estados_atendidos?.length || 0;
  const totalMarcas = structure?.marcas_representadas?.length || 0;
  const totalEquipe = structure?.equipe?.length || 0;
  const modeloEscritorio = structure?.modelo_escritorio
    ? MODELO_ESCRITORIO_LABEL[structure.modelo_escritorio]
    : "—";
  const totalRecursosAtivos = structure?.recursos_operacionais
    ? RECURSOS_CONFIG.filter((r) => Boolean(structure.recursos_operacionais[r.key])).length
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-muted/10 pb-12">
      {/* PageHeader do AppShell com Seletor de Representante */}
      <PageHeader
        title="Estrutura Rep"
        subtitle="Radiografia executiva da estrutura e capacidade operacional da representação"
        actions={
          <div className="flex items-center gap-2">
            {/* Seletor de Representante */}
            <div className="w-56 sm:w-64">
              <Select value={selectedRepId} onValueChange={handleSelectRep} disabled={loadingReps || reps.length === 0}>
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

            {/* Botão de Edição */}
            <Button
              size="sm"
              onClick={() => setEditorOpen(true)}
              disabled={!structure}
              className="gap-1.5 text-xs h-9 shadow-xs"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Editar Estrutura</span>
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1700px] w-full mx-auto">
        {/* Identificação Compacta do Representante + KPIs Estratégicos */}
        {structure && (
          <div className="bg-card rounded-xl border p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b">
              {/* Dados Básicos da Identificação */}
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0 border border-primary/20 shadow-2xs">
                  {structure.nome_representante?.slice(0, 2).toUpperCase() || "RP"}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                      {structure.nome_representante}
                    </h2>
                    <Badge variant="secondary" className="text-xs font-semibold bg-primary/10 text-primary border-primary/20">
                      {MODELO_ATUACAO_LABEL[structure.modelo_atuacao] || "Equipe"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    <strong className="text-foreground/90 font-medium">{structure.empresa_representacao || "Representação Comercial"}</strong>
                    {structure.cidade_base && structure.estado_base && (
                      <span> • Base: {structure.cidade_base}/{structure.estado_base}</span>
                    )}
                    {structure.regiao_principal && (
                      <span> • Região: {structure.regiao_principal}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Badges de Contato e Resumo */}
              {selectedRep && (selectedRep.email || selectedRep.telefone) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 bg-muted/40 px-3 py-1.5 rounded-lg border">
                  {selectedRep.email && <span className="font-medium text-foreground/80">{selectedRep.email}</span>}
                  {selectedRep.email && selectedRep.telefone && <span>•</span>}
                  {selectedRep.telefone && <span>{selectedRep.telefone}</span>}
                </div>
              )}
            </div>

            {/* Barra de KPIs Executivos de 10 segundos */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4">
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>Estados Atendidos</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                  {totalEstados} <span className="text-xs font-normal text-muted-foreground">UFs</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                  <span>Representadas</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                  {totalMarcas} <span className="text-xs font-normal text-muted-foreground">Marcas</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>Equipe / Backoffice</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                  {totalEquipe} <span className="text-xs font-normal text-muted-foreground">Integrantes</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span>Modelo de Escritório</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-foreground mt-1 truncate" title={modeloEscritorio}>
                  {modeloEscritorio}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Recursos Ativos</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                  {totalRecursosAtivos}/6 <span className="text-xs font-normal text-muted-foreground">Funções</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Executivo Integrado (4 Quadrantes em 2x2) */}
        {structure ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Quadrante 1 (Área central esquerda): Mapa de Atuação Territorial (5 colunas) */}
            <div className="lg:col-span-5 min-h-[500px]">
              <RepBrazilMap
                estadosAtendidos={structure.estados_atendidos}
                detalhesMunicipais={structure.detalhes_municipais}
                onSelectEstado={() => setEditorOpen(true)}
              />
            </div>

            {/* Quadrante 2 (Área central direita): Marcas e Empresas Representadas (7 colunas) */}
            <div className="lg:col-span-7 min-h-[500px]">
              <RepresentadasSection
                marcas={structure.marcas_representadas}
                onAddClick={() => setEditorOpen(true)}
              />
            </div>

            {/* Quadrante 3 (Área inferior esquerda): Estrutura Física e Operacional (5 colunas) */}
            <div className="lg:col-span-5 min-h-[380px]">
              <EstruturaFisicaSection
                modeloEscritorio={structure.modelo_escritorio}
                recursos={structure.recursos_operacionais}
                observacoes={structure.recursos_operacionais.observacoes}
              />
            </div>

            {/* Quadrante 4 (Área inferior direita): Equipe e Mini Organograma (7 colunas) */}
            <div className="lg:col-span-7 min-h-[380px]">
              <EquipeOrganogramaSection
                equipe={structure.equipe}
                onAddClick={() => setEditorOpen(true)}
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

      {/* Modal / Sheet de Cadastro e Edição */}
      {structure && (
        <RepStructureEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          structure={structure}
          onSave={handleSaveStructure}
        />
      )}
    </div>
  );
}
