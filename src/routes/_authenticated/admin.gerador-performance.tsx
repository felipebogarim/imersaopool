import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx-js-style";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Sparkles, FileDown, ShieldCheck, X, FileSpreadsheet, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  generatePerformanceFromRaw,
  type GeneratedPerformance,
} from "@/lib/generate-performance.functions";
import {
  FAROL_CELL_CLASS,
  FAROL_FAIXA_TEXT,
  FAROL_LABEL,
  catBadge,
  type FarolStatus,
} from "@/lib/performance-farol";
import { exportPerformanceXlsx } from "@/lib/performance-export";

export const Route = createFileRoute("/_authenticated/admin/gerador-performance")({
  head: () => ({ meta: [{ title: "Gerador de Performance — Admin" }] }),
  component: GeradorPerformancePage,
});

type LocalFile = {
  file: File;
  sheets: { sheetName: string; aoa: (string | number | null)[][] }[];
};

async function readWorkbook(file: File): Promise<LocalFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellStyles: true });
  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null }) as (
      | string
      | number
      | null
    )[][];
    return { sheetName: name, aoa };
  });
  return { file, sheets };
}

function GeradorPerformancePage() {
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [periodo, setPeriodo] = useState("");
  const [hint, setHint] = useState("");
  const [representante, setRepresentante] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GeneratedPerformance | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const runFn = useServerFn(generatePerformanceFromRaw);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!list.length) return;
    try {
      const parsed = await Promise.all(list.map(readWorkbook));
      setFiles((prev) => [...prev, ...parsed]);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao ler planilha");
    }
  }

  async function generate() {
    if (!files.length) {
      toast.error("Adicione ao menos uma planilha.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const payload = {
        sheets: files.flatMap((f) =>
          f.sheets.map((s) => ({
            filename: f.file.name,
            sheetName: s.sheetName,
            aoa: s.aoa,
          })),
        ),
        periodoLabel: periodo || null,
        hint: hint || null,
      };
      const res = await runFn({ data: payload });
      setResult(res);
      toast.success(`Performance gerada: ${res.rows.length} clientes, ${res.familias.length} famílias.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao gerar performance");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!result) return;
    const totals = {
      perFamilia: Object.fromEntries(
        result.familias.map((f) => [f, result.rows.reduce((s, r) => s + (Number(r.metas[f]) || 0), 0)]),
      ),
      grand: result.rows.reduce((s, r) => s + (Number(r.total_meta) || 0), 0),
    };
    exportPerformanceXlsx({
      filename: `Performance-${(representante || "gerada").replace(/\s+/g, "_")}.xlsx`,
      representante: representante || "—",
      periodo: periodo || "—",
      familias: result.familias,
      rows: result.rows.map((r) => ({
        razao_social: r.razao_social,
        categoria: r.categoria,
        metas: r.metas,
        metas_status: r.metas_status,
        total_meta: r.total_meta,
      })),
      totals,
    });
  }

  const totalCells = useMemo(() => files.reduce((s, f) => s + f.sheets.reduce((a, sh) => a + sh.aoa.length, 0), 0), [files]);

  return (
    <div>
      <PageHeader
        title="Gerador de Performance"
        subtitle="Faça upload de uma ou mais planilhas brutas — a IA extrai metas, categorias e faróis e gera a planilha padrão de Performance."
      />
      <div className="p-8 space-y-6 max-w-6xl">
        {/* Aviso de privacidade */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-foreground">Seus dados brutos não são publicados nem compartilhados.</div>
            <p className="text-muted-foreground mt-1">
              As planilhas enviadas são usadas <strong>somente</strong> para que a IA extraia metas, percentuais e
              faróis. Nenhum valor de faturamento/realização é armazenado nem exposto — o resultado final contém
              apenas <strong>metas em R$</strong> e <strong>faixas de farol</strong>, exatamente como na área de
              Performance.
            </p>
          </div>
        </div>

        {/* Uploader */}
        <div className="surface rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">1. Planilhas base</div>
              <p className="text-xs text-muted-foreground">
                Você pode enviar várias planilhas — a IA consolidará informações espalhadas entre abas e arquivos.
              </p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={onPick} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Adicionar planilhas
            </Button>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{f.file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {f.sheets.length} aba{f.sheets.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Remover"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{totalCells} linhas totais serão analisadas.</p>
            </div>
          )}
        </div>

        {/* Contexto */}
        <div className="surface rounded-xl p-5 space-y-4">
          <div className="text-sm font-medium">2. Contexto (opcional)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rep">Representante</Label>
              <Input id="rep" value={representante} onChange={(e) => setRepresentante(e.target.value)} placeholder="Ex.: Salton" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="periodo">Período</Label>
              <Input id="periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ex.: 1º Semestre 2026" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hint">Instruções adicionais para a IA</Label>
            <Textarea
              id="hint"
              rows={3}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Ex.: 'Considere apenas a aba METAS'; 'A coluna X é a meta e Y é o realizado'; 'Ignore linhas de subtotal'."
            />
          </div>
          <div>
            <Button onClick={generate} disabled={busy || !files.length}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {busy ? "Analisando com IA…" : "Gerar planilha de performance"}
            </Button>
          </div>
        </div>

        {/* Resultado */}
        {result && (
          <div className="surface rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">3. Resultado</div>
                <p className="text-xs text-muted-foreground">
                  {result.rows.length} clientes · {result.familias.length} famílias
                </p>
              </div>
              <Button variant="outline" onClick={download}>
                <FileDown className="h-4 w-4 mr-1" /> Baixar .xlsx
              </Button>
            </div>

            {result.observacoes && (
              <div className="text-xs text-muted-foreground rounded-lg border border-border p-3 bg-muted/30">
                <strong className="text-foreground">Observações da IA:</strong> {result.observacoes}
              </div>
            )}

            <div className="overflow-auto rounded-lg border border-border">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 sticky left-0 bg-muted/40">Razão social</th>
                    <th className="text-left px-3 py-2">Categoria</th>
                    {result.familias.map((f) => (
                      <th key={f} className="text-center px-3 py-2 whitespace-nowrap">{f}</th>
                    ))}
                    <th className="text-right px-3 py-2">Total meta</th>
                    <th className="text-center px-3 py-2">Total %</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 sticky left-0 bg-background font-medium">{r.razao_social}</td>
                      <td className="px-3 py-2">
                        {r.categoria && (
                          <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] border", catBadge(r.categoria))}>
                            {r.categoria}
                          </span>
                        )}
                      </td>
                      {result.familias.map((f) => {
                        const st = r.metas_status?.[f] as FarolStatus | undefined;
                        return (
                          <td key={f} className={cn("px-2 py-1 text-center tabular-nums", st && FAROL_CELL_CLASS[st])}>
                            {st ? FAROL_FAIXA_TEXT[st] : ""}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.total_meta != null ? r.total_meta.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—"}
                      </td>
                      <td className={cn("px-2 py-1 text-center", r.total_pct_status && FAROL_CELL_CLASS[r.total_pct_status])}>
                        {r.total_pct_status ? FAROL_LABEL[r.total_pct_status] : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
