import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronRight, Upload, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseBIWorkbook, type BIData } from "@/lib/bi-parser";
import { FAROL_CELL_CLASS, FAROL_LABEL, FAROL_MIDPOINT, FAROL_ORDER, catBadge, type FarolStatus } from "@/lib/performance-farol";

const fmtPct = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  const v = Math.abs(n) <= 1.5 ? n * 100 : n;
  return `${v.toFixed(1).replace(".", ",")}%`;
};

const farolKey = (grupo: string): keyof typeof FAROL_LABEL | null => {
  const g = grupo.toLowerCase();
  const found = FAROL_ORDER.find((k) => FAROL_LABEL[k].toLowerCase() === g);
  return (found as any) ?? null;
};

export function BISection({ repId, repName }: { repId: string; repName: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
        data: parsed,
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

  const d: BIData | null = (bi?.data as BIData) ?? null;
  const catsSorted = useMemo(
    () => (d?.categorias ?? []).slice().sort((a, b) => (b.participacao ?? 0) - (a.participacao ?? 0)),
    [d],
  );
  const farolSorted = useMemo(
    () => (d?.farol ?? []).slice().sort((a, b) => FAROL_ORDER.indexOf(farolKey(a.grupo) as any) - FAROL_ORDER.indexOf(farolKey(b.grupo) as any)),
    [d],
  );
  // ----- 3 famílias com menor participação estimada por categoria -----
  // Reutiliza a mesma lógica de estimativa do "Atingimento ponderado" e
  // "Participação estimada na venda": realizado_est(fam) = meta(fam) * midpoint(status)/100.
  const { data: currentPerf } = useQuery({
    queryKey: ["rep-perf-current", repId],
    enabled: !!repId,
    queryFn: async () => {
      const { data: up } = await supabase
        .from("rep_performance_uploads")
        .select("id, familias")
        .eq("representative_id", repId)
        .is("substituida_em", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!up?.id) return null;
      const { data: rows } = await supabase
        .from("rep_performance_rows")
        .select("categoria, razao_social, metas, metas_status")
        .eq("upload_id", up.id);
      return { familias: (up.familias as string[]) ?? [], rows: rows ?? [] };
    },
  });

  const CAT_ORDER = ["Black", "Gold", "Silver"] as const;

  const sharesPorCat = useMemo(() => {
    if (!currentPerf) return {} as Record<string, Array<{ familia: string; participacao: number | null; idx: number }>>;
    const SUMMARY = ["PARTICIPA", "ATINGIMENTO", "TOTAL", "ESTIMATIVA", "FAIXA"];
    const familias = currentPerf.familias;
    const est: Record<string, Record<string, number>> = {};
    for (const r of currentPerf.rows as any[]) {
      const cat = String(r.categoria ?? "").trim();
      if (!cat) continue;
      const razaoU = String(r.razao_social ?? "").trim().toUpperCase();
      if (SUMMARY.some((p) => razaoU.startsWith(p))) continue;
      est[cat] ??= {};
      for (const f of familias) {
        const st = r.metas_status?.[f] as FarolStatus | undefined;
        if (!st) continue;
        const meta = Number(r.metas?.[f]) || 0;
        if (meta <= 0) continue; // ponderação exige valor financeiro da meta
        const realizadoEst = meta * (FAROL_MIDPOINT[st] / 100);
        est[cat][f] = (est[cat][f] ?? 0) + realizadoEst;
      }
    }
    const out: Record<string, Array<{ familia: string; participacao: number | null; idx: number }>> = {};
    for (const [cat, famMap] of Object.entries(est)) {
      const total = Object.values(famMap).reduce((s, v) => s + v, 0);
      out[cat] = familias.map((f, idx) => ({
        familia: f,
        participacao: total > 0 ? ((famMap[f] ?? 0) / total) * 100 : null,
        idx,
      }));
    }
    return out;
  }, [currentPerf]);

  const orderedCats = useMemo(
    () => (CAT_ORDER as readonly string[]).filter((c) => sharesPorCat[c]).concat(
      Object.keys(sharesPorCat).filter((c) => !(CAT_ORDER as readonly string[]).includes(c)),
    ),
    [sharesPorCat],
  );

  const menoresPorCat = useMemo(() => {
    const out: Record<string, Array<{ familia: string; participacao: number | null }>> = {};
    for (const cat of orderedCats) {
      const list = sharesPorCat[cat] ?? [];
      const total = list.reduce((s, x) => s + (x.participacao ?? 0), 0);
      if (total <= 0) { out[cat] = []; continue; }
      const sorted = list.slice().sort((a, b) => {
        const pa = a.participacao ?? Infinity;
        const pb = b.participacao ?? Infinity;
        if (pa !== pb) return pa - pb;
        return a.idx - b.idx;
      });
      out[cat] = sorted.slice(0, 3).map(({ familia, participacao }) => ({ familia, participacao }));
    }
    return out;
  }, [sharesPorCat, orderedCats]);

  const maioresPorCat = useMemo(() => {
    const out: Record<string, Array<{ familia: string; participacao: number | null }>> = {};
    for (const cat of orderedCats) {
      const list = sharesPorCat[cat] ?? [];
      const total = list.reduce((s, x) => s + (x.participacao ?? 0), 0);
      if (total <= 0) { out[cat] = []; continue; }
      const sorted = list.slice().sort((a, b) => {
        const pa = a.participacao ?? -Infinity;
        const pb = b.participacao ?? -Infinity;
        if (pa !== pb) return pb - pa;
        return a.idx - b.idx;
      });
      out[cat] = sorted.slice(0, 3).map(({ familia, participacao }) => ({ familia, participacao }));
    }
    return out;
  }, [sharesPorCat, orderedCats]);

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
              {/* Destaques */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border p-4 bg-primary/5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Atingimento ponderado geral</div>
                  <div className="mt-1 text-3xl font-semibold tabular-nums">{fmtPct(d.geral)}</div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Maior participação por categoria</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs border", catBadge(d.maior_categoria.label ?? ""))}>
                      {d.maior_categoria.label ?? "—"}
                    </span>
                    <span className="text-2xl font-semibold tabular-nums">{fmtPct(d.maior_categoria.participacao)}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Maior participação por grupo do farol</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    {(() => {
                      const k = farolKey(d.maior_grupo_farol.label ?? "");
                      return (
                        <span className={cn("inline-flex px-2 py-0.5 rounded text-xs border", k && FAROL_CELL_CLASS[k as FarolStatus])}>
                          {d.maior_grupo_farol.label ?? "—"}
                        </span>
                      );
                    })()}
                    <span className="text-2xl font-semibold tabular-nums">{fmtPct(d.maior_grupo_farol.participacao)}</span>
                  </div>
                </div>
              </div>

              {/* Participação das categorias */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Participação das categorias no total
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

              {/* Distribuição do farol */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Distribuição dos grupos do farol
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

              {/* 3 famílias com menor participação estimada por categoria */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  3 famílias com menor participação estimada por categoria
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.entries(menoresPorCat).map(([cat, list]) => (
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
                          {list.map((p, i) => (
                            <li key={`${cat}-min-${i}`} className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground w-4">{i + 1}.</span>
                              <span className="flex-1 truncate">{p.familia}</span>
                              <span className="tabular-nums font-medium">{fmtPct(p.participacao)}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 3 famílias com maior participação estimada por categoria */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  3 famílias com maior participação estimada por categoria
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.entries(maioresPorCat).map(([cat, list]) => (
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
                          {list.map((p, i) => (
                            <li key={`${cat}-max-${i}`} className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground w-4">{i + 1}.</span>
                              <span className="flex-1 truncate">{p.familia}</span>
                              <span className="tabular-nums font-medium">{fmtPct(p.participacao)}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </>
          )}
        </div>
      )}
    </div>
  );
}
