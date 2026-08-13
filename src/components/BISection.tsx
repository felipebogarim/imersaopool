import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronRight, Upload, BarChart3, Sparkles, Loader2, MoreVertical, FileText, FileSpreadsheet, Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn, famLabel } from "@/lib/utils";
import { parseBIWorkbook, type BIData } from "@/lib/bi-parser";
import { FAROL_CELL_CLASS, FAROL_LABEL, FAROL_ORDER, catBadge, type FarolStatus } from "@/lib/performance-farol";
import { GaugeAtingimento } from "@/components/visao-rep2/GaugeAtingimento";
import { askBIAssistant } from "@/lib/bi-assistant.functions";


const fmtPct = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  const v = Math.abs(n) <= 1.5 ? n * 100 : n;
  return `${v.toFixed(1).replace(".", ",")}%`;
};

// Formatador único para shareRatio (decimal entre 0 e 1) → "12,3%".
const pctFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const fmtShare = (ratio: number | null | undefined) =>
  ratio == null || Number.isNaN(ratio) ? "—" : pctFormatter.format(ratio);

const farolKey = (grupo: string): keyof typeof FAROL_LABEL | null => {
  const g = grupo.toLowerCase();
  const found = FAROL_ORDER.find((k) => FAROL_LABEL[k].toLowerCase() === g);
  return (found as any) ?? null;
};


export type FamilyShare = {
  familyKey: string;
  familyName: string;
  shareRatio: number; // 0..1
  attainmentRatio: number | null; // 0..1+, null when meta = 0
  metaTotal?: number;
};


type Metric = "participation" | "attainment";

const sanitizeFilename = (s: string) =>
  s.replace(/[^\p{L}\p{N}\-_]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "pesquisa_ia";

async function exportAiPdf(repName: string, question: string, answer: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Pesquisa via IA — BI", margin, y); y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Representante: ${repName}`, margin, y); y += 14;
  doc.text(`Data: ${new Date().toLocaleString("pt-BR")}`, margin, y); y += 20;
  doc.setFont("helvetica", "bold");
  doc.text("Pergunta:", margin, y); y += 14;
  doc.setFont("helvetica", "normal");
  const qLines = doc.splitTextToSize(question || "—", width);
  doc.text(qLines, margin, y); y += qLines.length * 12 + 10;
  doc.setFont("helvetica", "bold");
  doc.text("Resposta:", margin, y); y += 14;
  doc.setFont("helvetica", "normal");
  const aLines = doc.splitTextToSize(answer || "—", width);
  const pageH = doc.internal.pageSize.getHeight();
  for (const line of aLines) {
    if (y > pageH - margin) { doc.addPage(); y = margin; }
    doc.text(line, margin, y); y += 12;
  }
  doc.save(`pesquisa_ia_${sanitizeFilename(repName)}.pdf`);
}

async function exportAiXlsx(repName: string, question: string, answer: string) {
  const XLSX = await import("xlsx");
  const rows = [
    ["Representante", repName],
    ["Data", new Date().toLocaleString("pt-BR")],
    [],
    ["Pergunta", question],
    [],
    ["Resposta", answer],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 20 }, { wch: 100 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pesquisa IA");
  XLSX.writeFile(wb, `pesquisa_ia_${sanitizeFilename(repName)}.xlsx`);
}

function shareAiWhats(repName: string, question: string, answer: string) {
  const text = `*Pesquisa via IA — BI*\n*Representante:* ${repName}\n\n*Pergunta:*\n${question}\n\n*Resposta:*\n${answer}`;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}


export function BISection({ repId, repName, defaultOpen = false }: { repId: string; repName: string; defaultOpen?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const [metric, setMetric] = useState<Metric>("participation");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const askAI = useServerFn(askBIAssistant);
  const aiMutation = useMutation({
    mutationFn: (question: string) => askAI({ data: { repId, question } }),
    onSuccess: (res: any) => setAiAnswer(res?.answer ?? ""),
    onError: (e: any) => toast.error(e?.message ?? "Erro na consulta IA."),
  });
  const fileRef = useRef<HTMLInputElement>(null);


  const { data: bi = null, isLoading } = useQuery({
    queryKey: ["rep-bi", repId],
    enabled: !!repId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("rep_bi_uploads")
        .select("*")
        .eq("representative_id", repId)
        .is("substituida_em", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      const parsed: BIData = parseBIWorkbook(buf);
      const { data: userRes } = await supabase.auth.getUser();
      const { data: rep } = await supabase
        .from("representatives")
        .select("company_id")
        .eq("id", repId)
        .single();
      if (!rep?.company_id) throw new Error("Representante sem empresa associada.");
      if (bi?.id) {
        await (supabase as any)
          .from("rep_bi_uploads")
          .update({ substituida_em: new Date().toISOString() })
          .eq("id", bi.id);
      }
      const { error } = await (supabase as any).from("rep_bi_uploads").insert({
        representative_id: repId,
        company_id: rep.company_id,
        periodo_label: "1º Semestre 2026",
        filename: file.name,
        data_safe: parsed,
        uploaded_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Planilha de BI importada.");
      qc.invalidateQueries({ queryKey: ["rep-bi", repId] });
      setOpen(true);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao importar BI."),
    onSettled: () => setBusy(false),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    upload.mutate(f);
  }

  const d: BIData | null = ((bi?.data_safe ?? bi?.data) as BIData) ?? null;
  const catsSorted = useMemo(
    () => (d?.categorias ?? []).slice().sort((a, b) => (b.participacao ?? 0) - (a.participacao ?? 0)),
    [d],
  );
  const farolSorted = useMemo(
    () => (d?.farol ?? []).slice().sort((a, b) => FAROL_ORDER.indexOf(farolKey(a.grupo) as any) - FAROL_ORDER.indexOf(farolKey(b.grupo) as any)),
    [d],
  );
  // Fallback: quando a planilha não traz os destaques prontos, derivamos
  // do próprio ranking de categorias / grupos do farol já calculado.
  const maiorCategoria = useMemo(() => {
    const v = d?.maior_categoria;
    if (v?.label && v.participacao != null) return v;
    const top = catsSorted[0];
    return top
      ? { label: top.categoria, participacao: top.participacao }
      : { label: null, participacao: null };
  }, [d, catsSorted]);
  const maiorGrupoFarol = useMemo(() => {
    const v = d?.maior_grupo_farol;
    if (v?.label && v.participacao != null) return v;
    const top = (d?.farol ?? [])
      .slice()
      .sort((a, b) => (b.participacao ?? 0) - (a.participacao ?? 0))[0];
    return top ? { label: top.grupo, participacao: top.participacao } : { label: null, participacao: null };
  }, [d]);

  // Rankings de participação por família — cálculo agora ocorre no banco
  // (função SECURITY DEFINER `compute_bi_shares`) para não expor metas em R$
  // ao cliente. Retorna shareRatio (0..1) por família, agrupado por categoria.
  const { data: sharesRpc = {} } = useQuery({
    queryKey: ["bi-shares", repId],
    enabled: !!repId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("compute_bi_shares", { _rep_id: repId });
      if (error) throw error;
      return (data ?? {}) as Record<string, FamilyShare[]>;
    },
  });

  // Fallback determinístico: quando não há base de performance no banco, usa a
  // matriz categoria × família extraída da aba "Base BI" do arquivo importado.
  const sharesByCategory: Record<string, FamilyShare[]> = useMemo(() => {
    // O RPC só é considerado útil quando traz valores efetivos (meta/participação/
    // atingimento). Retornos "vazios" (tudo zero) caem para a base do arquivo.
    const rpcHas = Object.values(sharesRpc ?? {}).some((v) =>
      (v ?? []).some(
        (x) => (x?.metaTotal ?? 0) > 0 || (x?.shareRatio ?? 0) > 0 || (x?.attainmentRatio ?? 0) > 0,
      ),
    );
    if (rpcHas) return sharesRpc;
    const fams = d?.familias ?? [];
    if (!fams.length) return sharesRpc;
    const out: Record<string, FamilyShare[]> = {};
    for (const f of fams) {
      const part = f.participacao ?? 0;
      out[f.categoria] ??= [];
      out[f.categoria].push({
        familyKey: f.familia,
        familyName: f.familia,
        shareRatio: part / 100,
        attainmentRatio: f.atingimento == null ? null : f.atingimento / 100,
        // Peso relativo dentro da categoria: usa a participação como proxy da meta
        // (metas em R$ não trafegam para o cliente).
        metaTotal: part > 0 ? part : 0.0001,
      });
    }
    return out;
  }, [sharesRpc, d]);



  const CAT_ORDER = ["Black", "Gold", "Silver"] as const;

  const orderedCats = useMemo(
    () =>
      (CAT_ORDER as readonly string[])
        .filter((c) => sharesByCategory[c])
        .concat(
          Object.keys(sharesByCategory).filter(
            (c) => !(CAT_ORDER as readonly string[]).includes(c),
          ),
        ),
    [sharesByCategory],
  );

  const rankingsPorCat = useMemo(() => {
    const out: Record<string, { menores: FamilyShare[]; maiores: FamilyShare[] }> = {};
    for (const cat of orderedCats) {
      const list = sharesByCategory[cat] ?? [];
      // Só famílias com meta financeira > 0 entram no ranking.
      const base = list.filter((x) => (x.metaTotal ?? 0) > 0);
      const key: keyof FamilyShare = metric === "participation" ? "shareRatio" : "attainmentRatio";
      const withMetric = base.filter((x) => x[key] != null);
      if (withMetric.length === 0) {
        out[cat] = { menores: [], maiores: [] };
        continue;
      }
      const menores = [...withMetric]
        .sort((a, b) => ((a[key] as number) ?? 0) - ((b[key] as number) ?? 0))
        .slice(0, 3);
      const maiores = [...withMetric]
        .sort((a, b) => ((b[key] as number) ?? 0) - ((a[key] as number) ?? 0))
        .slice(0, 3);
      out[cat] = { menores, maiores };
    }
    return out;
  }, [sharesByCategory, orderedCats, metric]);

  // Consolidação por família (todas as categorias) para o gráfico de barras.
  // Média ponderada pela meta de cada família dentro de cada categoria.
  const familyChart = useMemo(() => {
    // Participação estimada: denominador único = soma do índice ponderado de
    // todas as famílias (todas as categorias). O índice global de cada célula é
    // participação da família na categoria × participação da categoria no total.
    if (metric === "participation") {
      const catShare = new Map<string, number>();
      for (const c of d?.categorias ?? []) {
        if (c.participacao != null) catShare.set(c.categoria, c.participacao / 100);
      }
      const acc = new Map<string, { name: string; v: number }>();
      let total = 0;
      for (const cat of orderedCats) {
        const list = sharesByCategory[cat] ?? [];
        const cs =
          catShare.get(cat) ??
          list.reduce((s, f) => s + (f.metaTotal ?? 0) * (f.attainmentRatio ?? 1), 0);
        for (const f of list) {
          const v = (f.shareRatio ?? 0) * cs;
          if (!Number.isFinite(v)) continue;
          const cur = acc.get(f.familyKey) ?? { name: f.familyName, v: 0 };
          cur.v += v;
          acc.set(f.familyKey, cur);
          total += v;
        }
      }
      return [...acc.entries()]
        .map(([key, v]) => ({ key, name: v.name, ratio: total > 0 ? v.v / total : 0 }))
        .sort((a, b) => b.ratio - a.ratio);
    }

    const acc = new Map<string, { name: string; num: number; den: number }>();
    for (const cat of orderedCats) {
      for (const f of sharesByCategory[cat] ?? []) {
        const value = f.attainmentRatio;
        if (value == null || Number.isNaN(value)) continue;
        const w = (f.metaTotal ?? 0) > 0 ? (f.metaTotal as number) : 1;
        const cur = acc.get(f.familyKey) ?? { name: f.familyName, num: 0, den: 0 };
        cur.num += value * w;
        cur.den += w;
        acc.set(f.familyKey, cur);
      }
    }
    return [...acc.entries()]
      .map(([key, v]) => ({ key, name: v.name, ratio: v.den > 0 ? v.num / v.den : 0 }))
      .sort((a, b) => b.ratio - a.ratio);
  }, [sharesByCategory, orderedCats, metric, d]);


  const familyChartMax = useMemo(
    () => Math.max(0.0001, ...familyChart.map((f) => f.ratio)),
    [familyChart],
  );

  // Top 6 clientes por atingimento ponderado
  const { data: top6Clients = [] } = useQuery({
    queryKey: ["bi-top6-clients", repId],
    enabled: !!repId,
    queryFn: async () => {
      const { data: upload } = await supabase
        .from("rep_performance_uploads")
        .select("id")
        .eq("representative_id", repId)
        .is("substituida_em", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: rows } = upload
        ? await (supabase as any)
            .from("rep_performance_rows")
            .select("razao_social, total_pct")
            .eq("upload_id", upload.id)
        : { data: [] as any[] };

      // Fallback: BI individual do cliente (quando a planilha de performance
      // foi importada apenas por cores, sem percentuais).
      const { data: clientBis } = await (supabase as any)
        .from("client_bi_uploads")
        .select("razao_social, data, created_at")
        .eq("representative_id", repId)
        .eq("kind", "bi")
        .is("substituida_em", null)
        .order("created_at", { ascending: false });

      const biByName = new Map<string, number>();
      for (const b of (clientBis ?? []) as any[]) {
        const name = String(b.razao_social ?? "").trim();
        const g = Number(b?.data?.geral);
        if (!name || !Number.isFinite(g) || biByName.has(name)) continue;
        biByName.set(name, Math.abs(g) <= 1.5 ? g * 100 : g);
      }

      const byName = new Map<string, number>();
      for (const r of ((rows ?? []) as any[])) {
        const name = String(r.razao_social ?? "").trim();
        if (!name) continue;
        const raw = r.total_pct == null ? null : Number(r.total_pct);
        const value =
          raw != null && Number.isFinite(raw) && raw > 0
            ? raw * 100
            : (biByName.get(name) ?? null);
        if (value == null || !Number.isFinite(value)) continue;
        byName.set(name, value);
      }
      // clientes que só existem no BI individual
      for (const [name, value] of biByName) if (!byName.has(name)) byName.set(name, value);

      return [...byName.entries()]
        .map(([name, atingimento]) => ({ name, atingimento }))
        .filter((c) => c.atingimento > 0)
        .sort((a, b) => b.atingimento - a.atingimento)
        .slice(0, 6);
    }
  });






  return (
    <div className="surface rounded-xl overflow-hidden">
      <div className="w-full px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition"
          aria-expanded={open}
        >
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            BI — indicadores de performance {repName ? `· ${repName}` : ""}
          </p>
          {d?.geral != null && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Atingimento ponderado geral: <strong className="tabular-nums">{fmtPct(d.geral)}</strong>
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {bi?.filename && (
            <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[240px]">
              {bi.filename}
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={onFile}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            {bi ? "Atualizar BI" : "Carregar planilha BI"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : !d ? (
            <div className="text-sm text-muted-foreground">
              Nenhuma planilha de BI carregada. Use o botão <strong>Carregar planilha BI</strong> acima.
            </div>
          ) : (
            <>
              {/* Atingimento TOP6 Clientes */}
              {top6Clients.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Atingimento TOP6 Clientes</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {top6Clients.map((client) => (
                      <div key={client.name} className="rounded-xl border border-border p-4 bg-card">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground truncate mb-2" title={client.name}>
                          {client.name}
                        </div>
                        <GaugeAtingimento valor={client.atingimento} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Destaques */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border p-4 bg-primary/5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Atingimento ponderado geral</div>
                  <div className="mt-1 text-3xl font-semibold tabular-nums">{fmtPct(d.geral)}</div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Maior participação por categoria</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs border", catBadge(maiorCategoria.label ?? ""))}>
                      {maiorCategoria.label ?? "—"}
                    </span>
                    <span className="text-2xl font-semibold tabular-nums">{fmtPct(maiorCategoria.participacao)}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Maior participação por grupo do farol</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    {(() => {
                      const k = farolKey(maiorGrupoFarol.label ?? "");
                      return (
                        <span className={cn("inline-flex px-2 py-0.5 rounded text-xs border", k && FAROL_CELL_CLASS[k as FarolStatus])}>
                          {maiorGrupoFarol.label ?? "—"}
                        </span>
                      );
                    })()}
                    <span className="text-2xl font-semibold tabular-nums">{fmtPct(maiorGrupoFarol.participacao)}</span>

                  </div>
                </div>
              </div>

              {/* Participação ponderada por categoria */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Participação ponderada por categoria (%)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {catsSorted.map((c) => (
                    <div key={c.categoria} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between">
                        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs border", catBadge(c.categoria))}>
                          {c.categoria}
                        </span>
                        <span className="text-xs text-muted-foreground">participação</span>
                      </div>
                      <div className="mt-2 text-2xl font-semibold tabular-nums">{fmtPct(c.participacao)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Atingimento ponderado: <span className="tabular-nums text-foreground">{fmtPct(c.atingimento)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Participação ponderada por faixa do farol */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Participação ponderada por faixa do farol (%)
                </div>
                <div className="text-[11px] text-muted-foreground mb-2">
                  Percentual de participação de cada faixa no total ponderado. Registros sem compra não geram participação.
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {farolSorted.map((f) => {
                    const k = farolKey(f.grupo);
                    return (
                      <div
                        key={f.grupo}
                        className={cn(
                          "rounded-xl p-3 border border-border/60 flex flex-col gap-1",
                          k && FAROL_CELL_CLASS[k as FarolStatus],
                        )}
                      >
                        <div className="text-[11px] uppercase tracking-wider opacity-80">{f.grupo}</div>
                        <div className="text-xl font-semibold tabular-nums">{fmtPct(f.participacao)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Toggle de métrica dos rankings */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Analisar famílias por:
                </span>
                <div className="inline-flex rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMetric("participation")}
                    className={cn(
                      "px-3 py-1 text-xs transition",
                      metric === "participation"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    Participação estimada
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric("attainment")}
                    className={cn(
                      "px-3 py-1 text-xs transition",
                      metric === "attainment"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    Atingimento da meta
                  </button>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {metric === "participation"
                    ? "Participação de cada família no resultado ponderado total do representante."
                    : "Quanto cada família atingiu da meta financeira estabelecida."}
                </span>
              </div>

              {/* Gráfico de barras — performance por família de produtos */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Performance por família de produtos —{" "}
                  {metric === "participation" ? "participação estimada" : "atingimento da meta"}
                </div>
                <div className="text-[11px] text-muted-foreground mb-3">
                  {metric === "participation"
                    ? "Denominador único: índice ponderado da família ÷ índice ponderado total (soma = 100%)."
                    : "Consolidado de todas as categorias (média ponderada pela meta da família)."}

                </div>
                {familyChart.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sem base para o gráfico.</div>
                ) : (
                  <div className="rounded-xl border border-border p-3 space-y-1.5">
                    {familyChart.map((f) => (
                      <div key={f.key} className="flex items-center gap-2">
                        <span className="w-32 sm:w-44 shrink-0 truncate text-[11px] text-muted-foreground">
                          {famLabel(f.name)}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/80"
                            style={{ width: `${Math.min(100, (f.ratio / familyChartMax) * 100)}%` }}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right text-[11px] tabular-nums font-medium">
                          {fmtShare(f.ratio)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>



              {/* 3 famílias com menor {métrica} por categoria */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  3 famílias com menor {metric === "participation" ? "participação estimada" : "atingimento"} por categoria
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {orderedCats.map((cat) => {
                    const list = rankingsPorCat[cat]?.menores ?? [];
                    return (
                      <div key={cat} className="rounded-xl border border-border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs border", catBadge(cat))}>
                            {cat}
                          </span>
                          <span className="text-xs text-muted-foreground">menores 3</span>
                        </div>
                        {list.length === 0 ? (
                          <div className="text-sm text-muted-foreground">Sem base</div>
                        ) : (
                          <ol className="space-y-1.5 text-sm">
                            {list.map((item, i) => (
                              <li key={`${cat}-min-${item.familyKey}`} className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground w-4">{i + 1}.</span>
                                <span className="flex-1 truncate">{famLabel(item.familyName)}</span>
                                <span className="tabular-nums font-medium">
                                  {fmtShare(metric === "participation" ? item.shareRatio : item.attainmentRatio)}
                                </span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>


              {/* 3 famílias com maior {métrica} por categoria */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  3 famílias com maior {metric === "participation" ? "participação estimada" : "atingimento"} por categoria
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {orderedCats.map((cat) => {
                    const list = rankingsPorCat[cat]?.maiores ?? [];
                    return (
                      <div key={cat} className="rounded-xl border border-border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs border", catBadge(cat))}>
                            {cat}
                          </span>
                          <span className="text-xs text-muted-foreground">maiores 3</span>
                        </div>
                        {list.length === 0 ? (
                          <div className="text-sm text-muted-foreground">Sem base</div>
                        ) : (
                          <ol className="space-y-1.5 text-sm">
                            {list.map((item, i) => (
                              <li key={`${cat}-max-${item.familyKey}`} className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground w-4">{i + 1}.</span>
                                <span className="flex-1 truncate">{famLabel(item.familyName)}</span>
                                <span className="tabular-nums font-medium">
                                  {fmtShare(metric === "participation" ? item.shareRatio : item.attainmentRatio)}
                                </span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pesquisa via IA */}
              <div className="rounded-xl border border-border p-4 bg-primary/[0.03]">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Pesquisa via IA nos BIs dos clientes
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground mb-3">
                  Faça perguntas sobre a base (ex.: "liste os clientes que não compraram nada de fitas e fontes").
                  As respostas usam apenas percentuais, faixas e faróis — nunca valores em R$ ou volumes.
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = aiQuestion.trim();
                    if (!q) return;
                    setAiAnswer(null);
                    aiMutation.mutate(q);
                  }}
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Digite sua pergunta…"
                    maxLength={500}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    disabled={aiMutation.isPending}
                  />
                  <Button type="submit" size="sm" disabled={aiMutation.isPending || !aiQuestion.trim()}>
                    {aiMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                    )}
                    Perguntar
                  </Button>
                </form>
                {aiAnswer != null && (
                  <div className="mt-3 rounded-lg border border-border bg-background p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="whitespace-pre-wrap flex-1">{aiAnswer || "Sem resposta."}</div>
                      {aiAnswer && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => exportAiPdf(repName, aiQuestion, aiAnswer)}>
                              <FileText className="h-4 w-4 mr-2" /> Salvar em PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportAiXlsx(repName, aiQuestion, aiAnswer)}>
                              <FileSpreadsheet className="h-4 w-4 mr-2" /> Salvar em Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => shareAiWhats(repName, aiQuestion, aiAnswer)}>
                              <Share2 className="h-4 w-4 mr-2" /> Compartilhar no WhatsApp
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </>

          )}
        </div>
      )}
    </div>
  );
}
