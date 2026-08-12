import { useState, useMemo } from "react";
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
import { FAMILIAS_MAPA, PriceTable, BrandAdjustment } from "@/lib/price-mapa/types";
import { calculateMapaItem } from "@/lib/price-mapa/calculations";
import { LEVEL_CLASS, LEVEL_LABEL } from "@/lib/price-comparativos-core";
import { formatBRL } from "@/lib/price-comparativos-core";
import { CenárioSimulador } from "@/components/price/mapa/CenárioSimulador";
import { GraficosMapa } from "@/components/price/mapa/GraficosMapa";
import { ImportadorMapa } from "@/components/price/mapa/ImportadorMapa";


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

  
  // State for imported data
  const [importedAnchors, setImportedAnchors] = useState<any[]>([]);
  const [importedCompetitors, setImportedCompetitors] = useState<any[]>([]);
  
  const hasMapConfigured = (familia === "Perfis") || (importedCompetitors.length > 0);

  const activeAnchors = importedAnchors.length > 0 ? importedAnchors : PERFIS_ANCHORS;
  const activeCompetitors = importedCompetitors.length > 0 ? importedCompetitors : PERFIS_COMPETITORS;

  const calculatedItems = useMemo(() => {
    if (!hasMapConfigured) return [];
    return activeCompetitors.map(comp => calculateMapaItem(comp, activeAnchors, adjustments));
  }, [hasMapConfigured, activeCompetitors, activeAnchors, adjustments]);

  const handleImported = (anchors: any[], competitors: any[]) => {
    setImportedAnchors(anchors);
    setImportedCompetitors(competitors);
  };

  const filteredItems = useMemo(() => {
    let items = calculatedItems;
    
    if (busca.trim()) {
      const t = busca.toLowerCase();
      items = items.filter(item => 
        item.marca.toLowerCase().includes(t) || 
        item.nome.toLowerCase().includes(t) ||
        item.referencia?.toLowerCase().includes(t)
      );
    }

    if (filterFarol) {
      if (filterFarol === "0%") {
        // Filtro para quando a diferença é nula (0%)
        items = items.filter(item => Math.abs(item.diff_percentual || 0) < 0.1);
      } else {
        items = items.filter(item => item.farol === filterFarol);
      }
    }
    
    return items;
  }, [calculatedItems, busca, filterFarol]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulação de salvamento
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("Resultados salvos com sucesso no repositório!");
    } catch (error) {
      toast.error("Erro ao salvar resultados.");
    } finally {
      setIsSaving(false);
    }
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
              viewMode === "table" ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white"
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
              viewMode === "charts" ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white"
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
                  <span className="text-xs text-muted-foreground font-light px-1 uppercase tracking-widest block mb-1">Tabela Newline considerada</span>
                  <div className="flex items-center gap-3">
                    <Select value={tabelaBase} onValueChange={(v: PriceTable) => setTabelaBase(v)}>
                      <SelectTrigger className="w-[200px] h-10 bg-background/50 border-white/10 font-light text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0A0A0A] border-white/10 text-white">
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
                    placeholder="Pesquisar marca ou produto..." 
                    className="pl-9 bg-background/50 border-white/10 h-10 font-light text-white"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}


          {viewMode === "table" && (
            <div className="surface rounded-2xl border border-white/5 overflow-hidden">

            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Produto Base</TableHead>
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Newline (R$/m)</TableHead>
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Concorrente</TableHead>
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Marca</TableHead>
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Preço Concorrente</TableHead>
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4 text-center">Diferença Newline vs concorrente</TableHead>
                  <TableHead className="text-[10px] uppercase font-medium text-muted-foreground py-4">Técnica</TableHead>
                  <TableHead className="text-right py-4 pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item, index) => {
                  const base = activeAnchors.find(a => a.id === item.base_product_id);
                  const isEven = index % 2 === 0;
                  const farolColors = {
                    verde: "bg-emerald-500 text-black border-emerald-500/20",
                    amarelo: "bg-amber-500 text-black border-amber-500/20",
                    vermelho: "bg-destructive text-white border-destructive/20",
                    cinza: "bg-muted text-muted-foreground border-transparent"
                  };

                  return (
                    <TableRow 
                      key={item.id} 
                      className={cn(
                        "border-white/5 hover:bg-nl-gold/5 transition-colors group",
                        isEven ? "bg-transparent" : "bg-white/[0.03]"
                      )}
                    >
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-light text-sm">{base?.nome}</span>
                          <span className="text-[10px] text-muted-foreground">{base?.sku}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-sm font-semibold text-nl-gold brightness-90">{formatBRL(base?.preco_normalizado ?? 0)}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-light text-sm">{item.nome}</span>
                          <span className="text-[10px] text-muted-foreground">{item.sku}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="font-light text-[10px] border-white/10 uppercase tracking-wider px-2 py-0">
                          {item.marca}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-light">
                            {formatBRL(item.preco_simulado ?? 0)}
                          </span>
                          {item.preco_simulado !== item.preco_normalizado && (
                            <span className="text-[9px] text-muted-foreground line-through">
                              {formatBRL(item.preco_normalizado ?? 0)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={cn("py-4 text-center font-medium", farolColors[item.farol || "cinza"])}>
                        <span className="text-xs uppercase tracking-wider">
                          {item.diff_percentual !== null ? `${item.diff_percentual > 0 ? "+" : ""}${item.diff_percentual.toFixed(1)}%` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge className={cn("font-light text-[10px] py-0", LEVEL_CLASS[item.classificacao_tecnica ?? "insuficiente"])}>
                          {LEVEL_LABEL[item.classificacao_tecnica ?? "insuficiente"]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-right pr-6">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}

          {viewMode === "table" && (
            <div className="flex flex-wrap gap-8 py-4 px-2">
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Farol de Preço</span>
                <div className="flex items-center gap-4 text-[11px] font-light">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Newline mais barata</span>
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


