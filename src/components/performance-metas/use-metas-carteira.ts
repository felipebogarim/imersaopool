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
  revisadoCompleto: boolean;
  metasSalvasCount: number;
  /** Gestor marcou "Em investigação" (investigação detalhada antes de definir a meta). */
  emInvestigacao: boolean;
};

type InvestigacoesClient = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (
        col: string,
        v: boolean,
      ) => PromiseLike<{
        data: Array<{ representative_id: string; cliente_key: string }> | null;
        error: unknown;
      }>;
    };
  };
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

  // Metas salvas/revisadas pelo gestor no ciclo vigente (por representante e cliente)
  const { data: reviewedMap = new Map<string, { count: number; completo: boolean }>() } = useQuery({
    queryKey: ["performance-metas", "reviewed-status"],
    queryFn: async () => {
      try {
        const { data: cycles, error } = await supabase
          .from("performance_goal_cycles")
          .select(
            `
            id,
            representative_id,
            cliente_key,
            inicio,
            fim,
            performance_goal_items (
              familia,
              meta_mensal
            )
          `,
          )
          .order("inicio", { ascending: false });

        if (error || !cycles) {
          return new Map<string, { count: number; completo: boolean }>();
        }

        const map = new Map<string, { count: number; completo: boolean }>();
        for (const c of cycles) {
          const key = `${c.representative_id}|${c.cliente_key}`;
          if (map.has(key)) continue;

          const items = (c.performance_goal_items ?? []) as Array<{
            familia: string;
            meta_mensal: number | null;
          }>;
          const savedFamilies = new Set(
            items.filter((i) => i.meta_mensal != null).map((i) => i.familia),
          );
          const count = savedFamilies.size;
          map.set(key, { count, completo: count >= 7 });
        }
        return map;
      } catch {
        return new Map<string, { count: number; completo: boolean }>();
      }
    },
  });

  // Clientes marcados "Em investigação" (tabela fora dos tipos gerados; sem migration → vazio).
  const { data: investigacoes = new Set<string>() } = useQuery({
    queryKey: ["performance-metas", "investigacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as InvestigacoesClient)
        .from("performance_goal_investigations")
        .select("representative_id, cliente_key")
        .eq("em_investigacao", true);
      if (error || !data) return new Set<string>();
      return new Set(data.map((i) => `${i.representative_id}|${i.cliente_key}`));
    },
  });

  const rows: CarteiraRow[] = useMemo(() => {
    const repById = new Map(reps.map((r) => [r.id, r.nome]));
    const repByUpload = new Map(uploads.map((u) => [u.id, u.representative_id]));
    return allRows
      .filter((r) => isClientRow(r))
      .map((r) => {
        const repId = repByUpload.get(r.upload_id) ?? null;
        const clienteKey = r.razao_social ? r.razao_social.trim().toUpperCase() : "";
        const revStatus = repId ? reviewedMap.get(`${repId}|${clienteKey}`) : undefined;
        const metasSalvasCount = revStatus?.count ?? 0;
        const revisadoCompleto = revStatus?.completo ?? false;

        return {
          id: r.id,
          razao_social: r.razao_social,
          categoria: r.categoria,
          repId,
          repName: (repId && repById.get(repId)) || "—",
          totalPct: sanitizeRatio(r.total_pct),
          familiaPct: (r.familia_pct ?? {}) as Record<string, number | null>,
          metasStatus: (r.metas_status ?? {}) as Record<string, FarolStatus | null>,
          revisadoCompleto,
          metasSalvasCount,
          emInvestigacao: repId ? investigacoes.has(`${repId}|${clienteKey}`) : false,
        };
      })
      .filter((r) => !restrictToRepIds || (r.repId != null && restrictToRepIds.includes(r.repId)));
  }, [allRows, uploads, reps, restrictToRepIds, reviewedMap, investigacoes]);

  const visibleReps = useMemo(
    () => (restrictToRepIds ? reps.filter((r) => restrictToRepIds.includes(r.id)) : reps),
    [reps, restrictToRepIds],
  );

  return { rows, visibleReps, isLoading: loadingUploads || loadingRows };
}
