// Hooks de acesso ao motor Performance → BI.
// Toda leitura parte SEMPRE de uma versão de Performance (rep_performance_uploads)
// e das linhas normalizadas (rep_performance_rows). Nenhum artefato antigo de BI
// (Excel/JSON) participa do cálculo.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateClientBI,
  calculateRepresentativeBI,
  type ClientBIResult,
  type PerformanceRow,
  type PerformanceVersion,
  type RepresentativeBIResult,
} from "./performance-bi-engine";

export const PERFORMANCE_BI_KEY = "performance-bi";

async function fetchVersion(repId: string, versionId?: string | null) {
  let q = supabase
    .from("rep_performance_uploads")
    .select(
      "id, representative_id, periodo_label, periodo_inicio, periodo_fim, created_at, familias, familia_participacao_categoria, categoria_participacao",
    )
    .eq("representative_id", repId);
  q = versionId ? q.eq("id", versionId) : q.is("substituida_em", null);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as PerformanceVersion | null) ?? null;
}

async function fetchRows(versionId: string): Promise<PerformanceRow[]> {
  const { data, error } = await supabase
    .from("rep_performance_rows")
    .select(
      "razao_social, categoria, ordem, metas, realizado, familia_pct, metas_status, total_pct, total_pct_status",
    )
    .eq("upload_id", versionId)
    .order("ordem", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PerformanceRow[];
}

/** Versão de Performance ativa (ou a versão explicitamente selecionada). */
export function usePerformanceVersion(repId: string, versionId?: string | null) {
  return useQuery({
    queryKey: [PERFORMANCE_BI_KEY, "version", repId, versionId ?? "active"],
    enabled: !!repId,
    queryFn: () => fetchVersion(repId, versionId),
  });
}

/** BI de um cliente, derivado exclusivamente da versão de Performance. */
export function useClientBI(repId: string, razaoSocial: string, versionId?: string | null) {
  return useQuery<ClientBIResult | null>({
    queryKey: [PERFORMANCE_BI_KEY, "client", repId, razaoSocial, versionId ?? "active"],
    enabled: !!repId && !!razaoSocial,
    queryFn: async () => {
      const version = await fetchVersion(repId, versionId);
      if (!version) return null;
      const rows = await fetchRows(version.id);
      const target = String(razaoSocial).trim().toUpperCase();
      const row =
        rows.find((r) => String(r.razao_social ?? "").trim().toUpperCase() === target) ?? null;
      if (!row) return null;
      return calculateClientBI(version, row);
    },
  });
}

/** BI do representante, derivado exclusivamente da versão de Performance. */
export function useRepresentativeBI(repId: string, versionId?: string | null) {
  return useQuery<{ version: PerformanceVersion; bi: RepresentativeBIResult } | null>({
    queryKey: [PERFORMANCE_BI_KEY, "rep", repId, versionId ?? "active"],
    enabled: !!repId,
    queryFn: async () => {
      const version = await fetchVersion(repId, versionId);
      if (!version) return null;
      const rows = await fetchRows(version.id);
      return { version, bi: calculateRepresentativeBI(version, rows) };
    },
  });
}

/** "Atualizar BI" = recalcular a partir da versão selecionada (nunca restaurar dados antigos). */
export function useRecalcBI() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [PERFORMANCE_BI_KEY] });
}

/** BIs de todos os clientes da versão de Performance (base para comparativos). */
export function useAllClientBIs(repId: string, versionId?: string | null) {
  return useQuery<{ version: PerformanceVersion; bis: ClientBIResult[] } | null>({
    queryKey: [PERFORMANCE_BI_KEY, "clients", repId, versionId ?? "active"],
    enabled: !!repId,
    queryFn: async () => {
      const version = await fetchVersion(repId, versionId);
      if (!version) return null;
      const rows = await fetchRows(version.id);
      return { version, bis: rows.map((r) => calculateClientBI(version, r)) };
    },
  });
}
