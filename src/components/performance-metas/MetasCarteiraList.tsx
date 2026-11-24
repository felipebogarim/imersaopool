// Listagem da carteira para a área Metas: espelho funcional do BI de Clientes
// (mesmas fontes de dados, mesmos filtros), com acesso ao painel individual.
// Somente leitura — usa percentuais e faróis já publicados, nunca valores em R$.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Target, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  FAROL_CELL_CLASS,
  catBadge,
  statusFromRatio,
  type FarolStatus,
} from "@/lib/performance-farol";
import { sanitizeRatio } from "@/lib/performance-metrics";
import { getLatestActiveVersionByRep } from "@/lib/performance-periods";
import { METAS_FAMILIES, METAS_FAMILY_LABEL, fmtPct } from "@/lib/performance-metas";
import { FilterChip } from "./FilterChip";

const SUMMARY_PREFIXES = ["PARTICIPA", "ATINGIMENTO", "TOTAL", "ESTIMATIVA", "FAIXA"];

type ListRow = {
  id: string;
  razao_social: string;
  categoria: string | null;
  repId: string | null;
  repName: string;
  totalPct: number | null;
  familiaPct: Record<string, number | null>;
  metasStatus: Record<string, FarolStatus | null>;
};

export function MetasCarteiraList({
  restrictToRepIds,
}: {
  /** Quando definido, mostra apenas clientes desses representantes (visão do representante). */
  restrictToRepIds: string[] | null;
}) {
  const [search, setSearch] = useState("");
  const [repFilter, setRepFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [familyFilter, setFamilyFilter] = useState<string[]>([]);
  const [zeroFilter, setZeroFilter] = useState(false);

  const { data: reps = [] } = useQuery({
    queryKey: ["performance-metas", "reps"],
    queryFn: async () => {
      const { data } = await supabase.from("representatives").select("id, nome").order("nome");
      return data ?? [];
    },
  });

  const { data: uploads = [], isLoading: loadingUploads } = useQuery({
    queryKey: ["performance-metas", "uploads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rep_performance_uploads")
        .select("id, representative_id, familias, periodo_fim, periodo_label, created_at")
        .is("substituida_em", null)
        .order("periodo_fim", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      return Array.from(getLatestActiveVersionByRep(data ?? []).values());
    },
  });

  const uploadIds = useMemo(() => uploads.map((u) => u.id), [uploads]);

  const { data: allRows = [], isLoading: loadingRows } = useQuery({
    queryKey: ["performance-metas", "rows", uploadIds],
    enabled: uploadIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("rep_performance_rows")
        .select("id, upload_id, razao_social, categoria, total_pct, familia_pct, metas_status")
        .in("upload_id", uploadIds)
        .order("razao_social");
      return data ?? [];
    },
  });

  const rows: ListRow[] = useMemo(() => {
    const repById = new Map(reps.map((r) => [r.id, r.nome]));
    const repByUpload = new Map(uploads.map((u) => [u.id, u.representative_id]));
    return allRows
      .filter((r) => {
        const u = String(r.razao_social ?? "")
          .trim()
          .toUpperCase();
        return !SUMMARY_PREFIXES.some((p) => u.startsWith(p));
      })
      .map((r) => {
        const repId = repByUpload.get(r.upload_id) ?? null;
        return {
          id: r.id,
          razao_social: r.razao_social,
          categoria: r.categoria,
          repId,
          repName: (repId && repById.get(repId)) || "—",
          totalPct: sanitizeRatio(r.total_pct),
          familiaPct: (r.familia_pct ?? {}) as Record<string, number | null>,
          metasStatus: (r.metas_status ?? {}) as Record<string, FarolStatus | null>,
        };
      })
      .filter((r) => !restrictToRepIds || (r.repId != null && restrictToRepIds.includes(r.repId)));
  }, [allRows, uploads, reps, restrictToRepIds]);

  const visibleReps = useMemo(
    () => (restrictToRepIds ? reps.filter((r) => restrictToRepIds.includes(r.id)) : reps),
    [reps, restrictToRepIds],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.razao_social.toLowerCase().includes(q)) return false;
      if (repFilter !== "all" && r.repId !== repFilter) return false;
      if (categoryFilter.length && !(r.categoria && categoryFilter.includes(r.categoria)))
        return false;
      if (
        familyFilter.length &&
        !familyFilter.some((f) => r.metasStatus[f] && r.metasStatus[f] !== "sem_compra")
      )
        return false;
      if (
        zeroFilter &&
        !((r.totalPct ?? 0) === 0 || Object.values(r.metasStatus).includes("sem_compra"))
      )
        return false;
      return true;
    });
  }, [rows, search, repFilter, categoryFilter, familyFilter, zeroFilter]);

  const isLoading = loadingUploads || loadingRows;
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <div className="flex-1 min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pesquisar Cliente
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Razão Social ou palavra-chave..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-full md:w-64 md:shrink-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Representante
            </label>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Representantes</SelectItem>
                {visibleReps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
          {["Black", "Gold", "Silver"].map((cat) => (
            <FilterChip
              key={cat}
              active={categoryFilter.includes(cat)}
              onClick={() => setCategoryFilter((p) => toggle(p, cat))}
            >
              {cat}
            </FilterChip>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          {METAS_FAMILIES.map((fam) => (
            <FilterChip
              key={fam}
              active={familyFilter.includes(fam)}
              onClick={() => setFamilyFilter((p) => toggle(p, fam))}
            >
              {fam}
            </FilterChip>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          <Badge
            variant={zeroFilter ? "destructive" : "outline"}
            className={cn(
              "cursor-pointer px-3 py-1 text-[10px] uppercase font-bold tracking-tight",
              !zeroFilter && "hover:bg-destructive/10 text-destructive border-destructive/30",
            )}
            onClick={() => setZeroFilter((z) => !z)}
          >
            0%
            {zeroFilter && <X className="ml-1.5 h-3 w-3 inline-block" />}
          </Badge>
          {(categoryFilter.length > 0 || familyFilter.length > 0 || zeroFilter) && (
            <button
              onClick={() => {
                setCategoryFilter([]);
                setFamilyFilter([]);
                setZeroFilter(false);
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-auto"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="surface rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-[10px] uppercase tracking-tighter text-muted-foreground">
                <th className="px-3 sm:px-4 py-3 font-semibold w-40 sm:w-64 sticky left-0 bg-muted/50 z-10 border-r border-border/50">
                  Cliente
                </th>
                <th className="px-3 sm:px-4 py-3 font-semibold border-r border-border/50">Rep</th>
                <th className="px-2 sm:px-4 py-3 font-semibold border-r border-border/50 text-center">
                  Cat
                </th>
                <th className="px-2 sm:px-4 py-3 font-semibold border-r border-border/50 text-center">
                  Ating %
                </th>
                {METAS_FAMILIES.map((f) => (
                  <th
                    key={f}
                    className="px-3 py-3 font-semibold text-center min-w-[96px] border-r border-border/50"
                  >
                    {METAS_FAMILY_LABEL[f]}
                  </th>
                ))}
                <th className="px-3 py-3 font-semibold text-center">Metas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={METAS_FAMILIES.length + 5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span>Carregando carteira...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={METAS_FAMILIES.length + 5}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {restrictToRepIds && restrictToRepIds.length === 0
                      ? "Nenhum representante vinculado ao seu usuário."
                      : "Nenhum cliente encontrado para os filtros selecionados."}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const totalStatus = statusFromRatio(row.totalPct);
                  return (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-3 sm:px-4 py-2.5 font-medium sticky left-0 bg-background group-hover:bg-muted/30 z-10 border-r border-border/50">
                        <Link
                          to="/performance/metas/$rowId"
                          params={{ rowId: row.id }}
                          className="block truncate max-w-[150px] sm:max-w-[240px] hover:text-primary hover:underline underline-offset-2"
                          title={row.razao_social}
                        >
                          {row.razao_social}
                        </Link>
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-xs text-muted-foreground border-r border-border/50 whitespace-nowrap">
                        {row.repName}
                      </td>
                      <td className="px-2 sm:px-4 py-2.5 text-center border-r border-border/50">
                        {row.categoria ? (
                          <span
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                              catBadge(row.categoria),
                            )}
                          >
                            {row.categoria}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-2 sm:px-4 py-2.5 text-center font-bold border-r border-border/50 tabular-nums whitespace-nowrap",
                          totalStatus && FAROL_CELL_CLASS[totalStatus],
                        )}
                      >
                        {fmtPct(row.totalPct)}
                      </td>
                      {METAS_FAMILIES.map((f) => {
                        const ratio = sanitizeRatio(row.familiaPct[f]);
                        const status = statusFromRatio(ratio);
                        return (
                          <td
                            key={f}
                            className={cn(
                              "px-3 py-2.5 text-center text-[10px] border-r border-border/50 tabular-nums font-bold",
                              status && FAROL_CELL_CLASS[status],
                            )}
                          >
                            {fmtPct(ratio)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center">
                        <Link
                          to="/performance/metas/$rowId"
                          params={{ rowId: row.id }}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                        >
                          <Target className="h-3.5 w-3.5" /> Abrir
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {filtered.length} cliente(s) · Performance exibida a partir da versão mais recente de cada
        representante.
      </p>
    </div>
  );
}
