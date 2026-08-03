import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  parseComparativoWorkbook,
  type ParseResult,
} from "@/lib/price-comparativos-parser";
import {
  importParseResult,
  type ImportConflictMode,
  type ImportReport,
} from "@/lib/price-comparativos-data";
import { CATEGORIAS, FAMILIAS, formatSpec } from "@/lib/price-comparativos-core";

type Etapa = "envio" | "previa" | "relatorio";

export function ImportarDadosDialog({
  open,
  onOpenChange,
  podeEditar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const [etapa, setEtapa] = useState<Etapa>("envio");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [familia, setFamilia] = useState("Fitas e Fontes");
  const [categoria, setCategoria] = useState("Fitas LED");
  const [conflito, setConflito] = useState<ImportConflictMode>("atualizar");
  const [progresso, setProgresso] = useState(0);
  const [mensagem, setMensagem] = useState("");
  const [importando, setImportando] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  function reset() {
    setEtapa("envio");
    setFile(null);
    setParsed(null);
    setProgresso(0);
    setMensagem("");
    setReport(null);
    setImportando(false);
  }

  async function handleFile(f: File) {
    setFile(f);
    try {
      const buf = await f.arrayBuffer();
      const result = parseComparativoWorkbook(buf);
      setParsed(result);
      setEtapa("previa");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function confirmar() {
    if (!parsed || !file) return;
    setImportando(true);
    try {
      const r = await importParseResult(parsed, {
        fileName: file.name,
        familia,
        categoria,
        conflito,
        onProgress: (p, m) => {
          setProgresso(p);
          setMensagem(m);
        },
      });
      setReport(r);
      setEtapa("relatorio");
      qc.invalidateQueries({ queryKey: ["price-comparativos"] });
      toast.success("Importação concluída");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImportando(false);
    }
  }

  function baixarRelatorio() {
    if (!report) return;
    const linhas = [
      ["Arquivos processados", report.arquivos],
      ["Linhas lidas", report.linhasLidas],
      ["Linhas ignoradas", report.linhasIgnoradas],
      ["Produtos criados", report.produtosCriados],
      ["Produtos atualizados", report.produtosAtualizados],
      ["Preços importados", report.precosImportados],
      ["Duplicidades", report.duplicidades],
      ["Equivalências geradas", report.equivalenciasGeradas],
      ["Dados incompletos", report.dadosIncompletos],
      ["Erros", report.erros.length],
    ];
    const csv = linhas.map((l) => l.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-importacao-comparativos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const previewLinhas = parsed?.linhas.slice(0, 8) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar dados</DialogTitle>
          <DialogDescription>
            Envie a planilha comparativa. Os valores originais são preservados e nenhum registro é
            substituído automaticamente.
          </DialogDescription>
        </DialogHeader>

        {!podeEditar && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
            <span>
              Somente o perfil gestormaster pode gravar dados importados. Você pode visualizar a
              prévia, mas a importação será recusada pelo banco.
            </span>
          </div>
        )}

        {etapa === "envio" && (
          <div className="space-y-4">
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-10 text-center cursor-pointer hover:border-primary/50 transition"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void handleFile(f);
              }}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Arraste a planilha ou clique para escolher</span>
              <span className="text-xs text-muted-foreground">
                Formatos aceitos nesta etapa: XLSX, XLS e CSV
              </span>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.xlsm,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              A leitura de PDF e de imagens com OCR será liberada em uma etapa seguinte.
            </p>
          </div>
        )}

        {etapa === "previa" && parsed && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{file?.name}</span>
              <Badge variant="outline">Aba {parsed.sheetName}</Badge>
              <Badge variant="outline">{parsed.linhas.length} linhas</Badge>
              <Badge variant="outline">Marca base: {parsed.marcaBase}</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              {parsed.marcasConcorrentes.map((m) => (
                <Badge key={m} variant="secondary">
                  {m}
                </Badge>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Família</Label>
                <Select value={familia} onValueChange={setFamilia}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FAMILIAS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(CATEGORIAS[familia] ?? ["Geral"]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Em caso de conflito</Label>
                <Select
                  value={conflito}
                  onValueChange={(v) => setConflito(v as ImportConflictMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atualizar">Atualizar registro existente</SelectItem>
                    <SelectItem value="ignorar">Ignorar</SelectItem>
                    <SelectItem value="revisao">Enviar para revisão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tensão</TableHead>
                    <TableHead>Potência/m</TableHead>
                    <TableHead>Fluxo/m</TableHead>
                    <TableHead>CCT</TableHead>
                    <TableHead>Equivalentes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewLinhas.map((l) => (
                    <TableRow key={l.linha}>
                      <TableCell className="font-mono text-xs">{l.base.sku ?? "—"}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs">
                        {l.base.descricao ?? l.base.nome}
                      </TableCell>
                      <TableCell className="text-xs">{formatSpec(l.base.specs["tensao"])}</TableCell>
                      <TableCell className="text-xs">
                        {formatSpec(l.base.specs["potencia_m"])}
                      </TableCell>
                      <TableCell className="text-xs">{formatSpec(l.base.specs["fluxo_m"])}</TableCell>
                      <TableCell className="text-xs">{formatSpec(l.base.specs["cct"])}</TableCell>
                      <TableCell className="text-xs">{l.concorrentes.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {importando && (
              <div className="space-y-1">
                <Progress value={progresso} />
                <p className="text-xs text-muted-foreground">{mensagem}</p>
              </div>
            )}
          </div>
        )}

        {etapa === "relatorio" && report && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Relatório de importação
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["Linhas lidas", report.linhasLidas],
                ["Linhas ignoradas", report.linhasIgnoradas],
                ["Produtos criados", report.produtosCriados],
                ["Produtos atualizados", report.produtosAtualizados],
                ["Preços importados", report.precosImportados],
                ["Duplicidades", report.duplicidades],
                ["Equivalências geradas", report.equivalenciasGeradas],
                ["Dados incompletos", report.dadosIncompletos],
                ["Erros", report.erros.length],
              ].map(([label, valor]) => (
                <div key={label as string} className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-lg font-semibold">{valor as number}</div>
                </div>
              ))}
            </div>
            {report.erros.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1 max-h-40 overflow-y-auto">
                {report.erros.slice(0, 20).map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {etapa === "previa" && (
            <>
              <Button variant="outline" onClick={reset} disabled={importando}>
                Trocar arquivo
              </Button>
              <Button onClick={confirmar} disabled={importando || !podeEditar}>
                {importando ? "Importando…" : "Importar"}
              </Button>
            </>
          )}
          {etapa === "relatorio" && (
            <>
              <Button variant="outline" onClick={baixarRelatorio}>
                <Download className="h-4 w-4 mr-1" /> Baixar relatório
              </Button>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
