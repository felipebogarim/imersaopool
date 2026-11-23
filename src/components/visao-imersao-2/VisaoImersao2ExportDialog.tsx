import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Download,
  FileDown,
  FileText,
  Filter,
  Loader2,
  Printer,
  Sparkles,
} from "lucide-react";
import type { ReportListMeta } from "@/lib/visao-imersao-2-list";
import {
  exportVisaoImersao2Markdown,
  exportVisaoImersao2Pdf,
  openVisaoImersao2PrintView,
  type VisaoImersao2ExportItem,
} from "@/lib/visao-imersao-2-export";

interface VisaoImersao2ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowsMeta: Array<{ r: any; meta: ReportListMeta }>;
  filterOptions: {
    representante: string[];
    regiao: string[];
    categoria: string[];
  };
}

export function VisaoImersao2ExportDialog({
  open,
  onOpenChange,
  rowsMeta,
  filterOptions,
}: VisaoImersao2ExportDialogProps) {
  const [format, setFormat] = useState<"pdf" | "markdown">("pdf");
  const [scope, setScope] = useState<"all" | "filter">("filter");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [selectedRegiao, setSelectedRegiao] = useState("");
  const [selectedRep, setSelectedRep] = useState("");
  const [busy, setBusy] = useState(false);

  // Filtra relatórios de acordo com as opções selecionadas
  const selectedReports = useMemo<VisaoImersao2ExportItem[]>(() => {
    if (scope === "all") {
      return rowsMeta.map(({ r, meta }) => ({
        id: r.id,
        client_name: r.client_name,
        visit_date: r.visit_date,
        source_filename: r.source_filename,
        content_markdown: r.content_markdown,
        structured_data: r.structured_data,
        meta,
      }));
    }

    return rowsMeta
      .filter(({ r, meta }) => {
        if (selectedRep && meta.representante !== selectedRep) return false;
        if (selectedRegiao && meta.regiao !== selectedRegiao) return false;

        const visitDate = (r.visit_date || "").slice(0, 10);
        if (dataDe || dataAte) {
          if (!visitDate) return false;
          if (dataDe && visitDate < dataDe) return false;
          if (dataAte && visitDate > dataAte) return false;
        }

        return true;
      })
      .map(({ r, meta }) => ({
        id: r.id,
        client_name: r.client_name,
        visit_date: r.visit_date,
        source_filename: r.source_filename,
        content_markdown: r.content_markdown,
        structured_data: r.structured_data,
        meta,
      }));
  }, [rowsMeta, scope, selectedRep, selectedRegiao, dataDe, dataAte]);

  function limparFiltros() {
    setDataDe("");
    setDataAte("");
    setSelectedRegiao("");
    setSelectedRep("");
  }

  async function handleExport() {
    if (selectedReports.length === 0) {
      toast.error("Nenhum relatório selecionado para exportação.");
      return;
    }

    setBusy(true);
    try {
      if (format === "markdown") {
        await exportVisaoImersao2Markdown(selectedReports);
        toast.success(
          selectedReports.length === 1
            ? "1 relatório exportado como Markdown (.md)."
            : `${selectedReports.length} relatórios exportados em arquivo ZIP (.md).`,
        );
      } else {
        await exportVisaoImersao2Pdf(selectedReports);
        toast.success(
          selectedReports.length === 1
            ? "1 relatório exportado como PDF."
            : `${selectedReports.length} relatórios exportados em PDF consolidado.`,
        );
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar exportação.");
    } finally {
      setBusy(false);
    }
  }

  function handlePrintView() {
    if (selectedReports.length === 0) {
      toast.error("Nenhum relatório selecionado.");
      return;
    }
    openVisaoImersao2PrintView(selectedReports);
    toast.success(`${selectedReports.length} relatório(s) abertos para visualização/impressão.`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" />
            Exportação em Massa — Visão Imersão 2
          </DialogTitle>
          <DialogDescription>
            Exporte os relatórios de diagnóstico comercial em formato PDF ou Markdown (.md).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Formato de exportação */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Formato de Exportação
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                  format === "pdf"
                    ? "border-primary bg-primary/5 text-primary shadow-xs"
                    : "border-border hover:bg-muted/50 text-foreground"
                }`}
              >
                <FileText className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Documento PDF</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Relatório consolidado pronto para impressão e arquivamento.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat("markdown")}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                  format === "markdown"
                    ? "border-primary bg-primary/5 text-primary shadow-xs"
                    : "border-border hover:bg-muted/50 text-foreground"
                }`}
              >
                <FileDown className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Markdown (.md)</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Arquivos originais em Markdown empacotados em ZIP.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Escopo de seleção */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Seleção de Relatórios
              </Label>
              {scope === "filter" && (dataDe || dataAte || selectedRegiao || selectedRep) && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="text-xs text-primary hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={scope === "all" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setScope("all")}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Todos os relatórios ({rowsMeta.length})
              </Button>
              <Button
                type="button"
                variant={scope === "filter" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setScope("filter")}
              >
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Filtrar seleção
              </Button>
            </div>
          </div>

          {/* Painel de Filtros */}
          {scope === "filter" && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              {/* Período */}
              <div>
                <Label className="text-xs font-medium text-foreground">Período da Visita</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-0.5">De</span>
                    <Input
                      type="date"
                      value={dataDe}
                      onChange={(e) => setDataDe(e.target.value)}
                      className="text-xs h-9 bg-background"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-0.5">Até</span>
                    <Input
                      type="date"
                      value={dataAte}
                      onChange={(e) => setDataAte(e.target.value)}
                      className="text-xs h-9 bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Região e Representante */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="text-xs font-medium text-foreground">Região</Label>
                  <select
                    value={selectedRegiao}
                    onChange={(e) => setSelectedRegiao(e.target.value)}
                    className="w-full mt-1.5 h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground"
                  >
                    <option value="">Todas as regiões</option>
                    {filterOptions.regiao.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-medium text-foreground">Representante</Label>
                  <select
                    value={selectedRep}
                    onChange={(e) => setSelectedRep(e.target.value)}
                    className="w-full mt-1.5 h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground"
                  >
                    <option value="">Todos os representantes</option>
                    {filterOptions.representante.map((rep) => (
                      <option key={rep} value={rep}>
                        {rep}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Contador e resumo dos relatórios selecionados */}
          <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">
                Relatórios prontos para exportação:
              </span>
              <Badge variant={selectedReports.length > 0 ? "secondary" : "outline"} className="font-mono">
                {selectedReports.length} de {rowsMeta.length}
              </Badge>
            </div>

            {selectedReports.length > 0 ? (
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1 text-xs text-muted-foreground">
                {selectedReports.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-1 px-2 rounded bg-background/60 border border-border/40 text-[11px]"
                  >
                    <span className="font-medium text-foreground truncate max-w-[240px]">
                      {r.client_name}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {r.visit_date ? r.visit_date.slice(0, 10).split("-").reverse().join("/") : "—"}
                      {r.meta.representante && ` · ${r.meta.representante}`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-1">
                Nenhum relatório encontrado para os filtros selecionados.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>

          {format === "pdf" && selectedReports.length > 0 && (
            <Button
              variant="outline"
              onClick={handlePrintView}
              disabled={busy}
              title="Abre visualização estilizada para imprimir ou salvar como PDF pelo navegador"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Imprimir / PDF Web
            </Button>
          )}

          <Button
            onClick={handleExport}
            disabled={busy || selectedReports.length === 0}
            className="gap-2"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando exportação...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Exportar ({selectedReports.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
