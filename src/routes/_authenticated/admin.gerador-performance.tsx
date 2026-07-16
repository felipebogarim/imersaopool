import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx-js-style";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  Sparkles,
  FileDown,
  ShieldCheck,
  X,
  FileSpreadsheet,
  Loader2,
  Send,
  Save,
  MoreVertical,
  FolderOpen,
  Trash2,
  FileText,
} from "lucide-react";
import { PeriodoPicker, type PeriodoValue } from "@/components/PeriodoPicker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  generatePerformanceFromRaw,
  type GeneratedPerformance,
} from "@/lib/generate-performance.functions";
import {
  FAROL_CELL_CLASS,
  FAROL_FAIXA_TEXT,
  FAROL_MIDPOINT,
  catBadge,
  type FarolStatus,
} from "@/lib/performance-farol";
import { exportPerformanceXlsx } from "@/lib/performance-export";
import { exportPerformancePdf } from "@/lib/performance-pdf";


const fmtBRL = (n: number | null | undefined) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtPct = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  const v = Math.abs(n) <= 1.5 ? n * 100 : n;
  return `${v.toFixed(1).replace(".", ",")}%`;
};

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
  const [periodoObj, setPeriodoObj] = useState<PeriodoValue>({ label: `1º Semestre ${new Date().getFullYear()}`, inicio: `${new Date().getFullYear()}-01-01`, fim: `${new Date().getFullYear()}-06-30` });
  const periodo = periodoObj.label;
  const [hint, setHint] = useState("");
  const [representante, setRepresentante] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GeneratedPerformance | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendRepId, setSendRepId] = useState("");
  const [sendPeriodoObj, setSendPeriodoObj] = useState<PeriodoValue>({ label: `1º Semestre ${new Date().getFullYear()}`, inicio: `${new Date().getFullYear()}-01-01`, fim: `${new Date().getFullYear()}-06-30` });
  const sendPeriodoLabel = sendPeriodoObj.label;
  const sendPeriodoInicio = sendPeriodoObj.inicio;
  const sendPeriodoFim = sendPeriodoObj.fim;
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const runFn = useServerFn(generatePerformanceFromRaw);
  const qc = useQueryClient();

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveNome, setSaveNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: reps = [] } = useQuery({
    queryKey: ["gerador-perf-reps"],
    queryFn: async () =>
      (await supabase.from("representatives").select("id, nome").order("nome")).data ?? [],
  });

  const { data: salvos = [], isLoading: loadingSalvos } = useQuery({
    queryKey: ["gerador-perf-salvos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gerador_performance_salvos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });




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
    if (!representante) {
      toast.error("Selecione o representante.");
      return;
    }
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

  const derived = useMemo(() => {
    if (!result) return null;
    const perFamilia = Object.fromEntries(
      result.familias.map((f) => [f, result.rows.reduce((s, r) => s + (Number(r.metas[f]) || 0), 0)]),
    ) as Record<string, number>;
    const grand = result.rows.reduce((s, r) => {
      const t =
        Number(r.total_meta) ||
        result.familias.reduce((a, f) => a + (Number(r.metas?.[f]) || 0), 0);
      return s + t;
    }, 0);
    const participacao: { __total__: number | null } & Record<string, number | null> = {
      __total__: grand > 0 ? 100 : null,
    };
    for (const f of result.familias) {
      participacao[f] = grand > 0 ? (perFamilia[f] / grand) * 100 : null;
    }
    // Atingimento estimado (%) — média dos midpoints da faixa ponderada pela meta.
    // Se a meta por família for 0 (comum quando a IA só extrai farol), usa média simples.
    const atingimento: { __total__: number | null } & Record<string, number | null> = {
      __total__: null,
    };
    for (const f of result.familias) {
      let num = 0;
      let den = 0;
      let simpleSum = 0;
      let simpleN = 0;
      for (const r of result.rows) {
        const st = r.metas_status?.[f];
        if (!st) continue;
        const w = Number(r.metas?.[f]) || 0;
        num += FAROL_MIDPOINT[st] * w;
        den += w;
        simpleSum += FAROL_MIDPOINT[st];
        simpleN += 1;
      }
      atingimento[f] = den > 0 ? num / den : simpleN > 0 ? simpleSum / simpleN : null;
    }
    // Total: pondera pelo total_meta de cada cliente e status total_pct_status.
    let tnum = 0;
    let tden = 0;
    let tSum = 0;
    let tN = 0;
    for (const r of result.rows) {
      const st = r.total_pct_status;
      if (!st) continue;
      const w =
        Number(r.total_meta) ||
        result.familias.reduce((a, f) => a + (Number(r.metas?.[f]) || 0), 0);
      tnum += FAROL_MIDPOINT[st] * w;
      tden += w;
      tSum += FAROL_MIDPOINT[st];
      tN += 1;
    }
    atingimento.__total__ = tden > 0 ? tnum / tden : tN > 0 ? tSum / tN : null;
    return { perFamilia, grand, participacao, atingimento };
  }, [result]);

  function download() {
    if (!result || !derived) return;
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
        total_pct_status: r.total_pct_status,
      })),
      totals: { perFamilia: derived.perFamilia, grand: derived.grand },
      participacao: derived.participacao,
      atingimento: derived.atingimento,
    });
  }

  function downloadPdf() {
    if (!result || !derived) return;
    exportPerformancePdf({
      filename: `Performance-${(representante || "gerada").replace(/\s+/g, "_")}.pdf`,
      representante: representante || "—",
      periodo: periodo || "—",
      familias: result.familias,
      rows: result.rows.map((r) => ({
        razao_social: r.razao_social,
        categoria: r.categoria,
        metas: r.metas,
        metas_status: r.metas_status,
        total_meta: r.total_meta,
        total_pct_status: r.total_pct_status,
      })),
      totals: { perFamilia: derived.perFamilia, grand: derived.grand },
      participacao: derived.participacao,
      atingimento: derived.atingimento,
    });
  }

  function openSaveDialog() {
    if (!result) return;
    setSaveNome(
      `${representante || "Planilha"} — ${periodo || new Date().toLocaleDateString("pt-BR")}`,
    );
    setSaveOpen(true);
  }

  async function saveGenerated() {
    if (!result || !derived) return;
    if (!saveNome.trim()) return toast.error("Dê um nome à planilha.");
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Sessão expirada. Entre novamente.");
      const { error } = await supabase.from("gerador_performance_salvos").insert({
        uploaded_by: uid,
        nome: saveNome.trim(),
        representante: representante || null,
        periodo_label: periodoObj.label || null,
        periodo_inicio: periodoObj.inicio || null,
        periodo_fim: periodoObj.fim || null,
        familias: result.familias as any,
        rows: result.rows as any,
        participacao: derived.participacao as any,
        atingimento: derived.atingimento as any,
        observacoes: result.observacoes ?? null,
      } as any);
      if (error) throw error;
      toast.success("Planilha salva no repositório.");
      setSaveOpen(false);
      qc.invalidateQueries({ queryKey: ["gerador-perf-salvos"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function openSaved(row: any) {
    setResult({
      familias: (row.familias ?? []) as string[],
      rows: (row.rows ?? []) as any,
      observacoes: row.observacoes ?? undefined,
    });
    if (row.representante) setRepresentante(row.representante);
    if (row.periodo_label) {
      setPeriodoObj({
        label: row.periodo_label,
        inicio: row.periodo_inicio ?? "",
        fim: row.periodo_fim ?? "",
      });
    }
    toast.success(`"${row.nome}" carregado.`);
    setTimeout(() => {
      document.getElementById("resultado-gerador")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function derivedFromSaved(row: any) {
    const familias = (row.familias ?? []) as string[];
    const rows = (row.rows ?? []) as any[];
    const perFamilia = Object.fromEntries(
      familias.map((f) => [f, rows.reduce((s, r) => s + (Number(r.metas?.[f]) || 0), 0)]),
    ) as Record<string, number>;
    const grand = rows.reduce((s, r) => {
      const t =
        Number(r.total_meta) || familias.reduce((a, f) => a + (Number(r.metas?.[f]) || 0), 0);
      return s + t;
    }, 0);
    const participacao =
      (row.participacao && Object.keys(row.participacao).length
        ? row.participacao
        : {
            __total__: grand > 0 ? 100 : null,
            ...Object.fromEntries(
              familias.map((f) => [f, grand > 0 ? (perFamilia[f] / grand) * 100 : null]),
            ),
          }) as { __total__: number | null } & Record<string, number | null>;
    return { familias, rows, perFamilia, grand, participacao };
  }

  function exportSavedXlsx(row: any) {
    const d = derivedFromSaved(row);
    exportPerformanceXlsx({
      filename: `${row.nome}.xlsx`,
      representante: row.representante ?? "—",
      periodo: row.periodo_label ?? "—",
      familias: d.familias,
      rows: d.rows.map((r) => ({
        razao_social: r.razao_social,
        categoria: r.categoria,
        metas: r.metas,
        metas_status: r.metas_status,
        total_meta: r.total_meta,
        total_pct_status: r.total_pct_status,
      })),
      totals: { perFamilia: d.perFamilia, grand: d.grand },
      participacao: d.participacao,
      atingimento: d.atingimento,
    });
  }

  function exportSavedPdf(row: any) {
    const d = derivedFromSaved(row);
    exportPerformancePdf({
      filename: `${row.nome}.pdf`,
      representante: row.representante ?? "—",
      periodo: row.periodo_label ?? "—",
      familias: d.familias,
      rows: d.rows.map((r) => ({
        razao_social: r.razao_social,
        categoria: r.categoria,
        metas: r.metas,
        metas_status: r.metas_status,
        total_meta: r.total_meta,
        total_pct_status: r.total_pct_status,
      })),
      totals: { perFamilia: d.perFamilia, grand: d.grand },
      participacao: d.participacao,
      atingimento: d.atingimento,
    });
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const { error } = await supabase
      .from("gerador_performance_salvos")
      .delete()
      .eq("id", deleteId);
    if (error) return toast.error(error.message);
    toast.success("Planilha excluída.");
    setDeleteId(null);
    qc.invalidateQueries({ queryKey: ["gerador-perf-salvos"] });
  }

  function openSend() {
    if (!result) return;
    const found = reps.find((r: any) => r.nome?.toLowerCase() === representante.trim().toLowerCase());
    setSendRepId(found?.id ?? "");
    setSendPeriodoObj(periodoObj);
    setSendOpen(true);
  }

  async function sendToPanel() {
    if (!result) return;
    if (!sendRepId) return toast.error("Selecione um representante.");
    if (!sendPeriodoLabel.trim()) return toast.error("Informe o período.");
    setSending(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;

      const { data: existing } = await supabase
        .from("rep_performance_uploads")
        .select("id, periodo_label, periodo_inicio, periodo_fim")
        .eq("representative_id", sendRepId)
        .is("substituida_em", null);

      const norm = (s: string) => (s ?? "").trim().toLowerCase();
      const sameLabel = (a: string, b: string) => norm(a) === norm(b);
      const sameDates = (a: any) =>
        (sendPeriodoInicio || null) === (a.periodo_inicio || null) &&
        (sendPeriodoFim || null) === (a.periodo_fim || null);
      const match = (existing ?? []).find(
        (u: any) => sameLabel(u.periodo_label, sendPeriodoLabel) || sameDates(u),
      );

      if (match) {
        await supabase
          .from("rep_performance_uploads")
          .update({ substituida_em: new Date().toISOString() } as any)
          .eq("id", match.id);
      }

      const familias = result.familias;
      const categoria_metas: Record<string, number> = {};
      for (const r of result.rows) {
        const c = (r.categoria ?? "").trim();
        if (!c) continue;
        const t = Number(r.total_meta) || familias.reduce((s, f) => s + (Number(r.metas?.[f]) || 0), 0);
        categoria_metas[c] = (categoria_metas[c] ?? 0) + t;
      }

      const { data: up, error: upErr } = await supabase
        .from("rep_performance_uploads")
        .insert({
          representative_id: sendRepId,
          periodo_label: sendPeriodoLabel.trim(),
          periodo_inicio: sendPeriodoInicio || null,
          periodo_fim: sendPeriodoFim || null,
          familias,
          categoria_metas,
          escala_percentual: {},
          participacao: derived?.participacao ?? {},
          atingimento: derived?.atingimento ?? {},
          filename: `IA-${(representante || "gerada").replace(/\s+/g, "_")}.xlsx`,
          uploaded_by: uid,
          origem: match ? "ia-atualizada" : "ia",
        } as any)
        .select("id")
        .single();
      if (upErr || !up) throw upErr ?? new Error("Falha ao criar upload");

      if (match) {
        await supabase
          .from("rep_performance_uploads")
          .update({ substituida_por: up.id } as any)
          .eq("id", match.id);
      }

      const payload = result.rows.map((r, i) => ({
        upload_id: up.id,
        ordem: i + 1,
        razao_social: r.razao_social,
        categoria: r.categoria,
        metas: r.metas,
        metas_status: r.metas_status,
        metas_cores: {},
        total_meta: r.total_meta,
        total_pct_status: r.total_pct_status,
      }));
      for (let i = 0; i < payload.length; i += 200) {
        const chunk = payload.slice(i, i + 200);
        const { error } = await supabase.from("rep_performance_rows").insert(chunk as any);
        if (error) throw error;
      }

      toast.success(
        match
          ? "Enviado como atualização da performance existente."
          : "Enviado como nova performance no painel.",
      );
      setSendOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao enviar para o painel.");
    } finally {
      setSending(false);
    }
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
              faróis. <strong className="font-bold text-red-600 dark:text-red-500">Nenhum valor de faturamento/realização é armazenado nem exposto</strong> — o resultado final contém
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
              <Label htmlFor="rep">Representante <span className="text-destructive">*</span></Label>
              <Select value={representante} onValueChange={setRepresentante}>
                <SelectTrigger id="rep"><SelectValue placeholder="Selecione o representante" /></SelectTrigger>
                <SelectContent>
                  {reps.map((r: any) => (
                    <SelectItem key={r.id} value={r.nome}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <PeriodoPicker value={periodoObj} onChange={setPeriodoObj} />
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
            <Button onClick={generate} disabled={busy || !files.length || !representante}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {busy ? "Analisando com IA…" : "Gerar planilha de performance"}
            </Button>
          </div>
        </div>

        {/* Resultado */}
        {result && (
          <div id="resultado-gerador" className="surface rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-medium">3. Resultado</div>
                <p className="text-xs text-muted-foreground">
                  {result.rows.length} clientes · {result.familias.length} famílias
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" onClick={download}>
                  <FileDown className="h-4 w-4 mr-1" /> Excel
                </Button>
                <Button variant="outline" onClick={downloadPdf}>
                  <FileText className="h-4 w-4 mr-1" /> PDF
                </Button>
                <Button variant="outline" onClick={openSaveDialog}>
                  <Save className="h-4 w-4 mr-1" /> Salvar
                </Button>
                <Button onClick={openSend}>
                  <Send className="h-4 w-4 mr-1" /> Enviar para painel
                </Button>
              </div>
            </div>


            {result.observacoes && (
              <div className="text-xs text-muted-foreground rounded-lg border border-border p-3 bg-muted/30">
                <strong className="text-foreground">Observações da IA:</strong> {result.observacoes}
              </div>
            )}

            <div className="surface rounded-xl overflow-hidden">
              <div className="overflow-auto max-h-[70vh]">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground sticky top-0 z-20">
                    <tr>
                      <th className="text-left px-3 py-3 sticky left-0 top-0 bg-muted z-30 min-w-[240px]">
                        Razão social
                      </th>
                      <th className="text-left px-3 py-3 sticky left-[240px] top-0 bg-muted z-30 min-w-[110px]">
                        Categoria
                      </th>
                      <th className="text-right px-3 py-3 whitespace-nowrap min-w-[130px] bg-muted">
                        Total meta
                      </th>
                      <th className="text-center px-3 py-3 whitespace-nowrap min-w-[100px] bg-muted">
                        Total %
                      </th>
                      {result.familias.map((f) => (
                        <th key={f} className="text-center px-3 py-3 whitespace-nowrap min-w-[120px] bg-muted">
                          {f}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r, i) => {
                      const totalRow =
                        r.total_meta ??
                        result.familias.reduce((s, f) => s + (Number(r.metas?.[f]) || 0), 0);
                      const totalPctCls = r.total_pct_status ? FAROL_CELL_CLASS[r.total_pct_status] : "";
                      return (
                        <tr key={i} className="border-t border-border">
                          <td
                            title={r.razao_social}
                            className="px-3 py-2 font-medium sticky left-0 bg-background z-10 max-w-[280px] truncate"
                          >
                            {r.razao_social}
                          </td>
                          <td className="px-3 py-2 sticky left-[240px] bg-background z-10">
                            <span
                              className={cn(
                                "inline-flex px-2 py-0.5 rounded-full text-xs border",
                                catBadge(r.categoria),
                              )}
                            >
                              {r.categoria ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold bg-muted/20">
                            {fmtBRL(totalRow)}
                          </td>
                          <td className={cn("px-2 py-1 text-center", totalPctCls)}>
                            {r.total_pct_status ? (
                              <span className="inline-block px-2 py-0.5 rounded font-semibold text-xs">
                                {FAROL_FAIXA_TEXT[r.total_pct_status]}
                              </span>
                            ) : (
                              ""
                            )}
                          </td>
                          {result.familias.map((f) => {
                            const st = r.metas_status?.[f] as FarolStatus | undefined;
                            return (
                              <td
                                key={f}
                                className={cn(
                                  "px-2 py-1 text-center font-semibold text-xs tabular-nums",
                                  st && FAROL_CELL_CLASS[st],
                                )}
                              >
                                {st ? FAROL_FAIXA_TEXT[st] : ""}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {derived && (
                      <>
                        {/* TOTAL GERAL DA META */}
                        <tr className="border-t-2 border-border bg-muted/60 font-semibold">
                          <td className="px-3 py-3 sticky left-0 bg-muted/80 z-10 uppercase text-xs tracking-wider">
                            Total geral da meta
                          </td>
                          <td className="px-3 py-3 sticky left-[240px] bg-muted/80 z-10"></td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {fmtBRL(derived.grand)}
                          </td>
                          <td className="px-3 py-3"></td>
                          {result.familias.map((f) => (
                            <td key={f} className="px-3 py-3 text-right tabular-nums">
                              {fmtBRL(derived.perFamilia[f] || 0)}
                            </td>
                          ))}
                        </tr>
                        {/* PARTICIPAÇÃO ESTIMADA NA VENDA */}
                        <tr className="border-t border-border bg-sky-50 dark:bg-sky-950/30 font-medium">
                          <td className="px-3 py-2.5 sticky left-0 bg-sky-100/90 dark:bg-sky-950/60 z-10 text-xs uppercase tracking-wider">
                            Participação estimada na venda
                          </td>
                          <td className="px-3 py-2.5 sticky left-[240px] bg-sky-100/90 dark:bg-sky-950/60 z-10"></td>
                          <td className="px-3 py-2.5"></td>
                          <td className="px-3 py-2.5 text-center tabular-nums">
                            {fmtPct(derived.participacao.__total__)}
                          </td>
                          {result.familias.map((f) => (
                            <td key={f} className="px-3 py-2.5 text-center tabular-nums">
                              {fmtPct(derived.participacao[f])}
                            </td>
                          ))}
                        </tr>
                        {/* ATINGIMENTO ESTIMADO DA META */}
                        <tr className="border-t border-border bg-amber-50 dark:bg-amber-950/30 font-medium">
                          <td className="px-3 py-2.5 sticky left-0 bg-amber-100/90 dark:bg-amber-950/60 z-10 text-xs uppercase tracking-wider">
                            Atingimento estimado da meta
                          </td>
                          <td className="px-3 py-2.5 sticky left-[240px] bg-amber-100/90 dark:bg-amber-950/60 z-10"></td>
                          <td className="px-3 py-2.5"></td>
                          <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                            —
                          </td>
                          {result.familias.map((f) => (
                            <td key={f} className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                              —
                            </td>
                          ))}
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Repositório de planilhas salvas */}
        <div className="surface rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Repositório de planilhas geradas</div>
              <p className="text-xs text-muted-foreground">
                Suas planilhas salvas ficam disponíveis aqui para reabrir, exportar ou excluir.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{salvos.length} planilha{salvos.length === 1 ? "" : "s"}</span>
          </div>
          {loadingSalvos ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Carregando…
            </div>
          ) : salvos.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-lg">
              Nenhuma planilha salva ainda. Gere uma acima e clique em <strong>Salvar</strong>.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {salvos.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{s.nome}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[s.representante, s.periodo_label].filter(Boolean).join(" · ") || "—"}
                      {" · "}
                      {new Date(s.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Ações</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openSaved(s)}>
                        <FolderOpen className="h-4 w-4 mr-2" /> Abrir
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportSavedXlsx(s)}>
                        <FileDown className="h-4 w-4 mr-2" /> Exportar Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportSavedPdf(s)}>
                        <FileText className="h-4 w-4 mr-2" /> Exportar PDF
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteId(s.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialog Salvar */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar planilha no repositório</DialogTitle>
            <DialogDescription>
              Dê um nome para encontrá-la depois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="save-nome">Nome</Label>
            <Input
              id="save-nome"
              value={saveNome}
              onChange={(e) => setSaveNome(e.target.value)}
              placeholder="Ex.: Salton — 1º Semestre 2026"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveGenerated} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir planilha</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. A planilha será removida do repositório.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar para o painel de Performance</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Se já houver uma performance ativa do representante com o mesmo período, ela será
              substituída por esta como atualização. Caso contrário, esta entra como uma nova versão.
            </p>
            <div className="space-y-1.5">
              <Label>Representante</Label>
              <Select value={sendRepId} onValueChange={setSendRepId}>
                <SelectTrigger><SelectValue placeholder="Selecione o representante" /></SelectTrigger>
                <SelectContent>
                  {reps.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PeriodoPicker value={sendPeriodoObj} onChange={setSendPeriodoObj} label="Período" required />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)} disabled={sending}>Cancelar</Button>
            <Button onClick={sendToPanel} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
