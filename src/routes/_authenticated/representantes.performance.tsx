import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Upload, RefreshCw, Trash2, Pencil, Save, XCircle, FileDown, FileText, RotateCcw, Undo2, MoreVertical, ChevronLeft, ChevronRight, Search, X, BarChart3, Users, Lightbulb } from "lucide-react";
import { AcoesSugeridasDialog } from "@/components/AcoesSugeridasDialog";
import { toast } from "sonner";
import { cn, famLabel } from "@/lib/utils";
import { parseWorkbook } from "@/lib/performance-parser";
import { conflictMessage, CONFLICT_LABEL } from "@/lib/performance-cell-status";

/** SHA-256 do arquivo, usado para identificar reimportações do mesmo arquivo. */
async function sha256Hex(buf: ArrayBuffer): Promise<string | null> {
  try {
    const d = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(d))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

import { BISection } from "@/components/BISection";
import { exportPerformanceXlsx } from "@/lib/performance-export";
import { exportPerformanceReport } from "@/lib/performance-report";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";
import { PeriodoPicker, type PeriodoValue } from "@/components/PeriodoPicker";
import {
  FAROL_CELL_CLASS,
  FAROL_FAIXA_TEXT,
  FAROL_LABEL,
  FAROL_ORDER,
  catBadge,
  statusFromPercent,
  type FarolStatus,
} from "@/lib/performance-farol";

export const Route = createFileRoute("/_authenticated/representantes/performance")({
  head: () => ({ meta: [{ title: "Performance — Representantes" }] }),
  component: PerformancePage,
});

type ViewMode = "meta" | "realizado" | "percentual" | "completo";

const VIEW_KEY = "perf-view-mode";
const fmtBRL = (n: number | null | undefined) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "" : n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

type Row = {
  id: string;
  ordem: number;
  razao_social: string;
  categoria: string | null;
  metas: Record<string, number>;
  metas_status: Record<string, FarolStatus>;
  metas_cores: Record<string, string>;
  realizado: Record<string, number>;
  total_meta: number | null;
  total_pct_status: FarolStatus | null;
};

function PerformancePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [repId, setRepId] = useState<string>("");
  const [uploadId, setUploadId] = useState<string>("");
  const [dlgOpen, setDlgOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [dlgMode, setDlgMode] = useState<"new" | "replace">("new");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [periodoObj, setPeriodoObj] = useState<PeriodoValue>({ label: `1º Semestre ${new Date().getFullYear()}`, inicio: `${new Date().getFullYear()}-01-01`, fim: `${new Date().getFullYear()}-06-30` });
  const periodoLabel = periodoObj.label;
  const periodoInicio = periodoObj.inicio;
  const periodoFim = periodoObj.fim;
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdTargetRep, setPwdTargetRep] = useState<string>("");
  const [acoesOpen, setAcoesOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "meta";
    return ((localStorage.getItem(VIEW_KEY) as ViewMode) ?? "meta");
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(VIEW_KEY, viewMode);
  }, [viewMode]);

  // Edição
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Row[] | null>(null);

  // Filtros da matriz
  const [filterQ, setFilterQ] = useState("");
  const [filterCats, setFilterCats] = useState<string[]>([]);
  const [filterFams, setFilterFams] = useState<string[]>([]);
  const [filterZero, setFilterZero] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: reps = [] } = useQuery({
    queryKey: ["perf-reps"],
    queryFn: async () =>
      (await supabase.from("representatives").select("id, nome, company_id").order("nome")).data ?? [],
  });

  // Lista da landing: uma linha por representante com sua última versão ativa
  // (inclui reps com apenas BI, sem planilha de performance)
  const { data: repList = [], isLoading: loadingList } = useQuery({
    queryKey: ["perf-rep-list"],
    queryFn: async () => {
      const [{ data: ups }, { data: bis }] = await Promise.all([
        supabase
          .from("rep_performance_uploads")
          .select("id, representative_id, periodo_label, periodo_inicio, periodo_fim, created_at, filename")
          .is("substituida_em", null)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("rep_bi_uploads")
          .select("id, representative_id, periodo_label, created_at, filename")
          .is("substituida_em", null)
          .order("created_at", { ascending: false }),
      ]);
      const byRep = new Map<string, any>();
      for (const u of ups ?? []) {
        if (!byRep.has(u.representative_id)) byRep.set(u.representative_id, u);
      }
      for (const b of (bis as any[]) ?? []) {
        if (!byRep.has(b.representative_id)) {
          byRep.set(b.representative_id, {
            id: null,
            representative_id: b.representative_id,
            periodo_label: b.periodo_label,
            periodo_inicio: null,
            periodo_fim: null,
            created_at: b.created_at,
            filename: b.filename,
            bi_only: true,
          });
        }
      }
      return Array.from(byRep.entries()).map(([rid, u]) => ({ rep_id: rid, upload: u }));
    },
  });


  const { data: uploads = [] } = useQuery({
    queryKey: ["perf-uploads", repId],
    enabled: !!repId,
    queryFn: async () =>
      (await supabase
        .from("rep_performance_uploads")
        .select("*")
        .eq("representative_id", repId)
        .is("substituida_em", null)
        .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: allVersions = [] } = useQuery({
    queryKey: ["perf-all-versions", repId],
    enabled: !!repId,
    queryFn: async () =>
      (await supabase
        .from("rep_performance_uploads")
        .select("*")
        .eq("representative_id", repId)
        .order("created_at", { ascending: false })).data ?? [],
  });

  const currentUpload = useMemo(
    () => uploads.find((u: any) => u.id === uploadId) ?? uploads[0] ?? null,
    [uploads, uploadId],
  );
  const effectiveUploadId = currentUpload?.id ?? "";

  const { data: dbRows = [] } = useQuery({
    queryKey: ["perf-rows", effectiveUploadId],
    enabled: !!effectiveUploadId,
    queryFn: async () =>
      (await supabase
        .from("rep_performance_rows")
        .select("*")
        .eq("upload_id", effectiveUploadId)
        .order("ordem")).data ?? [],
  });

  // Filtra defensivamente linhas de resumo (dados antigos importados antes do parser corrigido)
  const SUMMARY_PREFIXES = ["PARTICIPA", "ATINGIMENTO", "TOTAL", "ESTIMATIVA", "FAIXA"];
  const rows: Row[] = useMemo(
    () =>
      (dbRows as any[])
        .filter((r) => {
          const u = String(r.razao_social ?? "").trim().toUpperCase();
          return !SUMMARY_PREFIXES.some((p) => u.startsWith(p));
        })
        .map((r) => ({
          id: r.id,
          ordem: r.ordem,
          razao_social: r.razao_social,
          categoria: r.categoria,
          metas: r.metas ?? {},
          metas_status: r.metas_status ?? {},
          metas_cores: r.metas_cores ?? {},
          realizado: r.realizado ?? {},
          total_meta: r.total_meta,
          total_pct_status: (r.total_pct_status ?? null) as FarolStatus | null,
        })),
    [dbRows],
  );

  // Reset draft quando muda de upload
  useEffect(() => {
    setEditing(false);
    setDraft(null);
  }, [effectiveUploadId]);

  const familias: string[] = (currentUpload?.familias as string[]) ?? [];
  const categoriaMetas: Record<string, number> = ((currentUpload as any)?.categoria_metas as Record<string, number>) ?? {};

  // Fonte de verdade para render/totais: draft se editando, senão rows
  const view: Row[] = editing && draft ? draft : rows;

  const totals = useMemo(() => {
    const perFamilia: Record<string, number> = {};
    const perFamiliaReal: Record<string, number> = {};
    let grand = 0;
    let grandReal = 0;
    for (const r of view) {
      for (const f of familias) {
        perFamilia[f] = (perFamilia[f] ?? 0) + (Number(r.metas?.[f]) || 0);
        perFamiliaReal[f] = (perFamiliaReal[f] ?? 0) + (Number(r.realizado?.[f]) || 0);
      }
      const t = familias.reduce((s, f) => s + (Number(r.metas?.[f]) || 0), 0);
      grand += t || Number(r.total_meta) || 0;
      grandReal += familias.reduce((s, f) => s + (Number(r.realizado?.[f]) || 0), 0);
    }
    return { perFamilia, perFamiliaReal, grand, grandReal };
  }, [view, familias]);

  // Filtros aplicados apenas na matriz
  const filteredView = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    const famsToCheck = filterFams.length > 0 ? filterFams : familias;
    return view.filter((r) => {
      if (q && !(r.razao_social ?? "").toLowerCase().includes(q)) return false;
      if (filterCats.length > 0) {
        const cat = (r.categoria ?? "").toUpperCase().trim();
        if (!filterCats.some((c) => c.toUpperCase() === cat)) return false;
      }
      if (filterZero) {
        // Considera 0% apenas nas colunas de famílias (ignora coluna Total %).
        const hasZero = famsToCheck.some((f) => r.metas_status?.[f] === "sem_compra");
        if (!hasZero) return false;
      }
      return true;
    });
  }, [view, filterQ, filterCats, filterZero, filterFams, familias]);

  const visibleFams = useMemo(
    () => (filterFams.length > 0 ? familias.filter((f) => filterFams.includes(f)) : familias),
    [familias, filterFams],
  );



  const filteredTotals = useMemo(() => {
    const perFamilia: Record<string, number> = {};
    const perFamiliaReal: Record<string, number> = {};
    let grand = 0;
    let grandReal = 0;
    for (const r of filteredView) {
      for (const f of familias) {
        perFamilia[f] = (perFamilia[f] ?? 0) + (Number(r.metas?.[f]) || 0);
        perFamiliaReal[f] = (perFamiliaReal[f] ?? 0) + (Number(r.realizado?.[f]) || 0);
      }
      const t = familias.reduce((s, f) => s + (Number(r.metas?.[f]) || 0), 0);
      grand += t || Number(r.total_meta) || 0;
      grandReal += familias.reduce((s, f) => s + (Number(r.realizado?.[f]) || 0), 0);
    }
    return { perFamilia, perFamiliaReal, grand, grandReal };
  }, [filteredView, familias]);

  const razaoSociaisAll = useMemo(
    () => Array.from(new Set(view.map((r) => r.razao_social).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [view],
  );
  const CATEGORIA_OPTIONS = useMemo(
    () =>
      Array.from(
        new Set(
          view
            .map((r) => (r.categoria ?? "").trim())
            .filter((c) => c.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [view],
  );
  const hasFilters = filterQ.trim() !== "" || filterCats.length > 0 || filterFams.length > 0 || filterZero;
  const filtersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filterOpen) return;
    function onDoc(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [filterOpen]);

  // Resumo executivo — contagens por status
  const resumo = useMemo(() => {
    const perCat: Record<string, { count: number; meta: number; real: number }> = {};
    const perStatus: Record<FarolStatus, number> = {
      sem_compra: 0,
      abaixo_meta: 0,
      pode_melhorar: 0,
      proximo: 0,
      otimo: 0,
      excelente: 0,
    };
    let hasRealizado = false;
    for (const r of view) {
      const cat = r.categoria ?? "—";
      perCat[cat] ??= { count: 0, meta: 0, real: 0 };
      perCat[cat].count += 1;
      const rowMeta = familias.reduce((s, f) => s + (Number(r.metas?.[f]) || 0), 0);
      const rowReal = familias.reduce((s, f) => s + (Number(r.realizado?.[f]) || 0), 0);
      perCat[cat].meta += rowMeta;
      perCat[cat].real += rowReal;
      if (rowReal > 0) hasRealizado = true;
      // Status da linha: prioriza total_pct_status; senão calcula por realizado/meta;
      // senão infere de metas_status (predominante ou sem_compra).
      let status: FarolStatus | null = r.total_pct_status ?? null;
      if (!status && rowMeta > 0 && rowReal > 0) {
        status = statusFromPercent((rowReal / rowMeta) * 100);
      }
      if (!status) {
        const values = Object.values(r.metas_status ?? {});
        if (values.length > 0) {
          if (values.every((s) => s === "sem_compra")) status = "sem_compra";
          else {
            const counts: Record<string, number> = {};
            for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
            status = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as FarolStatus) ?? null;
          }
        }
      }
      if (status) perStatus[status] += 1;
    }
    return { perCat, perStatus, hasRealizado };
  }, [view, familias]);

  function openUpload(mode: "new" | "replace") {
    if (!repId) {
      toast.error("Selecione um representante primeiro.");
      return;
    }
    setDlgMode(mode);
    if (mode === "replace" && currentUpload) {
      setPeriodoObj({
        label: currentUpload.periodo_label || `1º Semestre ${new Date().getFullYear()}`,
        inicio: currentUpload.periodo_inicio || `${new Date().getFullYear()}-01-01`,
        fim: currentUpload.periodo_fim || `${new Date().getFullYear()}-06-30`,
      });
    } else {
      const y = new Date().getFullYear();
      setPeriodoObj({ label: `1º Semestre ${y}`, inicio: `${y}-01-01`, fim: `${y}-06-30` });
    }
    setPendingFile(null);
    setDlgOpen(true);
  }

  async function handleUpload() {
    if (!pendingFile) {
      toast.error("Selecione um arquivo .xlsx");
      return;
    }
    if (!periodoLabel.trim()) {
      toast.error("Informe o período.");
      return;
    }
    setBusy(true);
    const audit: Record<string, any> = {
      representative_id: repId,
      periodo_label: periodoLabel.trim(),
      periodo_inicio: periodoInicio || null,
      periodo_fim: periodoFim || null,
      filename: pendingFile.name,
    };
    const logAudit = async () => {
      try {
        await (supabase as any).rpc("log_performance_import", { _payload: audit });
      } catch (err) {
        console.error("Falha ao registrar auditoria de importação", err);
      }
    };
    try {
      const buf = await pendingFile.arrayBuffer();
      audit.file_hash = await sha256Hex(buf);
      const parsed = await parseWorkbook(buf);
      audit.parser_version = parsed.parser_version;
      audit.linhas_lidas = parsed.linhas_lidas;
      audit.clientes_validos = parsed.rows.length;
      audit.linhas_ignoradas = parsed.ignoradas?.length ?? 0;
      audit.descartes = parsed.ignoradas ?? [];
      audit.familias = parsed.familias;
      audit.categorias = Array.from(
        new Set(parsed.rows.map((r) => r.categoria).filter(Boolean) as string[]),
      );
      audit.matriz_erros = parsed.matriz_erros ?? [];
      audit.celulas_avaliadas = parsed.stats?.celulas_avaliadas ?? 0;
      audit.estilos_carregados = parsed.stats?.estilos_carregados ?? 0;
      audit.estilos_ausentes = parsed.stats?.estilos_ausentes ?? 0;
      audit.cores_extraidas = parsed.stats?.cores_extraidas ?? 0;
      audit.cores_ausentes = parsed.stats?.cores_ausentes ?? 0;
      audit.cores_desconhecidas = parsed.stats?.cores_desconhecidas ?? 0;
      audit.cores_distintas = parsed.stats?.cores_distintas ?? [];
      audit.celulas_por_status = parsed.stats?.por_status ?? {};
      audit.divergencias_texto_cor = parsed.stats?.divergencias_texto_cor ?? 0;
      audit.conflitos_total = parsed.conflitos?.length ?? 0;
      audit.divergencias = (parsed.conflitos ?? []).slice(0, 50);
      audit.matriz_status = !parsed.matriz
        ? "ausente"
        : parsed.matriz_erros.length
          ? "invalida"
          : "valida";

      // 1) Qualquer conflito de cor/texto interrompe a importação.
      if (parsed.conflitos?.length) {
        const porMotivo = parsed.conflitos.reduce<Record<string, number>>((acc, c) => {
          acc[c.motivo] = (acc[c.motivo] ?? 0) + 1;
          return acc;
        }, {});
        const resumo = Object.entries(porMotivo)
          .map(([m, n]) => `${n} ${CONFLICT_LABEL[m as keyof typeof CONFLICT_LABEL] ?? m}`)
          .join(" · ");
        const head = parsed.conflitos.slice(0, 3).map(conflictMessage).join("\n");
        throw new Error(
          `Importação interrompida.\n${resumo}\n\n${head}${parsed.conflitos.length > 3 ? `\n(+${parsed.conflitos.length - 3} ocorrência(s))` : ""}`,
        );
      }
      // 2) Matriz financeira presente porém inválida também interrompe.
      if (parsed.matriz && parsed.matriz_erros.length) {
        throw new Error(parsed.matriz_erros.slice(0, 3).join("\n"));
      }
      if (!parsed.rows.length) throw new Error("Nenhuma linha de cliente encontrada na planilha.");

      const cm = (parsed.categoriaMetas ?? {}) as Record<string, any>;
      const targetsMatrix =
        parsed.matriz?.matriz ??
        ((cm.__family_metas_by_category__ ?? {}) as Record<string, Record<string, number>>);

      const payload = {
        representative_id: repId,
        periodo_label: periodoLabel.trim(),
        periodo_inicio: periodoInicio || null,
        periodo_fim: periodoFim || null,
        familias: parsed.familias,
        filename: pendingFile.name,
        targets_matrix: targetsMatrix,
        conflitos: parsed.conflitos ?? [],
        rows: parsed.rows.map((r) => ({
          razao_social: r.razao_social,
          categoria: r.categoria,
          metas_status: r.metas_status ?? {},
          total_pct_status: r.total_pct_status,
        })),
      };

      const { data, error } = await (supabase as any).rpc("submit_performance_upload", {
        _payload: payload,
      });
      if (error) throw error;

      audit.status = "sucesso";
      audit.upload_id = data?.upload_id ?? null;
      await logAudit();

      const ign = parsed.ignoradas?.length ?? 0;
      toast.success("Arquivo validado com sucesso.", {
        description:
          `${parsed.rows.length} clientes encontrados. ${parsed.familias.length} famílias reconhecidas. ` +
          `${parsed.stats?.celulas_avaliadas ?? 0} células de desempenho validadas. ` +
          `Matriz Financeira ${parsed.matriz ? (parsed.matriz_erros.length ? "inválida" : "válida") : "ausente"}. ` +
          `Nenhuma divergência entre texto e cor.` +
          (ign ? ` ${ign} linha(s) ignorada(s) (totais/legendas).` : ""),
      });
      setDlgOpen(false);
      qc.invalidateQueries({ queryKey: ["perf-uploads", repId] });
      qc.invalidateQueries({ queryKey: ["perf-all-versions", repId] });
      if (data?.upload_id) setUploadId(data.upload_id);
    } catch (e: any) {
      console.error(e);
      audit.status = audit.conflitos_total || audit.matriz_status === "invalida" ? "rejeitada" : "erro";
      audit.mensagem = String(e?.message ?? e);
      await logAudit();
      toast.error(audit.mensagem || "Erro ao importar planilha.");
    } finally {
      setBusy(false);
    }
  }



  async function handleDelete() {
    if (!currentUpload) return;
    if (!confirm(`Excluir a versão "${currentUpload.periodo_label}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("rep_performance_uploads").delete().eq("id", currentUpload.id);
    if (error) return toast.error(error.message);
    toast.success("Versão excluída. Se houver versão anterior, ela volta a ficar ativa.");
    setUploadId("");
    qc.invalidateQueries({ queryKey: ["perf-uploads", repId] });
    qc.invalidateQueries({ queryKey: ["perf-all-versions", repId] });
    qc.invalidateQueries({ queryKey: ["perf-rep-list"] });

  }

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(rows)));
    setEditing(true);
  }
  function cancelEdit() {
    if (draft && JSON.stringify(draft) !== JSON.stringify(rows)) {
      if (!confirm("Descartar alterações não salvas?")) return;
    }
    setDraft(null);
    setEditing(false);
  }

  async function saveEdit() {
    if (!draft || !currentUpload) return;
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;

      // Cria a nova versão PRIMEIRO; só depois marca a anterior como substituída.
      // (Se o insert falhar, o representante continua com a versão atual ativa.)
      const { data: up, error: upErr } = await supabase
        .from("rep_performance_uploads")
        .insert({
          representative_id: repId,
          periodo_label: currentUpload.periodo_label,
          periodo_inicio: currentUpload.periodo_inicio,
          periodo_fim: currentUpload.periodo_fim,
          familias: currentUpload.familias,
          categoria_metas: (currentUpload as any).categoria_metas,
          escala_percentual: currentUpload.escala_percentual,
          participacao: (currentUpload as any).participacao,
          atingimento: (currentUpload as any).atingimento,
          filename: currentUpload.filename,
          observacao: `Edição manual em ${new Date().toLocaleString("pt-BR")}`,
          uploaded_by: uid,
          updated_by: uid,
          origem: "manual_edit",
        } as any)
        .select("id")
        .single();
      if (upErr || !up) throw upErr;

      await supabase
        .from("rep_performance_uploads")
        .update({ substituida_em: new Date().toISOString(), substituida_por: up.id } as any)
        .eq("id", currentUpload.id);


      const payload = draft.map((r) => {
        const total = familias.reduce((s, f) => s + (Number(r.metas?.[f]) || 0), 0);
        return {
          upload_id: up.id,
          ordem: r.ordem,
          razao_social: r.razao_social,
          categoria: r.categoria,
          metas: r.metas,
          metas_status: r.metas_status,
          metas_cores: r.metas_cores,
          realizado: r.realizado,
          total_meta: total || r.total_meta,
          total_pct_status: r.total_pct_status,
        };
      });
      for (let i = 0; i < payload.length; i += 200) {
        const chunk = payload.slice(i, i + 200);
        const { error } = await supabase.from("rep_performance_rows").insert(chunk as any);
        if (error) throw error;
      }

      toast.success("Nova versão criada com as alterações.");
      setEditing(false);
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["perf-uploads", repId] });
      qc.invalidateQueries({ queryKey: ["perf-all-versions", repId] });
      setUploadId(up.id);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  function updateCell(rowIdx: number, familia: string, value: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = prev.slice();
      const r = { ...next[rowIdx], metas: { ...next[rowIdx].metas } };
      if (Number.isNaN(value) || value === 0) delete r.metas[familia];
      else r.metas[familia] = value;
      // Se está editando manualmente e não há realizado, deriva status por presença de valor
      // (não altera se existir realizado — % será calculado)
      next[rowIdx] = r;
      return next;
    });
  }

  async function reactivateLast() {
    if (!repId) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("reactivate_last_performance_upload", {
        _rep_id: repId,
      });
      if (error) throw error;
      if (!data?.reactivated) {
        toast.info(
          data?.reason === "sem_historico"
            ? "Não há versões no histórico deste representante."
            : "Este representante já possui uma versão ativa.",
        );
      } else {
        toast.success("Versão reativada.");
        setUploadId(data.upload_id);
      }
      qc.invalidateQueries({ queryKey: ["perf-uploads", repId] });
      qc.invalidateQueries({ queryKey: ["perf-all-versions", repId] });
      qc.invalidateQueries({ queryKey: ["perf-rep-list"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reativar versão.");
    } finally {
      setBusy(false);
    }
  }

  async function restoreVersion(v: any) {

    if (!confirm(`Restaurar a versão de ${new Date(v.created_at).toLocaleString("pt-BR")} como versão ativa?`)) return;
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;

      // Duplica a antiga como nova ativa PRIMEIRO
      const { data: up, error: upErr } = await supabase
        .from("rep_performance_uploads")
        .insert({
          representative_id: repId,
          periodo_label: v.periodo_label,
          periodo_inicio: v.periodo_inicio,
          periodo_fim: v.periodo_fim,
          familias: v.familias,
          categoria_metas: v.categoria_metas,
          escala_percentual: v.escala_percentual,
          participacao: v.participacao,
          atingimento: v.atingimento,
          filename: v.filename,
          observacao: `Restauração da versão ${new Date(v.created_at).toLocaleString("pt-BR")}`,
          uploaded_by: uid,
          updated_by: uid,
          origem: "restore",
        } as any)
        .select("id")
        .single();
      if (upErr || !up) throw upErr ?? new Error("Falha ao restaurar");

      // Só então marca a atual como substituída
      if (currentUpload) {
        await supabase
          .from("rep_performance_uploads")
          .update({ substituida_em: new Date().toISOString(), substituida_por: up.id } as any)
          .eq("id", currentUpload.id);
      }


      const { data: srcRows } = await supabase
        .from("rep_performance_rows")
        .select("*")
        .eq("upload_id", v.id);
      const payload = (srcRows ?? []).map((r: any) => ({
        upload_id: up.id,
        ordem: r.ordem,
        razao_social: r.razao_social,
        categoria: r.categoria,
        metas: r.metas,
        metas_status: r.metas_status,
        metas_cores: r.metas_cores,
        realizado: r.realizado,
        total_meta: r.total_meta,
        total_pct_status: r.total_pct_status ?? null,
      }));
      for (let i = 0; i < payload.length; i += 200) {
        const chunk = payload.slice(i, i + 200);
        await supabase.from("rep_performance_rows").insert(chunk as any);
      }
      toast.success("Versão restaurada.");
      qc.invalidateQueries({ queryKey: ["perf-uploads", repId] });
      qc.invalidateQueries({ queryKey: ["perf-all-versions", repId] });
      setUploadId(up.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao restaurar.");
    } finally {
      setBusy(false);
    }
  }

  function doExport() {
    if (!currentUpload) return;
    const rep = reps.find((r: any) => r.id === repId)?.nome ?? "";
    exportPerformanceXlsx({
      filename: `performance-${rep || "rep"}-${currentUpload.periodo_label}`,
      representante: rep,
      periodo: currentUpload.periodo_label,
      familias,
      rows: view,
      totals,
    });
  }

  function doExportReport() {
    if (!currentUpload) return;
    const rep = reps.find((r: any) => r.id === repId)?.nome ?? "";
    exportPerformanceReport({
      representante: rep,
      periodo: currentUpload.periodo_label,
      familias,
      rows: view.map((r) => ({
        razao_social: r.razao_social,
        categoria: r.categoria,
        metas_status: r.metas_status,
        total_pct_status: r.total_pct_status,
      })),
    });
  }



  // Exporta a partir da lista (sem abrir o representante)
  async function exportFromList(rid: string, upload: any) {
    const rep = reps.find((r: any) => r.id === rid)?.nome ?? "";
    const { data: rws } = await supabase
      .from("rep_performance_rows")
      .select("*")
      .eq("upload_id", upload.id)
      .order("ordem");
    const fams: string[] = (upload.familias as string[]) ?? [];
    const rowsE = (rws ?? []).map((r: any) => ({
      razao_social: r.razao_social,
      categoria: r.categoria,
      metas: r.metas ?? {},
      metas_status: r.metas_status ?? {},
      metas_cores: r.metas_cores ?? {},
      total_meta: r.total_meta,
    }));
    const perFamilia: Record<string, number> = {};
    let grand = 0;
    for (const r of rowsE) {
      for (const f of fams) perFamilia[f] = (perFamilia[f] ?? 0) + (Number(r.metas?.[f]) || 0);
      grand += fams.reduce((s, f) => s + (Number(r.metas?.[f]) || 0), 0) || Number(r.total_meta) || 0;
    }
    exportPerformanceXlsx({
      filename: `performance-${rep || "rep"}-${upload.periodo_label}`,
      representante: rep,
      periodo: upload.periodo_label,
      familias: fams,
      rows: rowsE,
      totals: { perFamilia, grand },
    });
  }

  // Abre editar (substituir versão) a partir da lista
  function editFromList(rid: string) {
    setRepId(rid);
    setUploadId("");
    setTimeout(() => openUpload("replace"), 0);
  }

  // Exclui todas as versões (com senha do gestor master) de um representante
  async function deleteRepConfirmed() {
    const rid = pwdTargetRep;
    if (!rid) return;
    const { data: ups } = await supabase
      .from("rep_performance_uploads")
      .select("id")
      .eq("representative_id", rid);
    const ids = (ups ?? []).map((u: any) => u.id);
    if (ids.length) {
      await supabase.from("rep_performance_rows").delete().in("upload_id", ids);
      const { error } = await supabase.from("rep_performance_uploads").delete().in("id", ids);
      if (error) return toast.error(error.message);
    }
    toast.success("Performance do representante excluída.");
    setPwdTargetRep("");
    qc.invalidateQueries({ queryKey: ["perf-rep-list"] });
    if (repId === rid) {
      setRepId("");
      setUploadId("");
    }
  }

  return (
    <div>
      <PageHeader
        title="Performance"
        subtitle="Metas e desempenho por família de produto"
        actions={
          !repId ? null : !editing ? (
            <>
              <Button variant="ghost" onClick={() => { setRepId(""); setUploadId(""); }}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button variant="outline" onClick={() => setAcoesOpen(true)} disabled={!repId}>
                <Lightbulb className="h-4 w-4 mr-1" /> Ações Sugeridas
              </Button>
              <Button variant="outline" asChild>
                <Link to="/clientes-bi-batch/$repId" params={{ repId }}>
                  <Users className="h-4 w-4 mr-1" /> BI dos clientes
                </Link>
              </Button>
              <Button variant="outline" onClick={doExportReport} disabled={!currentUpload}>
                <FileText className="h-4 w-4 mr-1" /> Exportar relatório
              </Button>
              <Button variant="outline" onClick={doExport} disabled={!currentUpload}>
                <FileDown className="h-4 w-4 mr-1" /> Exportar Excel
              </Button>
              <Button variant="outline" onClick={() => openUpload("replace")} disabled={!currentUpload}>
                <RefreshCw className="h-4 w-4 mr-1" /> Substituir versão
              </Button>
              <Button onClick={() => openUpload("new")}>
                <Upload className="h-4 w-4 mr-1" /> Nova planilha
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={cancelEdit}>
                <XCircle className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button onClick={saveEdit} disabled={busy}>
                <Save className="h-4 w-4 mr-1" /> Salvar como nova versão
              </Button>
            </>
          )
        }
      />

      {repId && uploads.length === 0 && allVersions.length > 0 && (
        <div className="px-4 sm:px-8 pt-4">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium">Este representante está sem versão ativa.</p>
              <p className="text-muted-foreground text-xs">
                Existem {allVersions.length} versão(ões) no histórico. Os dados não foram perdidos — é
                possível reativar a mais recente.
              </p>
            </div>
            <Button size="sm" onClick={reactivateLast} disabled={busy}>
              <RefreshCw className="h-4 w-4 mr-1" /> Reativar última versão
            </Button>
          </div>
        </div>
      )}

      {!repId ? (

        <div className="p-4 sm:p-8">
          <div className="surface rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Representantes com performance</p>
                <p className="text-xs text-muted-foreground">
                  Uma linha por representante. Abra para ver o detalhamento por período.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {repList.length} representante{repList.length === 1 ? "" : "s"}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-1" /> Nova planilha
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                    {reps.length === 0 ? (
                      <DropdownMenuItem disabled>Nenhum representante</DropdownMenuItem>
                    ) : (
                      reps.map((r: any) => (
                        <DropdownMenuItem
                          key={r.id}
                          onClick={() => {
                            setRepId(r.id);
                            setUploadId("");
                            setTimeout(() => openUpload("new"), 0);
                          }}
                        >
                          {r.nome}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Representante</th>
                    <th className="text-left px-4 py-2">Último período</th>
                    <th className="text-left px-4 py-2">Atualizada em</th>
                    <th className="text-left px-4 py-2">Arquivo</th>
                    <th className="px-2 py-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td>
                    </tr>
                  ) : repList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                        Nenhuma planilha de performance carregada ainda.
                      </td>
                    </tr>
                  ) : (
                    repList.map((item: any) => {
                      const rep = reps.find((r: any) => r.id === item.rep_id);
                      const u = item.upload;
                      return (
                        <tr
                          key={item.rep_id}
                          className="border-t border-border hover:bg-muted/30 cursor-pointer"
                          onClick={() => { setRepId(item.rep_id); setUploadId(u.id ?? ""); }}
                        >
                          <td className="px-4 py-3 font-medium">{rep?.nome ?? "—"}</td>
                          <td className="px-4 py-3">{u.periodo_label}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground truncate max-w-[280px]">
                            {u.filename ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setRepId(item.rep_id); setUploadId(u.id ?? ""); }}>
                                  <ChevronRight className="h-4 w-4 mr-2" /> Abrir
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportFromList(item.rep_id, u)}>
                                  <FileDown className="h-4 w-4 mr-2" /> Exportar planilha
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => editFromList(item.rep_id)}>
                                  <Pencil className="h-4 w-4 mr-2" /> Editar (nova planilha)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => { setPwdTargetRep(item.rep_id); setPwdOpen(true); }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (

      <div className="p-4 sm:p-8 space-y-6">
        {/* Seletores */}
        <div className="surface rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Representante</Label>
            <div className="h-10 flex items-center px-3 rounded-md border border-border bg-muted/30 font-medium truncate">
              {reps.find((r: any) => r.id === repId)?.nome ?? "—"}
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Período (versão)</Label>
            <Select value={effectiveUploadId} onValueChange={setUploadId} disabled={!uploads.length}>
              <SelectTrigger>
                <SelectValue placeholder={uploads.length ? "Selecione um período" : "Nenhuma versão ativa"} />
              </SelectTrigger>
              <SelectContent>
                {uploads.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.periodo_label} — {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Visualização</Label>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meta">Meta</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="percentual">Percentual</SelectItem>
                <SelectItem value="completo">Completo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>


        {/* BI — indicadores de performance (recolhido por padrão) */}
        {repId && (
          <BISection repId={repId} repName={reps.find((r: any) => r.id === repId)?.nome ?? ""} />
        )}



        {editing && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 px-4 py-2 text-sm flex items-center gap-2">
            <Undo2 className="h-4 w-4" />
            Você está editando. As alterações só serão gravadas ao clicar em <strong>Salvar como nova versão</strong>.
          </div>
        )}

        {/* Matriz */}
        <div className="surface rounded-xl overflow-hidden">
          {currentUpload && (
            <div className="px-3 py-3 border-b border-border flex flex-wrap items-center gap-2" ref={filtersRef}>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar razão social…"
                  value={filterQ}
                  onChange={(e) => { setFilterQ(e.target.value); setFilterOpen(true); }}
                  onFocus={() => setFilterOpen(true)}
                  className="pl-9 pr-8 h-9"
                />
                {filterQ && (
                  <button
                    type="button"
                    onClick={() => setFilterQ("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {filterOpen && razaoSociaisAll.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-md">
                    {razaoSociaisAll
                      .filter((n) => n.toLowerCase().includes(filterQ.trim().toLowerCase()))
                      .map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => { setFilterQ(n); setFilterOpen(false); }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                        >
                          {n}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {CATEGORIA_OPTIONS.map((c) => {
                  const active = filterCats.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setFilterCats((prev) => (active ? prev.filter((x) => x !== c) : [...prev, c]))
                      }
                      className={cn(
                        "inline-flex px-2.5 py-1 rounded-full text-xs border transition",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-border hover:bg-muted",
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              {familias.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center border-l border-border pl-2 ml-1">
                  {familias.map((f) => {
                    const active = filterFams.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() =>
                          setFilterFams((prev) => (active ? prev.filter((x) => x !== f) : [...prev, f]))
                        }
                        className={cn(
                          "inline-flex px-2.5 py-1 rounded-full text-xs border transition",
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent text-muted-foreground border-border hover:bg-muted",
                        )}
                      >
                        {famLabel(f)}
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => setFilterZero((v) => !v)}
                className={cn(
                  "inline-flex px-2.5 py-1 rounded-full text-xs border transition ml-1",
                  filterZero
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:bg-muted",
                )}
                title="Mostrar apenas clientes com pelo menos uma família em 0% (meta > 0 e realizado = 0)"
              >
                0%
              </button>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterQ(""); setFilterCats([]); setFilterFams([]); setFilterZero(false); }}>
                  <X className="h-4 w-4 mr-1" /> Limpar
                </Button>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {filteredView.length} de {view.length} clientes
              </span>
            </div>
          )}
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
                  <th className="text-center px-3 py-3 whitespace-nowrap min-w-[100px] bg-muted">Atingimento %</th>
                  {visibleFams.map((f) => (
                    <th key={f} className="text-center px-3 py-3 whitespace-nowrap min-w-[120px] bg-muted">
                      {famLabel(f)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!currentUpload ? (
                  <tr>
                    <td colSpan={3 + visibleFams.length} className="px-4 py-12 text-center text-muted-foreground">
                      {repId
                        ? 'Nenhuma planilha importada para este representante. Clique em "Nova planilha".'
                        : "Selecione um representante."}
                    </td>
                  </tr>
                ) : view.length === 0 ? (
                  <tr>
                    <td colSpan={3 + visibleFams.length} className="px-4 py-12 text-center text-muted-foreground">
                      Carregando…
                    </td>
                  </tr>
                ) : filteredView.length === 0 ? (
                  <tr>
                    <td colSpan={3 + visibleFams.length} className="px-4 py-12 text-center text-muted-foreground">
                      Nenhum cliente encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredView.map((r) => {
                      const rowIdx = view.indexOf(r);
                      const totalRow = familias.reduce((s, f) => s + (Number(r.metas?.[f]) || 0), 0);
                      const totalPctCls = r.total_pct_status ? FAROL_CELL_CLASS[r.total_pct_status] : "";
                      return (
                        <tr key={r.id ?? rowIdx} className="border-t border-border">
                          <td
                            title={r.razao_social}
                            className="px-3 py-2 font-medium sticky left-0 bg-background z-10 max-w-[280px]"
                          >
                            <div className="flex items-center gap-1">
                              <span className="truncate flex-1">{r.razao_social}</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      navigate({
                                        to: "/clientes-bi/$repId/$razao",
                                        params: {
                                          repId,
                                          razao: encodeURIComponent(r.razao_social),
                                        },
                                      })
                                    }
                                  >
                                    <BarChart3 className="h-4 w-4 mr-2" /> BI do cliente
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
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
                          <td className={cn("px-2 py-1 text-center", totalPctCls)}>
                            {r.total_pct_status ? (
                              <span className="inline-block px-2 py-0.5 rounded font-semibold text-xs">
                                {FAROL_FAIXA_TEXT[r.total_pct_status]}
                              </span>
                            ) : (
                              ""
                            )}
                          </td>
                          {visibleFams.map((f) => (
                            <MatrixCell
                              key={f}
                              row={r}
                              familia={f}
                              editing={editing}
                              viewMode={viewMode}
                              iaMode={
                                currentUpload?.origem === "ia" ||
                                currentUpload?.origem === "ia-atualizada"
                              }
                              onChange={(v) => updateCell(rowIdx, f, v)}
                            />
                          ))}
                        </tr>
                      );
                    })}
                    {(() => {
                      return null;
                    })()}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>


        {/* Histórico de versões do representante */}
        {repId && (
          <div className="surface rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setVersionsOpen((v) => !v)}
              className="w-full px-4 py-3 border-b border-border flex items-center justify-between hover:bg-muted/40 transition-colors"
              aria-expanded={versionsOpen}
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={cn("h-4 w-4 text-muted-foreground transition-transform", versionsOpen && "rotate-90")}
                />
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Histórico de versões deste representante
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{allVersions.length} versões</span>
            </button>
            {versionsOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Período</th>
                    <th className="text-left px-3 py-2">Origem</th>
                    <th className="text-left px-3 py-2">Arquivo / observação</th>
                    <th className="text-left px-3 py-2">Criada em</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {allVersions.map((v: any) => {
                    const isActive = v.id === effectiveUploadId;
                    const isReplaced = !!v.substituida_em;
                    return (
                      <tr key={v.id} className={cn("border-t border-border", isActive && "bg-muted/40")}>
                        <td className="px-3 py-2 font-medium">{v.periodo_label}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {v.origem === "manual_edit"
                            ? "Edição manual"
                            : v.origem === "restore"
                            ? "Restauração"
                            : "Importação"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{v.observacao ?? v.filename ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(v.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-3 py-2">
                          {isActive ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              Ativa
                            </span>
                          ) : isReplaced ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                              Substituída
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!isActive && (
                            <Button variant="ghost" size="sm" onClick={() => restoreVersion(v)}>
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {allVersions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                        Nenhuma versão ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}
      </div>
      )}



      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dlgMode === "replace" ? "Substituir versão atual" : "Nova planilha de performance"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <PeriodoPicker value={periodoObj} onChange={setPeriodoObj} required />
            <div>
              <Label>Planilha (.xlsx)</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                A cor de fundo de cada célula é lida e mapeada para o farol. Valores, ordem e categorias são preservados exatamente como no arquivo.
              </p>
            </div>
            {dlgMode === "replace" && (
              <p className="text-xs text-muted-foreground">
                A versão atual será arquivada (não excluída) e permanecerá no histórico.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDlgOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={busy}>
              {busy ? "Importando…" : dlgMode === "replace" ? "Substituir versão" : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PasswordConfirmDialog
        open={pwdOpen}
        onOpenChange={(v) => { setPwdOpen(v); if (!v) setPwdTargetRep(""); }}
        title="Excluir performance do representante"
        description="Todas as versões e dados de performance deste representante serão removidos. Digite a senha do gestor master para confirmar."
        onConfirmed={async () => { await deleteRepConfirmed(); }}
      />

      <AcoesSugeridasDialog
        open={acoesOpen}
        onOpenChange={setAcoesOpen}
        repId={repId}
        uploadId={currentUpload?.id ?? null}
        repName={reps.find((r: any) => r.id === repId)?.nome}
      />
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function MatrixCell({
  row,
  familia,
  editing,
  viewMode,
  iaMode = false,
  onChange,
}: {
  row: Row;
  familia: string;
  editing: boolean;
  viewMode: ViewMode;
  iaMode?: boolean;
  onChange: (v: number) => void;
}) {
  const meta = Number(row.metas?.[familia]) || 0;
  const real = Number(row.realizado?.[familia]) || 0;
  const pct = meta > 0 && real > 0 ? (real / meta) * 100 : null;
  const status: FarolStatus | null = pct != null ? statusFromPercent(pct) : row.metas_status?.[familia] ?? null;
  const cls = status ? FAROL_CELL_CLASS[status] : "";

  // Novo formato: célula mostra apenas a faixa (texto curto) com cor do farol.
  // - Uploads convencionais: quando não há meta nem realizado (planilha só com farol).
  // - Uploads gerados pela IA: sempre que houver farol e ainda não houver realizado.
  const isFaixaMode =
    !!row.metas_status?.[familia] && real === 0 && (iaMode || meta === 0);

  if (editing) {
    return (
      <td className={cn("px-1.5 py-1 text-right", cls)}>
        <input
          type="number"
          className="w-full bg-transparent border border-border/40 rounded px-1.5 py-1 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
          value={meta || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
      </td>
    );
  }

  if (isFaixaMode && status) {
    return (
      <td className={cn("px-2 py-1 text-center font-semibold text-xs", cls)}>
        {FAROL_FAIXA_TEXT[status]}
      </td>
    );
  }

  const display = (() => {
    if (viewMode === "meta") return meta > 0 ? fmtBRL(meta) : "";
    if (viewMode === "realizado") return real > 0 ? fmtBRL(real) : "";
    if (viewMode === "percentual") return pct != null ? `${pct.toFixed(1)}%` : "";
    if (real > 0 && meta > 0) return null;
    return meta > 0 ? fmtBRL(meta) : "";
  })();

  return (
    <td className={cn("px-3 py-2 text-right tabular-nums", cls)}>
      {viewMode === "completo" && real > 0 && meta > 0 ? (
        <div className="leading-tight">
          <div className="text-[10px] opacity-70">Meta: {fmtNum(meta)}</div>
          <div className="text-[10px] opacity-70">Real: {fmtNum(real)}</div>
          <div className="font-semibold">{pct != null ? `${pct.toFixed(1)}%` : ""}</div>
        </div>
      ) : (
        display
      )}
    </td>
  );
}
