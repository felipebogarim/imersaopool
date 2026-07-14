import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/representantes/performance")({
  head: () => ({ meta: [{ title: "Performance — Representantes" }] }),
  component: PerformancePage,
});

type ParsedSheet = {
  familias: string[];
  categoriaMetas: Record<string, number>;
  escala: { label: string; min: number | null; max: number | null }[];
  rows: { razao_social: string; categoria: string | null; metas: Record<string, number>; total_meta: number | null; ordem: number }[];
};

/** Parse an "DESEMPENHO ... SEMESTRE" workbook. */
function parseWorkbook(wb: XLSX.WorkBook): ParsedSheet {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Locate header row: contains "GRUPO" or "RAZAO SOCIAL" in col 0 and "CATEGORIA" in col 1
  let headerRow = -1;
  for (let r = 0; r < Math.min(grid.length, 20); r++) {
    const a = String(grid[r]?.[0] ?? "").trim().toUpperCase();
    const b = String(grid[r]?.[1] ?? "").trim().toUpperCase();
    if ((a === "GRUPO" || a.startsWith("RAZAO") || a.startsWith("RAZÃO")) && b === "CATEGORIA") {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) throw new Error("Cabeçalho não encontrado (linha com GRUPO/RAZÃO SOCIAL + CATEGORIA).");

  // Family names live in the row above the header row, starting at col 2
  const famRow = grid[headerRow - 1] ?? [];
  const familias: string[] = [];
  const famCols: number[] = [];
  for (let c = 2; c < famRow.length; c++) {
    const v = famRow[c];
    if (v && String(v).trim()) {
      familias.push(String(v).trim());
      famCols.push(c);
    }
  }
  const totalCol = famCols.length ? famCols[famCols.length - 1] + 1 : 2;

  // Categoria metas + escala live in cols 8/9 and 11 typically. Scan first ~10 rows for pairs.
  const categoriaMetas: Record<string, number> = {};
  const escala: { label: string; min: number | null; max: number | null }[] = [];
  for (let r = 0; r < headerRow; r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length - 1; c++) {
      const key = String(row[c] ?? "").trim();
      const val = row[c + 1];
      if (!key) continue;
      const kU = key.toUpperCase();
      if (["BLACK", "GOLD", "SILVER", "BRONZE", "DIAMOND", "PLATINUM"].includes(kU) && typeof val === "number") {
        categoriaMetas[kU.charAt(0) + kU.slice(1).toLowerCase()] = val;
      }
    }
    // escala free text on any column containing "=" or "%"
    for (const cell of row) {
      const s = String(cell ?? "").trim();
      if (s && /=/.test(s) && /%/.test(s)) {
        const [labelRaw, ruleRaw] = s.split("=");
        escala.push({ label: labelRaw.trim(), ...parseRule(ruleRaw) });
      }
    }
  }

  const rows: ParsedSheet["rows"] = [];
  let ordem = 0;
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const razao = String(row[0] ?? "").trim();
    const categoria = String(row[1] ?? "").trim();
    if (!razao) continue;
    // skip totals row (no categoria + numeric on col 2)
    if (!categoria && typeof row[2] === "number") continue;
    const metas: Record<string, number> = {};
    familias.forEach((f, i) => {
      const v = row[famCols[i]];
      if (typeof v === "number") metas[f] = v;
    });
    const total = typeof row[totalCol] === "number" ? row[totalCol] : null;
    rows.push({ razao_social: razao, categoria: categoria || null, metas, total_meta: total, ordem: ordem++ });
  }

  return { familias, categoriaMetas, escala, rows };
}

function parseRule(s: string): { min: number | null; max: number | null } {
  const nums = Array.from(s.matchAll(/(\d+[.,]?\d*)/g)).map((m) => parseFloat(m[1].replace(",", ".")));
  const lower = s.toLowerCase();
  if (lower.includes("acima")) return { min: nums[0] ?? null, max: null };
  if (lower.includes("abaixo")) return { min: null, max: nums[0] ?? null };
  if (nums.length >= 2) return { min: nums[0], max: nums[1] };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: null, max: null };
}

function PerformancePage() {
  const qc = useQueryClient();
  const [repId, setRepId] = useState<string>("");
  const [uploadId, setUploadId] = useState<string>("");
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgMode, setDlgMode] = useState<"new" | "replace">("new");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [periodoLabel, setPeriodoLabel] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const { data: reps = [] } = useQuery({
    queryKey: ["perf-reps"],
    queryFn: async () => (await supabase.from("representatives").select("id, nome").order("nome")).data ?? [],
  });

  const { data: uploads = [] } = useQuery({
    queryKey: ["perf-uploads", repId],
    enabled: !!repId,
    queryFn: async () =>
      (await supabase
        .from("rep_performance_uploads")
        .select("*")
        .eq("representative_id", repId)
        .order("created_at", { ascending: false })).data ?? [],
  });

  // Auto-select first upload when rep changes
  const currentUpload = useMemo(() => uploads.find((u: any) => u.id === uploadId) ?? uploads[0] ?? null, [uploads, uploadId]);
  const effectiveUploadId = currentUpload?.id ?? "";

  const { data: rows = [] } = useQuery({
    queryKey: ["perf-rows", effectiveUploadId],
    enabled: !!effectiveUploadId,
    queryFn: async () =>
      (await supabase
        .from("rep_performance_rows")
        .select("*")
        .eq("upload_id", effectiveUploadId)
        .order("ordem")).data ?? [],
  });

  function openUpload(mode: "new" | "replace") {
    if (!repId) { toast.error("Selecione um representante primeiro."); return; }
    setDlgMode(mode);
    setPeriodoLabel(mode === "replace" && currentUpload ? currentUpload.periodo_label : "1º Semestre 2026");
    setPeriodoInicio(mode === "replace" && currentUpload?.periodo_inicio ? currentUpload.periodo_inicio : "2026-01-01");
    setPeriodoFim(mode === "replace" && currentUpload?.periodo_fim ? currentUpload.periodo_fim : "2026-06-30");
    setPendingFile(null);
    setDlgOpen(true);
  }

  async function handleUpload() {
    if (!pendingFile) { toast.error("Selecione um arquivo .xlsx"); return; }
    if (!periodoLabel.trim()) { toast.error("Informe o período."); return; }
    setBusy(true);
    try {
      const buf = await pendingFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const parsed = parseWorkbook(wb);
      if (!parsed.rows.length) throw new Error("Nenhuma linha de cliente encontrada na planilha.");

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;

      // Replace mode: delete existing upload (cascade removes rows) with the same period label
      if (dlgMode === "replace" && currentUpload) {
        await supabase.from("rep_performance_uploads").delete().eq("id", currentUpload.id);
      }

      const { data: up, error: upErr } = await supabase
        .from("rep_performance_uploads")
        .insert({
          representative_id: repId,
          periodo_label: periodoLabel.trim(),
          periodo_inicio: periodoInicio || null,
          periodo_fim: periodoFim || null,
          familias: parsed.familias,
          categoria_metas: parsed.categoriaMetas,
          escala_percentual: parsed.escala,
          filename: pendingFile.name,
          uploaded_by: uid,
        } as any)
        .select("id")
        .single();
      if (upErr || !up) throw upErr ?? new Error("Falha ao criar upload");

      const rowsPayload = parsed.rows.map((r) => ({
        upload_id: up.id,
        ordem: r.ordem,
        razao_social: r.razao_social,
        categoria: r.categoria,
        metas: r.metas,
        total_meta: r.total_meta,
      }));
      // insert in chunks of 200
      for (let i = 0; i < rowsPayload.length; i += 200) {
        const chunk = rowsPayload.slice(i, i + 200);
        const { error } = await supabase.from("rep_performance_rows").insert(chunk as any);
        if (error) throw error;
      }

      toast.success(`Planilha importada: ${parsed.rows.length} clientes.`);
      setDlgOpen(false);
      qc.invalidateQueries({ queryKey: ["perf-uploads", repId] });
      setUploadId(up.id);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao importar planilha.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!currentUpload) return;
    if (!confirm(`Excluir a versão "${currentUpload.periodo_label}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("rep_performance_uploads").delete().eq("id", currentUpload.id);
    if (error) return toast.error(error.message);
    toast.success("Versão excluída.");
    setUploadId("");
    qc.invalidateQueries({ queryKey: ["perf-uploads", repId] });
  }

  const familias: string[] = currentUpload?.familias ?? [];
  const categoriaMetas: Record<string, number> = currentUpload?.categoria_metas ?? {};
  const escala: { label: string; min: number | null; max: number | null }[] = currentUpload?.escala_percentual ?? [];

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    let grand = 0;
    for (const r of rows as any[]) {
      for (const f of familias) t[f] = (t[f] ?? 0) + (Number(r.metas?.[f]) || 0);
      grand += Number(r.total_meta) || 0;
    }
    return { perFamilia: t, grand };
  }, [rows, familias]);

  const fmt = (n: number | null | undefined) =>
    n == null || Number.isNaN(n) ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div>
      <PageHeader
        title="Performance"
        subtitle="Metas e desempenho por família de produto"
        actions={
          <>
            <Button variant="outline" onClick={() => openUpload("replace")} disabled={!currentUpload}>
              <RefreshCw className="h-4 w-4 mr-1" /> Substituir versão
            </Button>
            <Button onClick={() => openUpload("new")}>
              <Upload className="h-4 w-4 mr-1" /> Nova planilha
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-8 space-y-6">
        {/* Filters */}
        <div className="surface rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Representante</Label>
            <Select value={repId} onValueChange={(v) => { setRepId(v); setUploadId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione um representante" /></SelectTrigger>
              <SelectContent>
                {reps.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Período</Label>
            <Select value={effectiveUploadId} onValueChange={setUploadId} disabled={!uploads.length}>
              <SelectTrigger><SelectValue placeholder={uploads.length ? "Selecione um período" : "Nenhuma planilha importada"} /></SelectTrigger>
              <SelectContent>
                {uploads.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.periodo_label} {u.filename ? `— ${u.filename}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            {currentUpload && (
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Excluir esta versão
              </Button>
            )}
          </div>
        </div>

        {/* Legenda (categorias + escala) */}
        {currentUpload && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Categoria × Meta</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {Object.entries(categoriaMetas).map(([k, v]) => (
                  <div key={k} className="flex flex-col rounded border border-border p-2">
                    <span className="font-medium">{k}</span>
                    <span className="text-muted-foreground">{fmt(v)}</span>
                  </div>
                ))}
                {!Object.keys(categoriaMetas).length && <span className="text-muted-foreground text-sm">—</span>}
              </div>
            </div>
            <div className="surface rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Escala de desempenho</p>
              <ul className="text-sm space-y-1">
                {escala.map((e, i) => (<li key={i} className="text-muted-foreground"><span className="font-medium text-foreground">{e.label}</span> — {formatEscala(e)}</li>))}
                {!escala.length && <li className="text-muted-foreground">—</li>}
              </ul>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="surface rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-3 sticky left-0 bg-muted/40">Razão Social</th>
                  <th className="text-left px-3 py-3">Categoria</th>
                  {familias.map((f) => <th key={f} className="text-right px-3 py-3 whitespace-nowrap">{f}</th>)}
                  <th className="text-right px-3 py-3">Total Meta</th>
                </tr>
              </thead>
              <tbody>
                {!currentUpload ? (
                  <tr><td colSpan={3 + familias.length} className="px-4 py-12 text-center text-muted-foreground">
                    {repId ? "Nenhuma planilha importada para este representante. Clique em \"Nova planilha\"." : "Selecione um representante."}
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={3 + familias.length} className="px-4 py-12 text-center text-muted-foreground">Carregando…</td></tr>
                ) : (
                  <>
                    {rows.map((r: any) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-3 py-2 font-medium sticky left-0 bg-background">{r.razao_social}</td>
                        <td className="px-3 py-2">
                          <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs border", catBadge(r.categoria))}>{r.categoria ?? "—"}</span>
                        </td>
                        {familias.map((f) => (<td key={f} className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmt(Number(r.metas?.[f]))}</td>))}
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(Number(r.total_meta))}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="px-3 py-3 sticky left-0 bg-muted/30">TOTAL</td>
                      <td className="px-3 py-3"></td>
                      {familias.map((f) => (<td key={f} className="px-3 py-3 text-right tabular-nums">{fmt(totals.perFamilia[f])}</td>))}
                      <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.grand)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlgMode === "replace" ? "Substituir versão atual" : "Nova planilha de performance"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rótulo do período</Label>
              <Input value={periodoLabel} onChange={(e) => setPeriodoLabel(e.target.value)} placeholder="Ex.: 1º Semestre 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} /></div>
              <div><Label>Fim</Label><Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} /></div>
            </div>
            <div>
              <Label>Planilha (.xlsx)</Label>
              <Input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground mt-1">
                Estrutura esperada: cabeçalho com "GRUPO/RAZÃO SOCIAL", "CATEGORIA", famílias nas colunas seguintes e coluna final "Total R$ META".
              </p>
            </div>
            <Button className="w-full" onClick={handleUpload} disabled={busy}>
              {busy ? "Importando…" : dlgMode === "replace" ? "Substituir versão" : "Importar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatEscala(e: { min: number | null; max: number | null }): string {
  if (e.min == null && e.max != null) return `abaixo de ${e.max}%`;
  if (e.min != null && e.max == null) return `acima de ${e.min}%`;
  if (e.min != null && e.max != null && e.min === e.max) return `${e.min}%`;
  if (e.min != null && e.max != null) return `${e.min}% a ${e.max}%`;
  return "—";
}

function catBadge(c: string | null): string {
  const k = (c ?? "").toLowerCase();
  if (k === "black") return "bg-foreground/10 text-foreground border-foreground/30";
  if (k === "gold") return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
  if (k === "silver") return "bg-muted text-muted-foreground border-border";
  return "bg-muted text-muted-foreground border-border";
}
