import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FAROL_CELL_CLASS, FAROL_MIDPOINT, type FarolStatus } from "@/lib/performance-farol";

export const Route = createFileRoute("/_authenticated/performance/bi-clientes")({
  head: () => ({ meta: [{ title: "BI Clientes Consolidado — PoolFlux" }] }),
  component: BIClientesPage,
});

function BIClientesPage() {
  const [search, setSearch] = useState("");
  const [repFilter, setRepFilter] = useState("all");

  const { data: reps = [] } = useQuery({
    queryKey: ["all-reps"],
    queryFn: async () => {
      const { data } = await supabase.from("representatives").select("id, nome").order("nome");
      return data ?? [];
    },
  });

  const { data: uploads = [], isLoading: loadingUploads } = useQuery({
    queryKey: ["all-performance-uploads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rep_performance_uploads")
        .select("id, representative_id, familias")
        .is("substituida_em", null);
      return data ?? [];
    },
  });

  const uploadIds = useMemo(() => uploads.map((u) => u.id), [uploads]);

  const { data: allRows = [], isLoading: loadingRows } = useQuery({
    queryKey: ["all-performance-rows", uploadIds],
    enabled: uploadIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("rep_performance_rows")
        .select("*")
        .in("upload_id", uploadIds)
        .order("razao_social");
      return data ?? [];
    },
  });

  const consolidated = useMemo(() => {
    const SUMMARY_PREFIXES = ["PARTICIPA", "ATINGIMENTO", "TOTAL", "ESTIMATIVA", "FAIXA"];
    const CANONICAL_FAMILIES = [
      "DECOR NEWLINE",
      "DECOR STUDIO",
      "SISTEMAS E MÓDULOS",
      "PRO LED",
      "PRO LAMP",
      "PERFIL",
      "FITAS E FONTES",
    ];

    return allRows
      .filter((r) => {
        const u = String(r.razao_social ?? "").trim().toUpperCase();
        return !SUMMARY_PREFIXES.some((p) => u.startsWith(p));
      })
      .map((r) => {
        const upload = uploads.find((u) => u.id === r.upload_id);
        const rep = reps.find((rp) => rp.id === upload?.representative_id);
        
        // Se total_pct for 0 mas houver metas_status preenchido, calculamos via ponto médio do farol
        let attainedPct = r.total_pct ? Number(r.total_pct) * 100 : 0;
        
        if (attainedPct === 0 && r.metas_status && typeof r.metas_status === 'object') {
          const ms = r.metas_status as Record<string, FarolStatus>;
          let totalWeight = 0;
          let totalPoints = 0;
          
          CANONICAL_FAMILIES.forEach(f => {
            const status = ms[f];
            if (status && status !== 'sem_compra') {
              totalPoints += FAROL_MIDPOINT[status];
              totalWeight += 1;
            }
          });
          
          if (totalWeight > 0) {
            attainedPct = totalPoints / totalWeight;
          }
        }

        return {
          ...r,
          repName: rep?.nome ?? "—",
          repId: upload?.representative_id,
          familias: upload?.familias as string[] ?? [],
          computedAtainment: attainedPct,
        };
      });
  }, [allRows, uploads, reps]);

  const filtered = useMemo(() => {
    return consolidated.filter((r) => {
      const matchSearch = r.razao_social?.toLowerCase().includes(search.toLowerCase());
      const matchRep = repFilter === "all" || r.repId === repFilter;
      return matchSearch && matchRep;
    });
  }, [consolidated, search, repFilter]);

  const columns = [
    "DECOR NEWLINE",
    "DECOR STUDIO",
    "SISTEMAS E MÓDULOS",
    "PRO LED",
    "PRO LAMP",
    "PERFIL",
    "FITAS E FONTES",
  ];

  const isLoading = loadingUploads || loadingRows;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <PageHeader
        title="BI Clientes Consolidado"
        subtitle="Visão geral de performance de todos os clientes ativos"
      />
      
      <div className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-end bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pesquisar Cliente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Razão Social..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <div className="w-full md:w-64 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Representante</label>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Representantes</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="surface rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-tighter text-[10px] w-64 sticky left-0 bg-muted/50 z-10 border-r border-border/50">Cliente</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-tighter text-[10px] border-r border-border/50">Rep</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-tighter text-[10px] border-r border-border/50 text-center">Cat</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-tighter text-[10px] text-center border-r border-border/50">Ating %</th>
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-3 font-semibold text-muted-foreground uppercase tracking-tighter text-[10px] text-center min-w-[100px] border-r border-border/50 last:border-r-0">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={columns.length + 4} className="px-4 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span>Consolidando dados dos clientes...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 4} className="px-4 py-12 text-center text-muted-foreground">
                      Nenhum dado encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-2.5 font-medium sticky left-0 bg-background group-hover:bg-muted/30 z-10 border-r border-border/50">
                        <div className="truncate max-w-[240px]" title={row.razao_social}>{row.razao_social}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground border-r border-border/50 whitespace-nowrap">{row.repName}</td>
                      <td className="px-4 py-2.5 text-center border-r border-border/50">
                        {row.categoria ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-muted/50">
                            {row.categoria}
                          </span>
                        ) : "—"}
                      </td>
                      <td className={cn(
                        "px-4 py-2.5 text-center font-bold border-r border-border/50 tabular-nums",
                        row.total_pct_status && FAROL_CELL_CLASS[row.total_pct_status as FarolStatus]
                      )}>
                        {row.computedAtainment > 0 ? `${row.computedAtainment.toFixed(1)}%` : "0%"}
                      </td>
                      {columns.map((col) => {
                        const metasStatus = row.metas_status as Record<string, FarolStatus>;
                        const status = metasStatus?.[col];
                        
                        // O campo correto no banco é familia_pct (conforme erro acima e tipos do Supabase)
                        const familyPct = row.familia_pct && typeof row.familia_pct === 'object' 
                          ? (row.familia_pct as Record<string, any>)[col] 
                          : null;

                        return (
                          <td 
                            key={col} 
                            className={cn(
                              "px-3 py-2.5 text-center text-[10px] border-r border-border/50 last:border-r-0 tabular-nums font-bold",
                              status && FAROL_CELL_CLASS[status]
                            )}
                          >
                            {familyPct !== null && familyPct !== undefined 
                              ? `${(Number(familyPct) * 100).toFixed(1)}%`
                              : status === "sem_compra" 
                                ? "0%" 
                                : status 
                                  ? `${FAROL_MIDPOINT[status]}%` 
                                  : "0%"}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
