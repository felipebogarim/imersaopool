import { useState, useRef } from "react";
import { Upload, X, FileSpreadsheet, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { processRawMapaRows, RawMapaRow } from "@/lib/price-mapa/parser/import-logic";
import {
  getFamilyConfig,
  pickField,
  pickByAliases,
  parsePreco,
} from "@/lib/price-mapa/family-config";

/** Só permitimos confirmar quando todos os campos obrigatórios foram identificados. */
function isValidRecord(comp: any, anchors: any[]): boolean {
  const anchor = anchors.find((a) => a.id === comp.base_product_id);
  return Boolean(
    anchor?.nome &&
      anchor?.sku &&
      anchor?.preco_normalizado !== null &&
      anchor?.preco_normalizado !== undefined &&
      comp.preco_normalizado !== null &&
      comp.preco_normalizado !== undefined &&
      comp.marca &&
      comp.classificacao_texto,
  );
}

interface ImportadorMapaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familia: string;
  onImported: (anchors: any[], competitors: any[]) => void;
}

export function ImportadorMapa({ open, onOpenChange, familia, onImported }: ImportadorMapaProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<{ anchors: any[], competitors: any[] } | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [baseBrand, setBaseBrand] = useState<string>(getFamilyConfig(familia).baseBrand);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls")) {
        setFile(selectedFile);
      } else {
        toast.error("Por favor, selecione um arquivo Excel (.xlsx ou .xls)");
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      const sheetName = workbook.SheetNames.find(n => 
        n.toUpperCase().includes("MAPA_PRECOS") || 
        n.toUpperCase().includes("MAPA_PRECOS_PERFIS") ||
        n.toUpperCase().includes("CONCORRENTES")
      ) || workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const cfg = getFamilyConfig(familia);

      const rawRows: RawMapaRow[] = jsonData.map((row: any) => {
        const tecnicos: Record<string, string> = {};
        const tecnicosConc: Record<string, string> = {};
        cfg.camposTecnicos.forEach((c) => {
          const v = pickByAliases(row, c.aliases);
          if (v !== undefined && String(v).trim() !== "") tecnicos[c.label] = String(v).trim();
          const vc = pickByAliases(row, c.aliasesConcorrente ?? []);
          if (vc !== undefined && String(vc).trim() !== "") tecnicosConc[c.label] = String(vc).trim();
        });

        const basePreco = parsePreco(pickField(row, cfg, "basePreco"));
        const concPreco = parsePreco(pickField(row, cfg, "concPreco"));
        const txt = (k: any) => {
          const v = pickField(row, cfg, k);
          return v === undefined ? undefined : String(v).trim();
        };

        return {
          familia: txt("familia") || familia,
          base_brand: cfg.baseBrand,
          base_produto: txt("baseProduto") || "",
          base_codigo: txt("baseCodigo") || "",
          base_descricao: txt("baseDescricao"),
          base_preco: basePreco,
          tecnicos: Object.keys(tecnicos).length ? tecnicos : undefined,
          tecnicos_concorrente: Object.keys(tecnicosConc).length ? tecnicosConc : undefined,
          concorrente_marca: txt("concMarca") || "",
          concorrente_modelo: txt("concModelo") || "",
          concorrente_codigo: txt("concCodigo"),
          concorrente_preco: concPreco,
          classificacao: txt("classificacao") || "",
          status_texto: txt("status"),
          nicho: Number(pickField(row, cfg, "nichoBase")) || undefined,
          largura: Number(pickField(row, cfg, "largura")) || undefined,
          altura: Number(pickField(row, cfg, "altura")) || undefined,
          notas: txt("observacao") || "",
          dimensao_newline: txt("dimensaoBase"),
          nicho_newline: txt("nichoBase"),
          dimensao_concorrente: txt("dimensaoConcorrente"),
          fonte: txt("fonte"),
        } satisfies RawMapaRow;
      });

      const { anchors, competitors } = processRawMapaRows(rawRows);

      if (competitors.length === 0) {
        toast.error("Nenhum registro válido encontrado na planilha.");
        return;
      }

      setBaseBrand(cfg.baseBrand);
      setPreviewData({ anchors, competitors });
      const invalidos = competitors.filter((c) => !isValidRecord(c, anchors)).length;
      if (invalidos > 0) {
        toast.warning(`${invalidos} registro(s) com campos obrigatórios ausentes. Corrija a planilha para confirmar.`);
      }
      setSummary({
        total: rawRows.length,
        imported: competitors.length,
        pricesIdentified: competitors.filter(c => c.preco_normalizado !== null).length,
        pricesMissing: competitors.filter(c => c.preco_normalizado === null).length,
        classificationsIdentified: competitors.filter(c => !!c.classificacao_tecnica).length,
      });
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Falha ao processar o arquivo. Verifique o formato.");
    } finally {
      setIsProcessing(false);
    }
  };

  const invalidCount = previewData
    ? previewData.competitors.filter((c) => !isValidRecord(c, previewData.anchors)).length
    : 0;

  const handleConfirmImport = () => {
    if (invalidCount > 0) {
      toast.error("Existem registros incompletos. Ajuste a planilha antes de confirmar.");
      return;
    }
    if (previewData) {
      onImported(previewData.anchors, previewData.competitors);
      toast.success(`${previewData.competitors.length} comparações da família ${familia} importadas com sucesso!`);
      setShowSummary(true);
      setPreviewData(null);
    }
  };

  const closeAll = () => {
    onOpenChange(false);
    setFile(null);
    setPreviewData(null);
    setShowSummary(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "bg-[#0A0A0A] border-white/10 text-white transition-all",
        previewData ? "sm:max-w-[900px]" : "sm:max-w-[500px]"
      )}>
        <DialogHeader>
          <DialogTitle className="text-xl font-light flex items-center gap-2">
            <Upload className="h-5 w-5 text-nl-gold" />
            {showSummary ? "Relatório de Importação" : previewData ? "Prévia dos Dados" : `Importar Dados: ${familia}`}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-light pt-2">
            {showSummary ? "Resumo detalhado do processamento realizado." : 
             previewData ? "Verifique se os preços e classificações foram identificados corretamente antes de confirmar." : 
             `Carregue uma planilha Excel da família ${familia}. Marca base: ${getFamilyConfig(familia).baseBrand}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {showSummary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Linhas lidas</p>
                  <p className="text-2xl font-light">{summary?.total}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Importadas/Atualizadas</p>
                  <p className="text-2xl font-light text-emerald-500">{summary?.imported}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Preços Identificados</p>
                  <p className="text-2xl font-light text-nl-gold">{summary?.pricesIdentified}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Preços não Identificados</p>
                  <p className="text-2xl font-light text-destructive">{summary?.pricesMissing}</p>
                </div>
              </div>
            </div>
          ) : previewData ? (
            <div className="max-h-[400px] overflow-auto border border-white/5 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="p-3 border-b border-white/5 font-medium text-muted-foreground">Produto Base</th>
                    <th className="p-3 border-b border-white/5 font-medium text-muted-foreground">Concorrente</th>
                    <th className="p-3 border-b border-white/5 font-medium text-muted-foreground">Marca Base</th>
                    <th className="p-3 border-b border-white/5 font-medium text-muted-foreground">Marca</th>
                    <th className="p-3 border-b border-white/5 font-medium text-muted-foreground text-right">{`Preço Base — ${baseBrand}`}</th>
                    <th className="p-3 border-b border-white/5 font-medium text-muted-foreground text-right">Preço Concorrente</th>
                    <th className="p-3 border-b border-white/5 font-medium text-muted-foreground text-center">Técnica</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.competitors.slice(0, 50).map((comp, idx) => {
                    const anchor = previewData.anchors.find(a => a.id === comp.base_product_id);
                    return (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                        <td className={cn("p-3 font-light", !anchor?.nome && "text-destructive italic")}>{anchor?.nome || "Não ident."}
                          <span className="block text-[9px] text-muted-foreground">{anchor?.sku || ""}</span>
                        </td>
                        <td className="p-3 font-light">{comp.nome}</td>
                        <td className="p-3 font-light">{anchor?.marca || baseBrand}</td>
                        <td className={cn("p-3 font-light", !comp.marca && "text-destructive italic")}>{comp.marca || "Não ident."}</td>
                        <td className={cn("p-3 text-right font-medium", !anchor?.preco_normalizado && "text-destructive italic")}>
                          {anchor?.preco_normalizado ? `R$ ${anchor.preco_normalizado.toFixed(2)}` : "Não ident."}
                        </td>
                        <td className={cn("p-3 text-right font-medium", !comp.preco_normalizado && "text-destructive italic")}>
                          {comp.preco_normalizado ? `R$ ${comp.preco_normalizado.toFixed(2)}` : "Não ident."}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className={cn("text-[9px] font-light", !comp.classificacao_texto && "border-destructive/40 text-destructive")}>
                            {comp.classificacao_texto || "Não ident."}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {previewData.competitors.length > 50 && (
                <div className="p-3 text-center text-[10px] text-muted-foreground bg-white/5 italic">
                  Mostrando apenas as primeiras 50 de {previewData.competitors.length} comparações.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {!file ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/10 rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-nl-gold/30 hover:bg-white/5 transition-all group"
                >
                  <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileSpreadsheet className="h-6 w-6 text-muted-foreground group-hover:text-nl-gold" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Clique para selecionar ou arraste</p>
                    <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx, .xls) até 10MB</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-nl-gold/10 flex items-center justify-center">
                      <FileSpreadsheet className="h-5 w-5 text-nl-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setFile(null)}
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx,.xls"
                onChange={handleFileChange}
              />

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                <p className="text-[11px] text-amber-200/80 font-light leading-relaxed">
                  Certifique-se de que a planilha segue o padrão estruturado com as colunas obrigatórias para que os preços e classificações sejam mapeados corretamente.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          {showSummary ? (
            <Button onClick={closeAll} className="bg-nl-gold text-black hover:bg-nl-gold/90 min-w-[120px]">
              Finalizar
            </Button>
          ) : previewData ? (
            <>
              <Button variant="ghost" onClick={() => setPreviewData(null)} className="text-white hover:bg-white/5">
                Voltar
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={invalidCount > 0}
                className="bg-nl-gold text-black hover:bg-nl-gold/90 min-w-[120px] disabled:opacity-40"
              >
                {invalidCount > 0 ? `${invalidCount} registro(s) incompleto(s)` : "Confirmar Importação"}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
                className="text-white hover:bg-white/5"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleUpload}
                disabled={!file || isProcessing}
                className="bg-nl-gold text-black hover:bg-nl-gold/90 min-w-[120px]"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Importar Dados"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
