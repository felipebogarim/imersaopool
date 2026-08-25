// ============================================================================
// MOTOR CENTRAL — PERFORMANCE → BI
//
// Princípio: a Performance é a fonte única de verdade. O BI nunca possui
// verdade própria: é sempre uma função pura de uma versão de Performance.
//
//   BI = f(PerformanceVersion, CalculationVersion)
//
// Nenhum resultado pronto (Excel/JSON antigo de BI) participa deste motor.
// ============================================================================

import {
  FAROL_LABEL,
  FAROL_ORDER,
  type FarolStatus,
} from "./performance-farol";
import { normalizeFamilyName } from "./client-bi-familias";
import {
  FAROL_COEFFICIENT,
  METRICS_VERSION,
  calculateClientMetrics,
  calculateRepresentativeMetrics,
  classifyFarol as classifyFarolMetric,
  extremesByRealAchievement,
  getFarolCoefficient as getFarolCoefficientMetric,
  type MetricsObject,
} from "./performance-metrics";

/** Versão da metodologia de cálculo. Alterar quando as regras mudarem. */
export const CALCULATION_VERSION = METRICS_VERSION;

/** Coeficiente analítico do farol (índice do BI). NÃO é atingimento real. */
export { FAROL_COEFFICIENT };


// ============================ Tipos de entrada ==============================

export type PerformanceVersion = {
  id: string;
  representative_id?: string | null;
  periodo_label?: string | null;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  created_at?: string | null;
  familias?: string[] | null;
  /** Peso relativo (0..1) de cada família dentro de cada categoria. */
  familia_participacao_categoria?: Record<string, Record<string, number>> | null;
  categoria_participacao?: Record<string, number> | null;
};

export type PerformanceRow = {
  razao_social: string;
  categoria?: string | null;
  ordem?: number | null;
  /** Meta monetária por família (pode estar indisponível por sigilo). */
  metas?: Record<string, number> | null;
  /** Realizado monetário por família (pode estar indisponível por sigilo). */
  realizado?: Record<string, number> | null;
  /** Atingimento real por família, em ratio canônico (1 = 100%). */
  familia_pct?: Record<string, number | null> | null;
  /** Farol por família quando o percentual não existe na origem. */
  metas_status?: Record<string, string | null> | null;
  total_pct?: number | null;
  total_pct_status?: string | null;
};


// ============================ Tipos de saída ================================

export type FamiliaBI = {
  familia: string;
  /** Atingimento REAL (realizado / meta). Pode ser > 1. `null` = sem informação. */
  atingimento_ratio: number | null;
  farol: FarolStatus | null;
  /** Coeficiente analítico do farol (0..1.1). Nunca substitui o atingimento real. */
  coeficiente_farol: number | null;
  /** Peso da meta da família (proxy financeiro seguro, sem expor R$). */
  meta_peso: number;
  /** meta_peso × coeficiente_farol */
  indice_ponderado: number;
  /** indice_ponderado / Σ indices do cliente (0..1) */
  participacao: number | null;
};

export type ClientBIResult = {
  performance_version_id: string;
  calculation_version: string;
  calculated_at: string;
  periodo_label: string | null;
  cliente: string;
  categoria: string | null;
  familias: FamiliaBI[];
  /** Objeto padrão de métricas (governança única). */
  metrics: MetricsObject;
  /** Índice analítico do cliente (ponderado pelo coeficiente do farol). */
  indice_geral: number | null;
  /** Atingimento REAL ponderado pelas metas. */
  atingimento_geral_ratio: number | null;
  /** Farol derivado do atingimento real do cliente. */
  farol: FarolStatus | null;
  melhor_familia: { label: string | null; labels: string[]; atingimento_ratio: number | null };
  pior_familia: { label: string | null; labels: string[]; atingimento_ratio: number | null };
  distribuicao_farol: Array<{ grupo: string; status: FarolStatus; quantidade: number }>;
  erros: string[];

};

export type FamilyShare = {
  familyKey: string;
  familyName: string;
  shareRatio: number;
  attainmentRatio: number | null;
  metaTotal?: number;
};

export type RepresentativeBIResult = {
  performance_version_id: string;
  calculation_version: string;
  calculated_at: string;
  periodo_label: string | null;
  clientes: Array<{
    razao_social: string;
    categoria: string | null;
    indice: number | null;
    atingimento_ratio: number | null;
    farol: FarolStatus | null;
  }>;
  categorias: Array<{
    categoria: string;
    participacao: number | null;
    atingimento: number | null;
    indice: number | null;
  }>;
  farol: Array<{ grupo: string; status: FarolStatus; participacao: number | null; quantidade: number }>;
  familiasPorCategoria: Record<string, FamilyShare[]>;
  /** Consolidado por família (todas as categorias). */
  familias: Array<{ familia: string; shareRatio: number; attainmentRatio: number | null; metaTotal: number }>;
  /** Objeto padrão de métricas do representante (governança única). */
  metrics: MetricsObject;
  /** Métricas detalhadas por nível (clientes, famílias, categorias). */
  detalhado: ReturnType<typeof calculateRepresentativeMetrics>;
  indice_geral: number | null;
  atingimento_geral_ratio: number | null;
  erros: string[];
};

// ============================ Funções básicas ===============================

/** Classificação oficial do farol a partir do atingimento real (ratio). */
export function classifyFarol(ratio: number | null | undefined): FarolStatus | null {
  return classifyFarolMetric(ratio);
}

export function getFarolCoefficient(status: FarolStatus | null | undefined): number | null {
  return getFarolCoefficientMetric(status);

}

const asStatus = (v: unknown): FarolStatus | null =>
  typeof v === "string" && (FAROL_ORDER as string[]).includes(v) ? (v as FarolStatus) : null;

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Famílias da versão (ordem oficial da própria Performance). */
export function versionFamilies(version: PerformanceVersion, rows: PerformanceRow[] = []): string[] {
  const out: string[] = [];
  const push = (f: unknown) => {
    const name = String(f ?? "").trim();
    if (name && !out.includes(name)) out.push(name);
  };
  (version.familias ?? []).forEach(push);
  if (out.length === 0) {
    for (const cat of Object.values(version.familia_participacao_categoria ?? {}))
      Object.keys(cat ?? {}).forEach(push);
  }
  if (out.length === 0) {
    for (const r of rows) {
      Object.keys(r.familia_pct ?? {}).forEach(push);
      Object.keys(r.metas_status ?? {}).forEach(push);
    }
  }
  return out;
}

/**
 * Peso da meta de uma família dentro da categoria.
 * Usa a participação estrutural declarada pela própria versão de Performance;
 * na ausência dela, distribui o peso igualmente entre as famílias.
 */
export function familyMetaWeight(
  version: PerformanceVersion,
  categoria: string | null | undefined,
  familia: string,
  familiasCount: number,
): number {
  const table = version.familia_participacao_categoria ?? null;
  const cat = String(categoria ?? "").trim();
  const byCat = (table && (table[cat] ?? table[cat.toLowerCase()] ?? null)) || null;
  const direct = byCat ? num(byCat[familia]) : null;
  if (direct != null && direct > 0) return direct;
  if (byCat) {
    // tolera divergência de acentuação/caixa nos nomes de família
    const target = normalizeFamilyName(familia) ?? familia.toUpperCase();
    for (const [k, v] of Object.entries(byCat)) {
      if ((normalizeFamilyName(k) ?? k.toUpperCase()) === target) {
        const n = num(v);
        if (n != null && n > 0) return n;
      }
    }
  }
  return familiasCount > 0 ? 1 / familiasCount : 1;
}

// ============================ BI do cliente =================================

export function calculateClientBI(
  version: PerformanceVersion,
  row: PerformanceRow,
  familiasOverride?: string[],
): ClientBIResult {
  const erros: string[] = [];
  const familias = familiasOverride?.length ? familiasOverride : versionFamilies(version, [row]);

  const itens: FamiliaBI[] = familias.map((familia) => {
    const ratio = num(row.familia_pct?.[familia] ?? null);
    const farol = classifyFarol(ratio) ?? asStatus(row.metas_status?.[familia]);
    const coef = getFarolCoefficient(farol);
    const meta = familyMetaWeight(version, row.categoria, familia, familias.length);
    if (farol == null) erros.push(`Família "${familia}" sem atingimento e sem farol.`);
    return {
      familia,
      atingimento_ratio: ratio,
      farol,
      coeficiente_farol: coef,
      meta_peso: meta,
      indice_ponderado: coef == null ? 0 : meta * coef,
      participacao: null,
    };
  });

  const somaIndices = itens.reduce((s, f) => s + f.indice_ponderado, 0);
  const somaMetas = itens.reduce((s, f) => s + f.meta_peso, 0);
  for (const f of itens) f.participacao = somaIndices > 0 ? f.indice_ponderado / somaIndices : null;

  const indice_geral = somaMetas > 0 ? somaIndices / somaMetas : null;

  // Métricas oficiais do cliente (camada central).
  const clientMetrics = calculateClientMetrics(
    {
      razao_social: row.razao_social,
      categoria: row.categoria ?? null,
      metas: row.metas ?? null,
      realizado: row.realizado ?? null,
      familia_pct: row.familia_pct ?? null,
      metas_status: row.metas_status ?? null,
      total_pct: row.total_pct ?? null,
    },
    familias,
  );
  const atingimento_geral_ratio = clientMetrics.metrics.real_achievement;

  // Melhor / pior família — sempre por real_achievement, com empate explícito.
  const extremos = extremesByRealAchievement(
    itens.map((f) => ({ label: f.familia, real_achievement: f.atingimento_ratio })),
  );

  // Distribuição do farol
  const counts = new Map<FarolStatus, number>();
  for (const f of itens) if (f.farol) counts.set(f.farol, (counts.get(f.farol) ?? 0) + 1);
  const distribuicao_farol = FAROL_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => ({
    grupo: FAROL_LABEL[s],
    status: s,
    quantidade: counts.get(s) as number,
  }));
  const somaDistrib = distribuicao_farol.reduce((s, g) => s + g.quantidade, 0);
  if (somaDistrib !== itens.length)
    erros.push(
      `Distribuição do farol soma ${somaDistrib}, mas o cliente possui ${itens.length} famílias.`,
    );

  return {
    performance_version_id: version.id,
    calculation_version: CALCULATION_VERSION,
    calculated_at: new Date().toISOString(),
    periodo_label: version.periodo_label ?? null,
    cliente: row.razao_social,
    categoria: row.categoria ?? null,
    familias: itens,
    metrics: { ...clientMetrics.metrics, weighted_farol_index: indice_geral },
    indice_geral,
    atingimento_geral_ratio,
    farol: clientMetrics.farol,
    melhor_familia: {
      label: extremos.best.labels[0] ?? null,
      labels: extremos.best.labels,
      atingimento_ratio: extremos.best.value,
    },
    pior_familia: {
      label: extremos.worst.labels[0] ?? null,
      labels: extremos.worst.labels,
      atingimento_ratio: extremos.worst.value,
    },
    distribuicao_farol,
    erros,
  };
}


// ========================= BI do representante ==============================

export function calculateRepresentativeBI(
  version: PerformanceVersion,
  rows: PerformanceRow[],
): RepresentativeBIResult {
  const erros: string[] = [];
  const familias = versionFamilies(version, rows);
  const clientBIs = rows.map((r) => calculateClientBI(version, r, familias));
  for (const c of clientBIs) erros.push(...c.erros.map((e) => `${c.cliente}: ${e}`));

  // ---- agregações -----------------------------------------------------------
  type Agg = { indice: number; meta: number; realNum: number; realDen: number };
  const zero = (): Agg => ({ indice: 0, meta: 0, realNum: 0, realDen: 0 });

  const total = zero();
  const porCategoria = new Map<string, Agg>();
  const porFarol = new Map<FarolStatus, { indice: number; quantidade: number }>();
  const porCatFam = new Map<string, Map<string, Agg>>();
  const porFamilia = new Map<string, Agg>();

  for (const bi of clientBIs) {
    const cat = bi.categoria ?? "—";
    const catAgg = porCategoria.get(cat) ?? zero();
    const famMap = porCatFam.get(cat) ?? new Map<string, Agg>();

    for (const f of bi.familias) {
      const add = (a: Agg) => {
        a.indice += f.indice_ponderado;
        a.meta += f.meta_peso;
        if (f.atingimento_ratio != null) {
          a.realNum += f.meta_peso * f.atingimento_ratio;
          a.realDen += f.meta_peso;
        }
      };
      add(total);
      add(catAgg);
      const famAgg = famMap.get(f.familia) ?? zero();
      add(famAgg);
      famMap.set(f.familia, famAgg);
      const gAgg = porFamilia.get(f.familia) ?? zero();
      add(gAgg);
      porFamilia.set(f.familia, gAgg);
      if (f.farol) {
        const cur = porFarol.get(f.farol) ?? { indice: 0, quantidade: 0 };
        cur.indice += f.indice_ponderado;
        cur.quantidade += 1;
        porFarol.set(f.farol, cur);
      }
    }
    porCategoria.set(cat, catAgg);
    porCatFam.set(cat, famMap);
  }

  const categorias = [...porCategoria.entries()]
    .map(([categoria, a]) => ({
      categoria,
      participacao: total.indice > 0 ? a.indice / total.indice : null,
      atingimento: a.realDen > 0 ? a.realNum / a.realDen : null,
      indice: a.meta > 0 ? a.indice / a.meta : null,
    }))
    .sort((x, y) => (y.participacao ?? 0) - (x.participacao ?? 0));

  const farol = FAROL_ORDER.filter((s) => porFarol.has(s)).map((s) => ({
    grupo: FAROL_LABEL[s],
    status: s,
    participacao: total.indice > 0 ? (porFarol.get(s) as any).indice / total.indice : null,
    quantidade: (porFarol.get(s) as any).quantidade as number,
  }));

  const familiasPorCategoria: Record<string, FamilyShare[]> = {};
  for (const [cat, famMap] of porCatFam) {
    const catIndice = [...famMap.values()].reduce((s, a) => s + a.indice, 0);
    familiasPorCategoria[cat] = familias
      .filter((f) => famMap.has(f))
      .map((f) => {
        const a = famMap.get(f) as Agg;
        return {
          familyKey: f,
          familyName: f,
          shareRatio: catIndice > 0 ? a.indice / catIndice : 0,
          attainmentRatio: a.realDen > 0 ? a.realNum / a.realDen : null,
          metaTotal: a.meta,
        };
      });
  }

  const familiasConsolidadas = familias
    .filter((f) => porFamilia.has(f))
    .map((f) => {
      const a = porFamilia.get(f) as Agg;
      return {
        familia: f,
        shareRatio: total.indice > 0 ? a.indice / total.indice : 0,
        attainmentRatio: a.realDen > 0 ? a.realNum / a.realDen : null,
        metaTotal: a.meta,
      };
    });

  // Métricas oficiais do representante (camada central).
  const detalhado = calculateRepresentativeMetrics(
    rows.map((r) => ({
      razao_social: r.razao_social,
      categoria: r.categoria ?? null,
      metas: r.metas ?? null,
      realizado: r.realizado ?? null,
      familia_pct: r.familia_pct ?? null,
      metas_status: r.metas_status ?? null,
      total_pct: r.total_pct ?? null,
    })),
    familias,
  );
  const indiceGeralPonderado = total.meta > 0 ? total.indice / total.meta : null;

  return {
    performance_version_id: version.id,
    calculation_version: CALCULATION_VERSION,
    calculated_at: new Date().toISOString(),
    periodo_label: version.periodo_label ?? null,
    clientes: clientBIs.map((c) => ({
      razao_social: c.cliente,
      categoria: c.categoria,
      indice: c.indice_geral,
      atingimento_ratio: c.atingimento_geral_ratio,
      farol: c.farol,
    })),
    categorias,
    farol,
    familiasPorCategoria,
    familias: familiasConsolidadas,
    metrics: { ...detalhado.metrics, weighted_farol_index: indiceGeralPonderado },
    detalhado,
    indice_geral: indiceGeralPonderado,
    atingimento_geral_ratio: detalhado.metrics.real_achievement,
    erros,
  };

}

// ============================== Validação ===================================

/** Valida invariantes do BI de um cliente. Retorna lista de problemas. */
export function validateClientBIResult(bi: ClientBIResult): string[] {
  const problemas: string[] = [...bi.erros];
  for (const f of bi.familias) {
    if (f.atingimento_ratio != null && classifyFarol(f.atingimento_ratio) !== f.farol)
      problemas.push(`Farol incoerente com o atingimento em "${f.familia}".`);
    if (f.farol && f.coeficiente_farol !== FAROL_COEFFICIENT[f.farol])
      problemas.push(`Coeficiente incoerente com o farol em "${f.familia}".`);
    const esperado = f.meta_peso * (f.coeficiente_farol ?? 0);
    if (Math.abs(esperado - f.indice_ponderado) > 1e-9)
      problemas.push(`Índice ponderado incoerente em "${f.familia}".`);
  }
  const soma = bi.distribuicao_farol.reduce((s, g) => s + g.quantidade, 0);
  if (bi.familias.length && soma !== bi.familias.length)
    problemas.push(`Distribuição do farol não cobre todas as famílias.`);
  if (bi.calculation_version !== CALCULATION_VERSION)
    problemas.push(`Versão da metodologia divergente.`);
  return problemas;
}

export function validateRepresentativeBIResult(bi: RepresentativeBIResult): string[] {
  const problemas: string[] = [...bi.erros];
  const soma = bi.categorias.reduce((s, c) => s + (c.participacao ?? 0), 0);
  if (bi.categorias.length && Math.abs(soma - 1) > 0.005)
    problemas.push(`Soma das participações por categoria = ${(soma * 100).toFixed(2)}%.`);
  return problemas;
}

/** O BI só pode ser exibido quando pertence à versão selecionada. */
export function isBIForVersion(
  bi: { performance_version_id?: string | null; calculation_version?: string | null } | null | undefined,
  versionId: string | null | undefined,
): boolean {
  if (!bi || !versionId) return false;
  return bi.performance_version_id === versionId && bi.calculation_version === CALCULATION_VERSION;
}

// ==================== Adaptador para a camada de apresentação ===============

/** Converte para o formato legado (percentuais 0..100) usado por PDFs/comparativos. */
export function toLegacyClientBIData(bi: ClientBIResult) {
  return {
    geral:
      bi.atingimento_geral_ratio != null ? bi.atingimento_geral_ratio * 100 : null,
    categoria: bi.categoria,
    familias: bi.familias.map((f) => ({
      familia: f.familia,
      atingimento: f.atingimento_ratio != null ? f.atingimento_ratio * 100 : null,
      participacao: f.participacao != null ? f.participacao * 100 : null,
      farol: f.farol ? FAROL_LABEL[f.farol] : null,
    })),
    melhor_familia: {
      label: bi.melhor_familia.label,
      atingimento:
        bi.melhor_familia.atingimento_ratio != null
          ? bi.melhor_familia.atingimento_ratio * 100
          : null,
    },
    pior_familia: {
      label: bi.pior_familia.label,
      atingimento:
        bi.pior_familia.atingimento_ratio != null
          ? bi.pior_familia.atingimento_ratio * 100
          : null,
    },
    distribuicao_farol: bi.distribuicao_farol.map((g) => ({
      grupo: g.grupo,
      quantidade: g.quantidade,
    })),
  };
}
