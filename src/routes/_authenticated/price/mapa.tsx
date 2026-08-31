import { useState, useMemo, useEffect, Fragment } from "react";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { 
  BarChart3, 
  Upload, 
  SlidersHorizontal, 
  MoreVertical, 
  Search, 
  Filter, 
  Columns,
  RefreshCw,
  Info,
  ChevronDown,
  LayoutGrid,
  ChevronRight,
  Loader2,
  FileSpreadsheet
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { PERFIS_ANCHORS, PERFIS_COMPETITORS } from "@/lib/price-mapa/mock-data";
import { FAMILIAS_MAPA, PriceTable, BrandAdjustment, MapaCalculatedItem } from "@/lib/price-mapa/types";
import { calculateMapaItem } from "@/lib/price-mapa/calculations";
import { enriquecerProdutos } from "@/lib/price-mapa/dimensions";
import { LEVEL_CLASS, LEVEL_LABEL, STATUS_LABEL, EquivalenceLevel, EquivalenceStatus } from "@/lib/price-comparativos-core";
import { formatBRL } from "@/lib/price-comparativos-core";
import { CenárioSimulador } from "@/components/price/mapa/CenárioSimulador";
import { GraficosMapa } from "@/components/price/mapa/GraficosMapa";
import { ImportadorMapa } from "@/components/price/mapa/ImportadorMapa";
import { getFamilyConfig, labelColunaBase } from "@/lib/price-mapa/family-config";
import { buildTechComparison } from "@/lib/price-mapa/tech-compare";

const techDot: Record<string, string> = {
  verde: "bg-emerald-500",
  amarelo: "bg-amber-500",
  vermelho: "bg-destructive",
  cinza: "bg-muted-foreground/40",
};

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";


export const Route = createFileRoute("/_authenticated/price/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa de Preços | Price — PoolFlux" },
      { name: "description", content: "Inteligência competitiva e análise estratégica de posicionamento de preços." }
    ]
  }),
  component: MapaPrecosPage,
});

function MapaPrecosPage() {
  const [familia, setFamilia] = useState("Perfis");
  const [tabelaBase, setTabelaBase] = useState<PriceTable>("Black Brasil");
  const [busca, setBusca] = useState("");
  const [adjustments, setAdjustments] = useState<BrandAdjustment[]>([]);
  const [isSimuladorOpen, setIsSimuladorOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "charts">("table");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [filterFarol, setFilterFarol] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDimColumns, setShowDimColumns] = useState(false);
  const [noteTarget, setNoteTarget] = useState<any | null>(null);
  const [noteText, setNoteText] = useState("");

  
  // Filtros estruturados
  const [filterBase, setFilterBase] = useState("todos");
  const [filterConcorrente, setFilterConcorrente] = useState("todos");
  const [filterMarca, setFilterMarca] = useState("todos");
  const [filterTecnica, setFilterTecnica] = useState("todos");

  // State for imported data (carregado após hidratação para evitar mismatch SSR)
  const [importedAnchors, setImportedAnchors] = useState<any[]>([]);
  const [importedCompetitors, setImportedCompetitors] = useState<any[]>([]);

  const [isLoadingDados, setIsLoadingDados] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setIsLoadingDados(true);
    (async () => {
      let anchors: any[] = [];
      let competitors: any[] = [];
      try {
        const { data } = await supabase
          .from("price_mapa_dados")
          .select("anchors, competitors")
          .eq("familia", familia)
          .maybeSingle();
        if (data) {
          anchors = (data.anchors as any[]) ?? [];
          competitors = (data.competitors as any[]) ?? [];
        }
      } catch {
        /* segue para o cache local */
      }
      if (!anchors.length && !competitors.length) {
        try {
          const a = localStorage.getItem(`mapa_precos_anchors_${familia}`);
          const c = localStorage.getItem(`mapa_precos_competitors_${familia}`);
          anchors = a ? JSON.parse(a) : [];
          competitors = c ? JSON.parse(c) : [];
        } catch {
          anchors = [];
          competitors = [];
        }
      }
      if (cancelado) return;
      setImportedAnchors(anchors);
      setImportedCompetitors(competitors);
      setIsLoadingDados(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [familia]);


  const familyCfg = getFamilyConfig(familia);
  const baseBrand = familyCfg.baseBrand;

  const hasMapConfigured = (familia === "Perfis") || (importedCompetitors.length > 0);

  const activeAnchors = useMemo(
    () => enriquecerProdutos(importedAnchors.length > 0 ? importedAnchors : PERFIS_ANCHORS),
    [importedAnchors]
  );
  const activeCompetitors = useMemo(
    () => enriquecerProdutos(importedCompetitors.length > 0 ? importedCompetitors : PERFIS_COMPETITORS),
    [importedCompetitors]
  );

  const calculatedItems = useMemo(() => {
    if (!hasMapConfigured) return [];
    return activeCompetitors.map(comp => calculateMapaItem(comp, activeAnchors, adjustments));
  }, [hasMapConfigured, activeCompetitors, activeAnchors, adjustments]);

  const handleImported = (anchors: any[], competitors: any[]) => {
    // Upsert: enriquece registros existentes (inclusive especificações técnicas)
    // sem criar duplicidades e sem sobrescrever preços já importados por vazio.
    const mergeTecnicos = (old: any, novo: any) => {
      const merged = { ...(old?.tecnicos ?? {}), ...(novo?.tecnicos ?? {}) };
      return Object.keys(merged).length ? merged : undefined;
    };
    const mergeRegistro = (old: any, novo: any) => ({
      ...old,
      ...novo,
      preco_base: novo.preco_base ?? old.preco_base,
      preco_normalizado: novo.preco_normalizado ?? old.preco_normalizado,
      price_availability:
        (novo.preco_normalizado ?? old.preco_normalizado) !== null ? "informado" : "nao_informado",
      tecnicos: mergeTecnicos(old, novo),
      notas: old.notas || novo.notas,
    });

    setImportedAnchors(prev => {
      const map = new Map(prev.map((a) => [a.id, a]));
      anchors.forEach((a) => {
        const old = map.get(a.id);
        map.set(a.id, old ? mergeRegistro(old, a) : a);
      });
      return Array.from(map.values());
    });
    setImportedCompetitors(prev => {
      const competitorMap = new Map(prev.map(c => [c.id, c]));
      competitors.forEach(c => {
        const old = competitorMap.get(c.id);
        competitorMap.set(c.id, old
          ? { ...mergeRegistro(old, c), status: old.status ?? c.status }
          : c);
      });
      return Array.from(competitorMap.values());
    });
  };


  const persist = (anchors: any[], competitors: any[]) => {
    try {
      localStorage.setItem(`mapa_precos_anchors_${familia}`, JSON.stringify(anchors));
      localStorage.setItem(`mapa_precos_competitors_${familia}`, JSON.stringify(competitors));
    } catch {
      /* noop */
    }
  };

  const updateCompetitor = (id: string, patch: Record<string, any>) => {
    const next = activeCompetitors.map((c) => (c.id === id ? { ...c, ...patch } : c));
    setImportedCompetitors(next);
    setImportedAnchors(activeAnchors);
    persist(activeAnchors, next);
  };

  const salvarNota = () => {
    if (!noteTarget) return;
    updateCompetitor(noteTarget.id, { notas: noteText });
    toast.success("Nota salva e disponível na exportação Excel.");
    setNoteTarget(null);
    setNoteText("");
  };

  const alterarStatus = (item: any, status: EquivalenceStatus) => {
    updateCompetitor(item.id, { status });
    toast.success(`Status alterado para ${STATUS_LABEL[status]}.`);
  };

  const filteredItems = useMemo(() => {
    let items = calculatedItems;
    
    if (busca.trim()) {
      const t = busca.toLowerCase();
      items = items.filter((item: MapaCalculatedItem) => {
        const base = activeAnchors.find(a => a.id === item.base_product_id);
        const techLabel = item.classificacao_tecnica ? LEVEL_LABEL[item.classificacao_tecnica as EquivalenceLevel] : "";
        const skuBase = base?.sku || "";
        const skuComp = item.sku || item.referencia || "";
        
        return (
          item.marca.toLowerCase().includes(t) || 
          item.nome.toLowerCase().includes(t) ||
          item.referencia?.toLowerCase().includes(t) ||
          skuComp.toLowerCase().includes(t) ||
          base?.nome.toLowerCase().includes(t) ||
          base?.referencia.toLowerCase().includes(t) ||
          skuBase.toLowerCase().includes(t) ||
          techLabel.toLowerCase().includes(t)
        );
      });
    }

    if (filterBase !== "todos") {
      items = items.filter((item) => {
        const base = activeAnchors.find((a) => a.id === item.base_product_id);
        return (base?.nome ?? "").trim() === filterBase;
      });
    }
    if (filterConcorrente !== "todos") {
      items = items.filter((item) => (item.nome ?? "").trim() === filterConcorrente);
    }
    if (filterMarca !== "todos") {
      items = items.filter((item) => (item.marca ?? "").trim() === filterMarca);
    }
    if (filterTecnica !== "todos") {
      items = items.filter((item) => (item.classificacao_tecnica ?? "insuficiente") === filterTecnica);
    }

    if (filterFarol) {
      if (filterFarol === "0%") {
        items = items.filter(item => Math.abs(item.diff_percentual || 0) < 0.1);
      } else {
        items = items.filter(item => item.farol === filterFarol);
      }
    }
    
    return items;
  }, [calculatedItems, busca, filterFarol, activeAnchors, filterBase, filterConcorrente, filterMarca, filterTecnica]);

  const opcoes = useMemo(() => {
    const bases = new Set<string>();
    const concorrentes = new Set<string>();
    const marcas = new Set<string>();
    const tecnicas = new Set<string>();
    calculatedItems.forEach((item) => {
      const base = activeAnchors.find((a) => a.id === item.base_product_id);
      if (base?.nome?.trim()) bases.add(base.nome.trim());
      if (item.nome?.trim()) concorrentes.add(item.nome.trim());
      if (item.marca?.trim()) marcas.add(item.marca.trim());
      tecnicas.add(item.classificacao_tecnica ?? "insuficiente");
    });
    const sorted = (s: Set<string>) => Array.from(s).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return {
      bases: sorted(bases),
      concorrentes: sorted(concorrentes),
      marcas: sorted(marcas),
      tecnicas: sorted(tecnicas),
    };
  }, [calculatedItems, activeAnchors]);

  const filtrosAtivos =
    (filterBase !== "todos" ? 1 : 0) +
    (filterConcorrente !== "todos" ? 1 : 0) +
    (filterMarca !== "todos" ? 1 : 0) +
    (filterTecnica !== "todos" ? 1 : 0) +
    (filterFarol ? 1 : 0);

  const limparFiltros = () => {
    setFilterBase("todos");
    setFilterConcorrente("todos");
    setFilterMarca("todos");
    setFilterTecnica("todos");
    setFilterFarol(null);
    setBusca("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem(`mapa_precos_anchors_${familia}`, JSON.stringify(activeAnchors));
      localStorage.setItem(`mapa_precos_competitors_${familia}`, JSON.stringify(activeCompetitors));
      
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success("Resultados salvos com sucesso no repositório!");
    } catch (error) {
      toast.error("Erro ao salvar resultados.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = async () => {
    if (filteredItems.length === 0) {
      toast.error("Nenhuma comparação para exportar.");
      return;
    }
    const XLSX = await import("xlsx");
    const rows = filteredItems.map((item: MapaCalculatedItem) => {
      const base = activeAnchors.find((a: any) => a.id === item.base_product_id);
      return {
        "Família": familia,
        [`Produto Base ${baseBrand}`]: base?.nome ?? "",
        [`Código ${baseBrand}`]: base?.sku ?? base?.referencia ?? "",
        [`Preço ${baseBrand} (R$)`]: base?.preco_normalizado ?? null,
        [`Dimensão ${baseBrand}`]: base?.dimensao_texto ?? "",
        [`Nicho ${baseBrand}`]: base?.nicho_mm ?? "",
        "Marca Concorrente": item.marca,
        "Modelo Concorrente": item.nome,
        "Referência Concorrente": item.referencia ?? "",
        "Dimensão Concorrente": item.dimensao_texto ?? "",
        "Preço Original (R$)": item.preco_base ?? null,
        "Preço Normalizado por metro (R$)": item.preco_normalizado ?? null,
        "Ajuste Simulado (%)": adjustments.find(a => a.brand === item.marca)?.adjustmentPct ?? 0,
        "Preço Simulado (R$)": item.preco_simulado ?? null,
        "Diferença (R$)": item.diff_absoluta ?? null,
        "Diferença (%)": item.diff_percentual !== null && item.diff_percentual !== undefined
          ? Number(item.diff_percentual.toFixed(1))
          : null,
        "Farol": item.farol,
        "Classificação Técnica": item.classificacao_texto ?? (item.classificacao_tecnica ? LEVEL_LABEL[item.classificacao_tecnica] : ""),
        "Detalhamento Técnico": item.detalhamento_tecnico ?? "",
        "Status": STATUS_LABEL[(item.status ?? "em_analise") as EquivalenceStatus] ?? item.status,
        "Fonte Principal": item.fonte ?? base?.fonte ?? "",
        "Notas": item.notas ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mapa de Preços Completo");
    XLSX.writeFile(wb, `mapa-precos-completo-${familia.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Planilha completa exportada com sucesso.");
  };



  const indicators = useMemo(() => {
    const total = calculatedItems.length;
    const verde = calculatedItems.filter(i => i.farol === "verde").length;
    const amarelo = calculatedItems.filter(i => i.farol === "amarelo").length;
    const vermelho = calculatedItems.filter(i => i.farol === "vermelho").length;
    return { total, verde, amarelo, vermelho };
  }, [calculatedItems]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <CenárioSimulador 
        open={isSimuladorOpen}
        onOpenChange={setIsSimuladorOpen}
        adjustments={adjustments}
        onAdjustmentsChange={setAdjustments}
      />
      <ImportadorMapa 
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        familia={familia}
        onImported={handleImported}
      />

      {/* Breadcrumb / Nav */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest px-1">
        <span>Price</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-white/60">Mapa de Preços</span>
      </div>

      {/* Header com Seletor de Família */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between surface p-4 rounded-xl border border-white/5">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Qual mapa deseja visualizar?</h2>
          <div className="flex items-center gap-3">
            <Select value={familia} onValueChange={setFamilia}>
              <SelectTrigger className="w-[280px] bg-background/50 border-white/10 h-11 text-lg font-light">
                <SelectValue placeholder="Selecione a família" />
              </SelectTrigger>
              <SelectContent>
                {FAMILIAS_MAPA.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="h-7 border-nl-gold/30 text-nl-gold font-light">
              {hasMapConfigured ? `${activeAnchors.length} produtos chave` : "Não configurado"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {importedCompetitors.length > 0 && (
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-9 px-6 animate-pulse"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Salvar Resultado
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="border-white/10 font-light h-9"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2 text-nl-gold" /> Carregar dados
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 font-light h-9"
            onClick={handleExportExcel}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-400" /> Exportar Excel
          </Button>
          
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5 ml-2">
            {[
              { label: "Verde", value: "verde" },
              { label: "Amarelo", value: "amarelo" },
              { label: "Vermelho", value: "vermelho" },
              { label: "0%", value: "0%" }
            ].map((f) => (
              <Button
                key={f.value}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-[10px] uppercase tracking-tighter transition-all",
                  filterFarol === f.value ? "bg-white/10 shadow-sm" : "text-muted-foreground opacity-60"
                )}
                onClick={() => setFilterFarol(filterFarol === f.value ? null : f.value)}
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full mr-1.5", 
                  f.value === "verde" ? "bg-emerald-500" : 
                  f.value === "amarelo" ? "bg-amber-500" : 
                  f.value === "vermelho" ? "bg-destructive" : "bg-white"
                )} />
                {f.label}
              </Button>
            ))}
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            className={cn(
              "border-white/10 font-light h-9 text-nl-gold border-nl-gold/20",
              isSimuladorOpen && "bg-nl-gold/10"
            )}
            onClick={() => setIsSimuladorOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" /> Simular preços
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "h-8 px-3 text-xs font-light tracking-wider uppercase transition-all",
              viewMode === "table" ? "bg-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-white"
            )}
            onClick={() => setViewMode("table")}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-2" /> Tabela
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "h-8 px-3 text-xs font-light tracking-wider uppercase transition-all",
              viewMode === "charts" ? "bg-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-white"
            )}
            onClick={() => setViewMode("charts")}
          >
            <BarChart3 className="h-3.5 w-3.5 mr-2" /> Gráficos
          </Button>
        </div>
        
        {adjustments.length > 0 && (
          <Badge variant="outline" className="border-nl-gold/20 text-nl-gold bg-nl-gold/5 font-light py-1 flex items-center gap-2">
            <RefreshCw className="h-3 w-3 animate-spin-slow" />
            Simulação ativa: {adjustments.length} marcas ajustadas
            <button 
              className="ml-1 hover:text-white transition-colors"
              onClick={() => setAdjustments([])}
            >
              ×
            </button>
          </Badge>
        )}
      </div>


      {!hasMapConfigured ? (
        <div className="flex flex-col items-center justify-center py-20 surface rounded-2xl border border-dashed border-white/10 space-y-4">
          <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-light">Mapa ainda não configurado para esta família</h3>
            <p className="text-muted-foreground font-light max-w-sm mx-auto mt-2">
              Esta família ainda não possui produtos âncora ou concorrentes mapeados para inteligência competitiva.
            </p>
          </div>
          <Button 
            className="bg-nl-gold text-black hover:bg-nl-gold/90 font-medium px-8"
            onClick={() => setIsImportOpen(true)}
          >
            Carregar dados
          </Button>
        </div>
      ) : (
        <>
          {/* Ocultamos blocos de indicadores antigos conforme solicitado */}


          {viewMode === "charts" ? (
            <GraficosMapa items={calculatedItems} anchors={activeAnchors} />
          ) : (
            <>
              {/* Seletor de Tabela e Busca */}
              <div className="flex flex-col lg:flex-row gap-4 lg:items-end justify-between">
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground font-light px-1 uppercase tracking-widest block mb-1">{`Tabela ${baseBrand} considerada`}</span>
                  <div className="flex items-center gap-3">
                    <Select value={tabelaBase} onValueChange={(v: PriceTable) => setTabelaBase(v)}>
                      <SelectTrigger className="w-[200px] h-10 bg-background/50 border-white/10 font-light text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground">
                        <SelectItem value="Black Brasil">Black Brasil</SelectItem>
                        <SelectItem value="Black SP">Black SP</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex flex-col text-[10px] text-muted-foreground">
                      <span>Vigência: Jul/2026</span>
                      <span className="text-emerald-500/80">Atualizada há 3 dias</span>
                    </div>
                  </div>
                </div>

                <div className="relative w-full lg:w-80">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Pesquisar produto, marca, concorrente ou técnica..." 
                    className="pl-9 bg-background/50 border-white/10 h-10 font-light text-foreground placeholder:text-muted-foreground"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
              </div>

              {/* Filtros estruturados */}
              <div className="flex flex-wrap items-end gap-3 surface rounded-xl border border-white/5 p-3">
                {[
                  { label: "Produto chave", value: filterBase, set: setFilterBase, options: opcoes.bases, render: (v: string) => v },
                  { label: "Concorrente", value: filterConcorrente, set: setFilterConcorrente, options: opcoes.concorrentes, render: (v: string) => v },
                  { label: "Marca", value: filterMarca, set: setFilterMarca, options: opcoes.marcas, render: (v: string) => v },
                  {
                    label: "Técnica",
                    value: filterTecnica,
                    set: setFilterTecnica,
                    options: opcoes.tecnicas,
                    render: (v: string) => LEVEL_LABEL[v as EquivalenceLevel] ?? v,
                  },
                ].map((f) => (
                  <div key={f.label} className="space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground block">{f.label}</span>
                    <Select value={f.value} onValueChange={(v) => f.set(v)}>
                      <SelectTrigger className="w-[200px] h-9 bg-background/50 border-white/10 font-light text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground max-h-72">
                        <SelectItem value="todos">Todos</SelectItem>
                        {f.options.map((o) => (
                          <SelectItem key={o} value={o}>{f.render(o)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="flex items-center gap-3 pb-1">
                  <span className="text-[11px] text-muted-foreground font-light">
                    {filteredItems.length} de {calculatedItems.length} comparações
                  </span>
                  {filtrosAtivos > 0 && (
                    <Button variant="ghost" size="sm" className="h-8 text-[11px] text-nl-gold" onClick={limparFiltros}>
                      Limpar filtros ({filtrosAtivos})
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}


          {viewMode === "table" && (
            <div className="surface rounded-2xl border border-white/5 overflow-hidden">
            <div className="flex items-center justify-end gap-2 p-3 border-b border-white/5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 border-white/10 font-light text-[11px]">
                    <Columns className="h-3.5 w-3.5 mr-2 text-nl-gold" /> Colunas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground">
                  <DropdownMenuItem onClick={() => setShowDimColumns(!showDimColumns)}>
                    {showDimColumns ? "Ocultar" : "Exibir"} dimensões e nicho
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="w-8 py-4"></TableHead>
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Produto Base</TableHead>
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">{labelColunaBase(familyCfg)}</TableHead>
                  {showDimColumns && (
                    <>
                      <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">{`Dimensão ${baseBrand}`}</TableHead>
                      <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Nicho</TableHead>
                    </>
                  )}
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Concorrente</TableHead>
                  {showDimColumns && (
                    <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Dimensão Concorrente</TableHead>
                  )}
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Marca</TableHead>
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Preço Concorrente</TableHead>
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4 text-center">{`Diferença ${baseBrand} vs concorrente`}</TableHead>
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Técnica</TableHead>
                  <TableHead className="text-right py-4 pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item, index) => {
                  const base = activeAnchors.find(a => a.id === item.base_product_id);
                  const isEven = index % 2 === 0;
                  const isExpanded = expandedId === item.id;
                  const techRows = isExpanded
                    ? buildTechComparison(familyCfg, base?.tecnicos, item.tecnicos)
                    : [];
                  const colSpan = showDimColumns ? 12 : 9;

                  const farolColors = {
                    verde: "bg-emerald-500/80 text-black border-emerald-500/20",
                    amarelo: "bg-amber-500/80 text-black border-amber-500/20",
                    vermelho: "bg-destructive/80 text-white border-destructive/20",
                    cinza: "bg-muted text-muted-foreground border-transparent"
                  };

                  return (
                    <Fragment key={item.id}>
                    <TableRow 
                      className={cn(
                        "border-b border-border hover:bg-nl-gold/10 transition-colors group",
                        isEven ? "bg-transparent" : "bg-muted/40"
                      )}
                    >
                      <TableCell className="py-5 pl-3 pr-0">
                        <button
                          type="button"
                          aria-label={isExpanded ? "Recolher detalhes" : "Expandir detalhes"}
                          className="text-muted-foreground hover:text-nl-gold transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                        </button>
                      </TableCell>
                      <TableCell className="py-5 border-r border-border/60">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col cursor-default">
                                <span className="font-light text-sm text-foreground">{base?.nome}</span>
                                <span className="text-[10px] text-muted-foreground/80">{base?.sku}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="text-[11px]">
                              <p>Dimensão: {base?.dimensao_texto || "—"}</p>
                              <p>Nicho: {base?.nicho_mm ? `${base.nicho_mm} mm` : "—"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="py-5 border-r border-border/60">
                        <span className="text-sm font-semibold text-foreground">
                          {base?.preco_normalizado !== null && base?.preco_normalizado !== undefined ? formatBRL(base.preco_normalizado) : <span className="text-xs text-muted-foreground italic font-light">Preço não identificado</span>}
                        </span>
                      </TableCell>
                      {showDimColumns && (
                        <>
                          <TableCell className="py-5 border-r border-border/60 text-xs font-light text-muted-foreground">{base?.dimensao_texto || "—"}</TableCell>
                          <TableCell className="py-5 border-r border-border/60 text-xs font-light text-muted-foreground">{base?.nicho_mm ? `${base.nicho_mm} mm` : "—"}</TableCell>
                        </>
                      )}
                      <TableCell className="py-5 border-r border-border/60">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col cursor-default">
                                <span className="font-light text-sm text-foreground">{item.nome}</span>
                                <span className="text-[10px] text-muted-foreground/80">{item.sku}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="text-[11px]">
                              <p>Dimensão concorrente: {item.dimensao_texto || "—"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      {showDimColumns && (
                        <TableCell className="py-5 border-r border-border/60 text-xs font-light text-muted-foreground">{item.dimensao_texto || "—"}</TableCell>
                      )}
                      <TableCell className="py-5 border-r border-border/60">
                        <Badge variant="outline" className="font-light text-[10px] border-white/20 text-foreground/80 uppercase tracking-wider px-2 py-0">
                          {item.marca}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5 border-r border-border/60">
                        <div className="flex flex-col">
                          <span className="text-sm font-light text-foreground">
                            {item.preco_simulado !== null ? formatBRL(item.preco_simulado) : <span className="text-xs text-muted-foreground italic font-light">Preço não identificado</span>}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-5 border-r border-border/60">
                        <div className="flex justify-center h-8 items-center">
                          {item.diff_percentual !== null && (
                            <div className={cn(
                              "w-[65%] h-full flex items-center justify-center rounded-md text-[11px] font-bold shadow-md",
                              farolColors[item.farol as keyof typeof farolColors]
                            )}>
                              {item.diff_percentual > 0 ? "+" : ""}{item.diff_percentual.toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-5 border-r border-border/60">
                        <Badge className={cn("font-light text-[10px] py-0", LEVEL_CLASS[(item.classificacao_tecnica ?? "insuficiente") as EquivalenceLevel])}>
                          {item.classificacao_texto ?? LEVEL_LABEL[(item.classificacao_tecnica ?? "insuficiente") as EquivalenceLevel]}
                        </Badge>
                        {item.detalhamento_tecnico && (
                          <span className="block text-[9px] text-muted-foreground mt-1 italic">{item.detalhamento_tecnico}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-5 text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/60 opacity-60 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground">
                            <DropdownMenuItem onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                              <Info className="h-3.5 w-3.5 mr-2" /> Ver detalhes técnicos
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setNoteTarget(item); setNoteText(item.notas ?? ""); }}>
                              Adicionar / editar nota
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem onClick={() => alterarStatus(item, "validado")}>
                              Marcar como validado
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => alterarStatus(item, "incompativel")}>
                              Marcar como incompatível
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => alterarStatus(item, "em_analise")}>
                              Voltar para em análise
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="border-b border-border bg-nl-gold/[0.03] hover:bg-nl-gold/[0.03]">
                        <TableCell colSpan={colSpan} className="py-5 px-8 space-y-6">
                          <div>
                            <span className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Comparativo técnico</span>
                            {techRows.length === 0 ? (
                              <span className="text-xs font-light text-muted-foreground">Não informado</span>
                            ) : (
                              <div className="overflow-hidden rounded-lg border border-border">
                                <table className="w-full text-xs font-light">
                                  <thead className="bg-muted/50">
                                    <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                      <th className="text-left p-2 font-medium">Característica</th>
                                      <th className="text-left p-2 font-medium">{baseBrand}</th>
                                      <th className="text-left p-2 font-medium">{item.marca || "Concorrente"}</th>
                                      <th className="text-left p-2 font-medium">Análise</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {techRows.map((r, i) => (
                                      <tr key={r.key} className={cn("border-t border-border/60", i % 2 ? "bg-muted/20" : "")}>
                                        <td className="p-2 text-muted-foreground">{r.label}</td>
                                        <td className="p-2 text-foreground">{r.baseTexto}</td>
                                        <td className="p-2 text-foreground">{r.concTexto}</td>
                                        <td className="p-2">
                                          <span className="inline-flex items-center gap-2 text-foreground">
                                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", techDot[r.farol])} />
                                            {r.analise}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs font-light">
                            {familyCfg.mostrarDimensoes && (
                              <>
                                <div>
                                  <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">{`Dimensão ${baseBrand}`}</span>
                                  <span className="text-foreground">{base?.dimensao_texto || "Não informado"}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">{`Nicho ${baseBrand}`}</span>
                                  <span className="text-foreground">{base?.nicho_mm ? `${base.nicho_mm} mm` : "Não informado"}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Dimensão concorrente</span>
                                  <span className="text-foreground">{item.dimensao_texto || "Não informado"}</span>
                                </div>
                              </>
                            )}
                            <div>
                              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Classificação técnica</span>
                              <span className="text-foreground">
                                {item.classificacao_texto ?? LEVEL_LABEL[(item.classificacao_tecnica ?? "insuficiente") as EquivalenceLevel]}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Detalhamento técnico</span>
                              <span className="text-foreground">{item.detalhamento_tecnico || "Não informado"}</span>
                            </div>
                            <div>
                              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Status</span>
                              <span className="text-foreground">{STATUS_LABEL[(item.status ?? "em_analise") as EquivalenceStatus]}</span>
                            </div>
                            <div>
                              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Fonte principal</span>
                              <span className="text-foreground">{item.fonte || base?.fonte || "Não informado"}</span>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Notas</span>
                              <span className="text-foreground">{item.notas || "Não informado"}</span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}

          <Dialog open={!!noteTarget} onOpenChange={(o) => !o && setNoteTarget(null)}>
            <DialogContent className="bg-popover border-border text-popover-foreground">
              <DialogHeader>
                <DialogTitle className="font-light">Nota da comparação</DialogTitle>
                <DialogDescription className="font-light text-muted-foreground">
                  {noteTarget?.marca} — {noteTarget?.nome}. A nota aparece na exportação Excel.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={5}
                placeholder="Registre observações de auditoria, fonte adicional ou ressalvas técnicas..."
                className="bg-background/50 border-white/10 font-light"
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setNoteTarget(null)}>Cancelar</Button>
                <Button className="bg-nl-gold text-black hover:bg-nl-gold/90" onClick={salvarNota}>Salvar nota</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>


          {viewMode === "table" && (
            <div className="flex flex-wrap gap-8 py-4 px-2">
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Farol de Preço</span>
                <div className="flex items-center gap-4 text-[11px] font-light">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>{`${baseBrand} mais barata`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>Até 10% acima</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-destructive" />
                    <span>{">"}10% acima</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


