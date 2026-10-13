import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  importTablePrices,
  parseTablePriceFile,
  type TableForImport,
  type TablePriceImportReport,
  type TablePriceParse,
} from "@/lib/price-table-import";

export function ImportarPrecosTabelaDialog({
  table,
  onClose,
}: {
  table: TableForImport | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<TablePriceParse | null>(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<TablePriceImportReport | null>(null);

  function close() {
    if (busy) return;
    setFile(null);
    setParsed(null);
    setReport(null);
    setCreateMissing(false);
    onClose();
  }

  async function onFile(f: File | undefined) {
    setFile(f ?? null);
    setParsed(null);
    setReport(null);
    if (!f) return;
    try {
      setParsed(parseTablePriceFile(await f.arrayBuffer()));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function run() {
    if (!table || !parsed) return;
    setBusy(true);
    try {
      const r = await importTablePrices(table, parsed.rows, {
        createMissing,
        fileName: file?.name ?? null,
      });
      setReport(r);
      qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("price") });
      toast.success("Importação concluída");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!table} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar preços — {table?.titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Planilha (xlsx/csv) com colunas Código e Preço; opcionais: Preço por metro, Unidade,
            Descrição. Todos os preços ficam vinculados a esta tabela; reimportar atualiza.
          </p>
          <div>
            <Label>Arquivo</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
          {parsed && (
            <p>
              {parsed.rows.length} linha(s) lida(s).
              {parsed.avisos.map((a) => (
                <span key={a} className="block text-amber-600">
                  {a}
                </span>
              ))}
            </p>
          )}
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={createMissing}
              onChange={(e) => setCreateMissing(e.target.checked)}
            />
            Criar produto (dados mínimos) quando o código não existir
          </label>
          {report && (
            <ul className="rounded-md border p-3 text-xs space-y-0.5">
              <li>Linhas lidas: {report.linhasLidas}</li>
              <li>Preços criados: {report.precosCriados}</li>
              <li>Preços atualizados: {report.precosAtualizados}</li>
              <li>Produtos criados: {report.produtosCriados}</li>
              <li>
                Produtos não encontrados: {report.naoEncontrados.length}
                {report.naoEncontrados.length > 0 &&
                  ` (${report.naoEncontrados.slice(0, 20).join(", ")})`}
              </li>
              <li>Erros: {report.erros.length}</li>
              {report.erros.slice(0, 10).map((e) => (
                <li key={e} className="text-destructive">
                  {e}
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={close}>
              Fechar
            </Button>
            <Button disabled={busy || !parsed || parsed.rows.length === 0} onClick={run}>
              {busy ? "Importando…" : "Importar preços"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
