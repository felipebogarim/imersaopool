import { supabase } from "@/integrations/supabase/client";
import {
  calculateClientBI,
  type PerformanceRow,
  type PerformanceVersion,
} from "./performance-bi-engine";
import { sanitizeRatio } from "./performance-metrics";
import { sortPerformanceVersions } from "./performance-periods";

export interface ResolvedClientCommercialData {
  status: "linked" | "not_found";
  clientId: string;
  razaoSocial: string | null;
  nomeFantasia?: string | null;
  representativeId?: string | null;
  categoria: string | null;
  geralPct: number | null;
  periodoLabel: string;
  familias: Array<{
    familia: string;
    pct: number;
    status: string;
  }>;
  source: "performance_bi" | "legacy_bi" | "client_record";
  versionId?: string | null;
}

/**
 * Resolve os dados comerciais e de atingimento de um cliente sempre
 * a partir do relatório mais recente do sistema (motor Performance → BI).
 * A categoria e atingimento do relatório mais recente sempre prevalecem.
 */
export async function resolveClientCommercialData(
  clientId: string,
  options?: {
    forcedRepresentativeId?: string | null;
    customSupabase?: typeof supabase;
  },
): Promise<ResolvedClientCommercialData | { status: "not_found" }> {
  const sb = options?.customSupabase || supabase;

  // 1. Busca cadastro canônico do cliente
  const { data: clientInfo } = await sb
    .from("clients")
    .select("id, razao_social, nome_fantasia, categoria, representative_id")
    .eq("id", clientId)
    .single();

  if (!clientInfo) {
    return { status: "not_found" };
  }

  const targetRepId = options?.forcedRepresentativeId || clientInfo.representative_id;
  const canonicalName = String(clientInfo.razao_social ?? "").trim().toUpperCase();

  let targetVersion: PerformanceVersion | null = null;
  let targetRow: PerformanceRow | null = null;

  // 2. Tenta buscar nas versões de Performance ativas do representante
  if (targetRepId) {
    const { data: repUploads } = await sb
      .from("rep_performance_uploads")
      .select(
        "id, representative_id, periodo_label, periodo_inicio, periodo_fim, created_at, familias, familia_participacao_categoria, categoria_participacao",
      )
      .eq("representative_id", targetRepId)
      .is("substituida_em", null)
      .order("periodo_fim", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (repUploads && repUploads.length > 0) {
      const sorted = sortPerformanceVersions(repUploads as unknown as PerformanceVersion[]);

      // Percorre das versões mais recentes para as mais antigas procurando a linha do cliente
      for (const ver of sorted) {
        const { data: rows } = await sb
          .from("rep_performance_rows")
          .select("id, razao_social, categoria, ordem, familia_pct, metas_status, total_pct, total_pct_status")
          .eq("upload_id", ver.id);

        const found = (rows ?? []).find(
          (r: any) => String(r.razao_social ?? "").trim().toUpperCase() === canonicalName,
        );

        if (found) {
          targetVersion = ver;
          targetRow = found as unknown as PerformanceRow;
          break;
        }
      }
    }
  }

  // 3. Se não achou com o representante direto, busca globalmente em rep_performance_rows pela Razão Social
  if (!targetRow) {
    const { data: directRows } = await sb
      .from("rep_performance_rows")
      .select(
        `
        id, 
        razao_social, 
        categoria, 
        ordem, 
        familia_pct, 
        metas_status, 
        total_pct, 
        total_pct_status,
        upload_id
      `,
      )
      .ilike("razao_social", `%${clientInfo.razao_social}%`)
      .limit(20);

    const matchingRows = (directRows ?? []).filter(
      (r: any) => String(r.razao_social ?? "").trim().toUpperCase() === canonicalName,
    );

    if (matchingRows.length > 0) {
      const uploadIds = Array.from(new Set(matchingRows.map((r: any) => r.upload_id)));
      const { data: uploads } = await sb
        .from("rep_performance_uploads")
        .select(
          "id, representative_id, periodo_label, periodo_inicio, periodo_fim, created_at, familias, familia_participacao_categoria, categoria_participacao, substituida_em",
        )
        .in("id", uploadIds)
        .is("substituida_em", null);

      if (uploads && uploads.length > 0) {
        const sortedUploads = sortPerformanceVersions(uploads as unknown as PerformanceVersion[]);
        const latestUpload = sortedUploads[0];
        const row = matchingRows.find((r: any) => r.upload_id === latestUpload.id);
        if (row && latestUpload) {
          targetVersion = latestUpload;
          targetRow = row as unknown as PerformanceRow;
        }
      }
    }
  }

  // 4. Se encontrou linha em Performance BI (fonte de verdade primária)
  if (targetVersion && targetRow) {
    const bi = calculateClientBI(targetVersion, targetRow);
    const resolvedCategoria = targetRow.categoria || clientInfo.categoria || null;

    // Sincroniza em background a categoria do cliente se estiver desatualizada no cadastro
    const catVal = targetRow.categoria;
    if (
      catVal &&
      ["Black", "Gold", "Silver"].includes(catVal) &&
      catVal !== clientInfo.categoria
    ) {
      void (async () => {
        try {
          await (sb as any)
            .from("clients")
            .update({ categoria: catVal })
            .eq("id", clientInfo.id);
        } catch (err) {
          console.warn("[resolveClientCommercialData] Falha ao sincronizar categoria do cliente:", err);
        }
      })();
    }

    let geralPct: number | null = null;
    if (targetRow.total_pct != null) {
      const sanitized = sanitizeRatio(targetRow.total_pct);
      geralPct = sanitized != null ? sanitized * 100 : null;
    }
    if (geralPct == null && bi.atingimento_geral_ratio != null) {
      geralPct = bi.atingimento_geral_ratio * 100;
    }

    const familias = (bi.familias ?? []).map((f) => ({
      familia: f.familia,
      pct: f.atingimento_ratio != null ? f.atingimento_ratio * 100 : 0,
      status: f.farol ?? "normal",
    }));

    return {
      status: "linked",
      clientId: clientInfo.id,
      razaoSocial: targetRow.razao_social || clientInfo.razao_social,
      nomeFantasia: clientInfo.nome_fantasia,
      representativeId: targetVersion.representative_id || targetRepId || clientInfo.representative_id,
      categoria: resolvedCategoria,
      geralPct,
      periodoLabel: targetVersion.periodo_label || "Período recente",
      familias,
      source: "performance_bi",
      versionId: targetVersion.id,
    };
  }

  // 5. Fallback para client_bi_uploads (artefatos legados)
  const { data: biUpload } = await (sb as any)
    .from("client_bi_uploads")
    .select("data, representative_id, razao_social")
    .eq("razao_social", clientInfo.razao_social)
    .eq("kind", "bi")
    .is("substituida_em", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const biPayload = biUpload?.data as any;

  if (biPayload) {
    const resolvedCategoria = biPayload?.categoria || clientInfo.categoria || null;
    const familias = Array.isArray(biPayload?.familias)
      ? biPayload.familias.map((item: any) => ({
          familia: String(item.familia ?? ""),
          pct:
            Math.abs(Number(item.atingimento ?? 0)) <= 1.5
              ? Number(item.atingimento ?? 0) * 100
              : Number(item.atingimento ?? 0),
          status: item.farol ?? "normal",
        }))
      : [];

    const geralRaw = biPayload?.geral != null ? Number(biPayload.geral) : null;
    const geralPct =
      geralRaw == null ? null : Math.abs(geralRaw) <= 1.5 ? geralRaw * 100 : geralRaw;

    return {
      status: "linked",
      clientId: clientInfo.id,
      razaoSocial: clientInfo.razao_social || biUpload?.razao_social,
      nomeFantasia: clientInfo.nome_fantasia,
      representativeId: targetRepId || clientInfo.representative_id || biUpload?.representative_id,
      categoria: resolvedCategoria,
      geralPct,
      periodoLabel: biPayload?.periodo || "1º Semestre 2026",
      familias,
      source: "legacy_bi",
    };
  }

  // 6. Fallback final apenas com os dados do cadastro do cliente
  return {
    status: "linked",
    clientId: clientInfo.id,
    razaoSocial: clientInfo.razao_social,
    nomeFantasia: clientInfo.nome_fantasia,
    representativeId: targetRepId || clientInfo.representative_id,
    categoria: clientInfo.categoria,
    geralPct: null,
    periodoLabel: "1º Semestre 2026",
    familias: [],
    source: "client_record",
  };
}
