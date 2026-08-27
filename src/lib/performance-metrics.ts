// ============================================================================
// GOVERNANÇA ÚNICA DE INDICADORES — PERFORMANCE
//
// Fonte única de regra matemática para TODAS as métricas analíticas derivadas
// da Performance. Nenhum componente de tela pode calcular métrica própria.
//
// Métricas oficiais (nunca sinônimas entre si):
//   real_achievement          → soma(realizado) / soma(meta)
//   client_average_achievement→ média simples do atingimento real dos clientes
//   weighted_farol_index      → soma(meta × coeficiente do farol) / soma(meta)
//   portfolio_balance_index   → média simples dos coeficientes do farol
// ============================================================================

import {
  FAROL_LABEL,
  FAROL_ORDER,
  statusFromRatio,
  type FarolStatus,
} from "./performance-farol";

/** Versão da metodologia de métricas. */
export const METRICS_VERSION = "performance_bi_v2";

// ============================== Identificadores =============================

export const METRIC = {
  REAL_ACHIEVEMENT: "real_achievement",
  CLIENT_AVERAGE_ACHIEVEMENT: "client_average_achievement",
  WEIGHTED_FAROL_INDEX: "weighted_farol_index",
  PORTFOLIO_BALANCE_INDEX: "portfolio_balance_index",
} as const;

export type MetricId = (typeof METRIC)[keyof typeof METRIC];

export type MetricDefinition = {
  id: MetricId;
  label: string;
  shortLabel: string;
  formula: string;
  tooltip: string;
  /** Se true, o valor pode ser classificado pelo farol (é atingimento real). */
  farolClassifiable: boolean;
};

export const METRIC_DEFS: Record<MetricId, MetricDefinition> = {
  real_achievement: {
    id: "real_achievement",
    label: "Atingimento real",
    shortLabel: "Atingimento real",
    formula: "soma(realizado) / soma(meta)",
    tooltip: "Resultado realizado dividido pela meta total do universo analisado.",
    farolClassifiable: true,
  },
  client_average_achievement: {
    id: "client_average_achievement",
    label: "Média de atingimento dos clientes",
    shortLabel: "Média dos clientes",
    formula: "média(atingimento real de cada cliente)",
    tooltip:
      "Média simples do atingimento individual dos clientes. Todos os clientes têm o mesmo peso, independentemente do tamanho da meta.",
    farolClassifiable: false,
  },
  weighted_farol_index: {
    id: "weighted_farol_index",
    label: "Índice ponderado do farol",
    shortLabel: "Índice do farol",
    formula: "soma(meta × coeficiente do farol) / soma(meta)",
    tooltip:
      "Índice analítico que pondera o status do farol de cada item pelo peso da sua meta. Não é atingimento real.",
    farolClassifiable: false,
  },
  portfolio_balance_index: {
    id: "portfolio_balance_index",
    label: "Índice de equilíbrio do portfólio",
    shortLabel: "Índice de equilíbrio",
    formula: "média(coeficiente do farol)",
    tooltip:
      "Média simples dos coeficientes do farol. Mede o equilíbrio do desempenho entre clientes ou famílias, reduzindo o efeito de extremos. Não é atingimento.",
    farolClassifiable: false,
  },
};

/** Coeficiente analítico do farol. NÃO é atingimento real. */
export const FAROL_COEFFICIENT: Record<FarolStatus, number> = {
  sem_compra: 0,
  abaixo_meta: 0.25,
  pode_melhorar: 0.6,
  proximo: 0.8,
  otimo: 0.95,
  excelente: 1.1,
};

/** Classificação oficial do farol a partir do atingimento real (ratio, 1 = 100%). */
export function classifyFarol(ratio: number | null | undefined): FarolStatus | null {
  return statusFromRatio(ratio);
}

export function getFarolCoefficient(status: FarolStatus | null | undefined): number | null {
  return status ? FAROL_COEFFICIENT[status] : null;
}

// ================================ Entrada ===================================

export type MetricSourceRow = {
  razao_social: string;
  categoria?: string | null;
  /** Meta monetária por família (pode estar indisponível por sigilo). */
  metas?: Record<string, number> | null;
  /** Realizado monetário por família (pode estar indisponível por sigilo). */
  realizado?: Record<string, number> | null;
  /** Atingimento real por família em ratio canônico (1 = 100%). */
  familia_pct?: Record<string, number | null> | null;
  /** Farol por família quando não há percentual na origem. */
  metas_status?: Record<string, string | null> | null;
  /** Atingimento real total do cliente (ratio) quando informado pela origem. */
  total_pct?: number | null;
};

/** Célula atômica: a única unidade a partir da qual toda métrica é derivada. */
export type MetricCell = {
  cliente: string;
  categoria: string | null;
  familia: string;
  meta: number | null;
  realizado: number | null;
  /** Atingimento real da célula (ratio). */
  real_achievement: number | null;
  farol: FarolStatus | null;
  coeficiente_farol: number | null;
  /** Peso usado nas ponderações (meta quando existir, senão 1). */
  peso: number;
};

export type MetricsObject = {
  real_achievement: number | null;
  client_average_achievement: number | null;
  weighted_farol_index: number | null;
  portfolio_balance_index: number | null;
};

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const asStatus = (v: unknown): FarolStatus | null =>
  typeof v === "string" && (FAROL_ORDER as string[]).includes(v) ? (v as FarolStatus) : null;

/**
 * Teto de plausibilidade do atingimento em ratio (1 = 100%).
 * Uploads antigos gravaram valores monetários de meta no campo de percentual
 * (ex.: 8000 = R$ 8.000). Esses valores NÃO são atingimento: são descartados
 * para que o farol de origem (faixa da planilha) seja usado.
 */
export const MAX_PLAUSIBLE_RATIO = 10;

/** Ratio de atingimento válido, ou null quando o valor não é um percentual plausível. */
export function sanitizeRatio(v: unknown): number | null {
  const n = num(v);
  if (n == null) return null;
  if (n < 0 || n > MAX_PLAUSIBLE_RATIO) return null;
  return n;
}

/** Constrói as células atômicas de um conjunto de linhas de Performance. */
export function buildCells(rows: MetricSourceRow[], familias: string[]): MetricCell[] {
  const out: MetricCell[] = [];
  for (const r of rows) {
    for (const familia of familias) {
      const meta = num(r.metas?.[familia]);
      const realizado = num(r.realizado?.[familia]);
      const stored = sanitizeRatio(r.familia_pct?.[familia] ?? null);
      let real =
        meta != null && meta > 0 && realizado != null ? realizado / meta : stored;

      const statusOrigem = asStatus(r.metas_status?.[familia]);
      let farol = classifyFarol(real) ?? statusOrigem;
      // "Sem compra" é RESULTADO VÁLIDO (0%), nunca dado ausente:
      // a família permanece no denominador com todo o peso da sua meta.
      if (farol == null && real == null) farol = "sem_compra";
      if (farol === "sem_compra" && real == null) real = 0;
      out.push({
        cliente: r.razao_social,
        categoria: r.categoria ?? null,
        familia,
        meta,
        realizado,
        real_achievement: real,
        farol,
        coeficiente_farol: getFarolCoefficient(farol),
        peso: meta != null && meta > 0 ? meta : 1,
      });
    }
  }
  return out;
}


// ============================ Fórmulas oficiais =============================

/** real_achievement = soma(realizado) / soma(meta). */
export function calculateRealAchievement(cells: MetricCell[]): number | null {
  let somaMeta = 0;
  let somaReal = 0;
  let monetario = false;
  for (const c of cells) {
    if (c.meta != null && c.meta > 0 && c.realizado != null) {
      somaMeta += c.meta;
      somaReal += c.realizado;
      monetario = true;
    }
  }
  if (monetario && somaMeta > 0) return somaReal / somaMeta;

  // Sem valores monetários disponíveis (sigilo): média ponderada pelo peso da meta.
  let n = 0;
  let d = 0;
  for (const c of cells) {
    if (c.real_achievement == null) continue;
    n += c.peso * c.real_achievement;
    d += c.peso;
  }
  return d > 0 ? n / d : null;
}

/** client_average_achievement = média simples do atingimento real dos clientes. */
export function calculateClientAverageAchievement(
  clientAchievements: (number | null)[],
): number | null {
  const ok = clientAchievements.filter((v): v is number => v != null && !Number.isNaN(v));
  return ok.length ? ok.reduce((s, v) => s + v, 0) / ok.length : null;
}

/** weighted_farol_index = soma(meta × coeficiente) / soma(meta). */
export function calculateWeightedFarolIndex(cells: MetricCell[]): number | null {
  let n = 0;
  let d = 0;
  for (const c of cells) {
    if (c.coeficiente_farol == null) continue;
    n += c.peso * c.coeficiente_farol;
    d += c.peso;
  }
  return d > 0 ? n / d : null;
}

/** portfolio_balance_index = média simples dos coeficientes do farol. */
export function calculatePortfolioBalanceIndex(coeficientes: (number | null)[]): number | null {
  const ok = coeficientes.filter((v): v is number => v != null && !Number.isNaN(v));
  return ok.length ? ok.reduce((s, v) => s + v, 0) / ok.length : null;
}

/** Distribuição de faróis de um conjunto de status. */
export function farolDistribution(statuses: (FarolStatus | null)[]) {
  const counts = Object.fromEntries(FAROL_ORDER.map((s) => [s, 0])) as Record<FarolStatus, number>;
  let universo = 0;
  for (const s of statuses) {
    if (!s) continue;
    counts[s] += 1;
    universo += 1;
  }
  return { counts, universo };
}

// ========================== Agregações por nível ============================

export type ClientMetrics = {
  razao_social: string;
  categoria: string | null;
  metrics: MetricsObject;
  farol: FarolStatus | null;
  /** Famílias sem compra (real_achievement = 0). */
  familias_sem_compra: string[];
  /** Famílias com atingimento conhecido > 0. */
  familias_com_compra: number;
  familias_avaliadas: number;
  cobertura: number | null;
  cells: MetricCell[];
};

export type FamilyMetrics = {
  familia: string;
  metrics: MetricsObject;
  farol: FarolStatus | null;
  distribuicao: Record<FarolStatus, number>;
  universo: number;
  clientes_que_compraram: number;
};

export type CategoryMetrics = {
  categoria: string;
  clientes: number;
  metrics: MetricsObject;
  farol: FarolStatus | null;
  distribuicao: Record<FarolStatus, number>;
  universo: number;
};

export type RepresentativeMetrics = {
  metrics_version: string;
  familias: string[];
  clientes: ClientMetrics[];
  familias_metrics: FamilyMetrics[];
  categorias: CategoryMetrics[];
  metrics: MetricsObject;
  /** Distribuição do farol POR CLIENTE (derivada do real_achievement do cliente). */
  distribuicao_clientes: Record<FarolStatus, number>;
  universo_clientes: number;
  clientes_na_meta: number;
  clientes_criticos: number;
};

export function calculateClientMetrics(row: MetricSourceRow, familias: string[]): ClientMetrics {
  const cells = buildCells([row], familias);
  const informado = num(row.total_pct);
  const real = informado != null ? informado : calculateRealAchievement(cells);
  const metrics: MetricsObject = {
    real_achievement: real,
    client_average_achievement: null, // não se aplica a um único cliente
    weighted_farol_index: calculateWeightedFarolIndex(cells),
    portfolio_balance_index: calculatePortfolioBalanceIndex(
      cells.map((c) => c.coeficiente_farol),
    ),
  };
  // Toda família avaliada faz parte do denominador (ex.: 7 famílias).
  // Célula vazia (sem meta, sem realizado, sem % e sem farol) = sem compra.
  const semCompra = cells.filter(
    (c) => c.farol === "sem_compra" || (c.real_achievement == null && c.farol == null),
  );
  const comCompra = cells.length - semCompra.length;
  return {
    razao_social: row.razao_social,
    categoria: row.categoria ?? null,
    metrics,
    farol: classifyFarol(real),
    familias_sem_compra: semCompra.map((c) => c.familia),
    familias_com_compra: comCompra,
    familias_avaliadas: cells.length,
    cobertura: cells.length ? comCompra / cells.length : null,

    cells,
  };
}

export function calculateFamilyMetrics(clients: ClientMetrics[], familia: string): FamilyMetrics {
  const cells = clients.flatMap((c) => c.cells.filter((x) => x.familia === familia));
  const { counts, universo } = farolDistribution(cells.map((c) => c.farol));
  return {
    familia,
    metrics: {
      real_achievement: calculateRealAchievement(cells),
      client_average_achievement: calculateClientAverageAchievement(
        cells.map((c) => c.real_achievement),
      ),
      weighted_farol_index: calculateWeightedFarolIndex(cells),
      portfolio_balance_index: calculatePortfolioBalanceIndex(
        cells.map((c) => c.coeficiente_farol),
      ),
    },
    farol: classifyFarol(calculateRealAchievement(cells)),
    distribuicao: counts,
    universo,
    clientes_que_compraram: cells.filter((c) => c.farol != null && c.farol !== "sem_compra").length,
  };
}

export function calculateCategoryMetrics(clients: ClientMetrics[]): CategoryMetrics[] {
  const map = new Map<string, ClientMetrics[]>();
  for (const c of clients) {
    const key = c.categoria ?? "—";
    map.set(key, [...(map.get(key) ?? []), c]);
  }
  return [...map.entries()]
    .map(([categoria, list]) => {
      const cells = list.flatMap((c) => c.cells);
      const { counts, universo } = farolDistribution(list.map((c) => c.farol));
      const real = calculateRealAchievement(cells);
      return {
        categoria,
        clientes: list.length,
        metrics: {
          real_achievement: real,
          client_average_achievement: calculateClientAverageAchievement(
            list.map((c) => c.metrics.real_achievement),
          ),
          weighted_farol_index: calculateWeightedFarolIndex(cells),
          portfolio_balance_index: calculatePortfolioBalanceIndex(
            cells.map((c) => c.coeficiente_farol),
          ),
        },
        farol: classifyFarol(real),
        distribuicao: counts,
        universo,
      };
    })
    .sort((a, b) => b.clientes - a.clientes);
}

export function calculateRepresentativeMetrics(
  rows: MetricSourceRow[],
  familias: string[],
): RepresentativeMetrics {
  const clientes = rows.map((r) => calculateClientMetrics(r, familias));
  const cells = clientes.flatMap((c) => c.cells);
  const { counts, universo } = farolDistribution(clientes.map((c) => c.farol));
  return {
    metrics_version: METRICS_VERSION,
    familias,
    clientes,
    familias_metrics: familias.map((f) => calculateFamilyMetrics(clientes, f)),
    categorias: calculateCategoryMetrics(clientes),
    metrics: {
      real_achievement: calculateRealAchievement(cells),
      client_average_achievement: calculateClientAverageAchievement(
        clientes.map((c) => c.metrics.real_achievement),
      ),
      weighted_farol_index: calculateWeightedFarolIndex(cells),
      portfolio_balance_index: calculatePortfolioBalanceIndex(
        clientes.map((c) => getFarolCoefficient(c.farol)),
      ),
    },
    distribuicao_clientes: counts,
    universo_clientes: universo,
    clientes_na_meta: clientesNaMeta(clientes).length,
    clientes_criticos: clientesCriticos(clientes).length,
  };
}

// ================================ Regras ====================================

/** Regra central: cliente na meta ou acima ⇔ real_achievement >= 1. */
export function clientesNaMeta(clients: ClientMetrics[]): ClientMetrics[] {
  return clients.filter((c) => (c.metrics.real_achievement ?? -1) >= 1);
}

/** Regra central: cliente crítico ⇔ farol do real_achievement em Sem compra ou Abaixo da meta. */
export function clientesCriticos(clients: ClientMetrics[]): ClientMetrics[] {
  return clients.filter((c) => c.farol === "sem_compra" || c.farol === "abaixo_meta");
}

// =============================== Rankings ===================================

/** TOP melhor desempenho — ordena e exibe SEMPRE por real_achievement. */
export function rankTopPerformers(clients: ClientMetrics[], limit = 10): ClientMetrics[] {
  return clients
    .filter((c) => c.metrics.real_achievement != null)
    .slice()
    .sort(
      (a, b) =>
        (b.metrics.real_achievement as number) - (a.metrics.real_achievement as number) ||
        a.razao_social.localeCompare(b.razao_social),
    )
    .slice(0, limit);
}

/** TOP menor atingimento — ordena e exibe SEMPRE por real_achievement (ASC). */
export function rankLowestAchievement(clients: ClientMetrics[], limit = 10): ClientMetrics[] {
  return clients
    .filter((c) => c.metrics.real_achievement != null)
    .slice()
    .sort(
      (a, b) =>
        (a.metrics.real_achievement as number) - (b.metrics.real_achievement as number) ||
        a.razao_social.localeCompare(b.razao_social),
    )
    .slice(0, limit);
}

/**
 * TOP oportunidades de expansão de portfólio.
 * Critério determinístico: 1) mais famílias sem compra, 2) menor cobertura,
 * 3) menor real_achievement, 4) ordem alfabética (desempate final).
 */
export function rankExpansionOpportunities(clients: ClientMetrics[], limit = 10): ClientMetrics[] {
  return clients
    .filter((c) => c.familias_avaliadas > 0)
    .slice()
    .sort((a, b) => {
      if (b.familias_sem_compra.length !== a.familias_sem_compra.length)
        return b.familias_sem_compra.length - a.familias_sem_compra.length;
      const ca = a.cobertura ?? 1;
      const cb = b.cobertura ?? 1;
      if (ca !== cb) return ca - cb;
      const ra = a.metrics.real_achievement ?? Infinity;
      const rb = b.metrics.real_achievement ?? Infinity;
      if (ra !== rb) return ra - rb;
      return a.razao_social.localeCompare(b.razao_social);
    })
    .slice(0, limit);
}

/** Extremos com empate explícito (melhores/piores famílias de um cliente). */
export function extremesByRealAchievement(
  items: { label: string; real_achievement: number | null }[],
): {
  best: { labels: string[]; value: number | null };
  worst: { labels: string[]; value: number | null };
} {
  const ok = items.filter((i) => i.real_achievement != null) as {
    label: string;
    real_achievement: number;
  }[];
  if (!ok.length) return { best: { labels: [], value: null }, worst: { labels: [], value: null } };
  const max = Math.max(...ok.map((i) => i.real_achievement));
  const min = Math.min(...ok.map((i) => i.real_achievement));
  return {
    best: { labels: ok.filter((i) => i.real_achievement === max).map((i) => i.label), value: max },
    worst: { labels: ok.filter((i) => i.real_achievement === min).map((i) => i.label), value: min },
  };
}

// ============================== Validação ===================================

export type MetricDisplay = {
  /** Componente que está exibindo (para rastreabilidade). */
  component: string;
  metric: MetricId;
  value: number | null;
  /** Faixa/cor exibida junto do número, quando houver. */
  farol?: FarolStatus | null;
  /** Métrica usada para ordenar o ranking, quando houver. */
  sortedBy?: MetricId;
};

/**
 * Aceite semântico: número, rótulo, faixa, cor e ordenação devem vir da MESMA
 * métrica. Retorna as inconsistências encontradas.
 */
export function validateMetricDisplay(d: MetricDisplay): string[] {
  const problemas: string[] = [];
  if (d.farol != null) {
    if (!METRIC_DEFS[d.metric].farolClassifiable) {
      problemas.push(
        `${d.component}: "${METRIC_DEFS[d.metric].label}" não pode ser classificado pelo farol.`,
      );
    } else if (classifyFarol(d.value) !== d.farol) {
      problemas.push(
        `${d.component}: faixa "${FAROL_LABEL[d.farol]}" incoerente com o valor exibido.`,
      );
    }
  }
  if (d.sortedBy && d.sortedBy !== d.metric) {
    problemas.push(
      `${d.component}: ordenado por "${METRIC_DEFS[d.sortedBy].label}" mas exibindo "${METRIC_DEFS[d.metric].label}".`,
    );
  }
  return problemas;
}

/** Invariantes gerais de um conjunto de métricas do representante. */
export function validateMetrics(rep: RepresentativeMetrics): string[] {
  const problemas: string[] = [];
  const soma = FAROL_ORDER.reduce((s, k) => s + rep.distribuicao_clientes[k], 0);
  const comFarol = rep.clientes.filter((c) => c.farol != null).length;
  if (soma !== comFarol)
    problemas.push(`Distribuição do farol soma ${soma}, mas há ${comFarol} clientes classificados.`);
  if (rep.metrics_version !== METRICS_VERSION)
    problemas.push("Versão da metodologia de métricas divergente.");
  return problemas;
}

// =============================== Formatação =================================

export const fmtMetric = (r: number | null | undefined) =>
  r == null || Number.isNaN(r) ? "—" : `${(r * 100).toFixed(1).replace(".", ",")}%`;
