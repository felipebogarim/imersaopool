// Carteira da área Metas: versão mais recente de cada representante (mesma regra do BI de
// Clientes), sem linhas de resumo da planilha. Compartilhada pela lista e pelo BI Metas.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FarolStatus } from "@/lib/performance-farol";
import { sanitizeRatio } from "@/lib/performance-metrics";
import { getLatestActiveVersionByRep } from "@/lib/performance-periods";
import { isClientRow } from "@/lib/client-row-filter";

export type CarteiraRow = {
  id: string;
  razao_social: string;
  categoria: string | null;
  repId: string | null;
  repName: string;
  totalPct: number | null;
  familiaPct: Record<string, number | null>;
  metasStatus: Record<string, FarolStatus | null>;
};

export function useMetasCarteira(restrictToRepIds: string[] | null) {
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

  const rows: CarteiraRow[] = useMemo(() => {
    const repById = new Map(reps.map((r) => [r.id, r.nome]));
    const repByUpload = new Map(uploads.map((u) => [u.id, u.representative_id]));
    return allRows
      .filter((r) => isClientRow(r))
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

  return { rows, visibleReps, isLoading: loadingUploads || loadingRows };
}
