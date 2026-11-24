// Performance → METAS → BI Metas: fatos (cliente × portfólio) e agregações por dimensão.
//
// Cada fato traz a meta vigente (gravada no ciclo do cliente; senão a meta padrão da
// categoria), a meta padrão e a base vendida em R$ (mesma regra do painel do cliente:
// realizado → média histórica → atingimento × meta do upload). Qualquer recorte
// (empresa, região, UF, representante, portfólio, categoria, origem) é só um groupBy
// dos mesmos fatos, então os totais batem entre as visões.

import { CANONICAL_FAMILIES, type CanonicalFamily } from "./client-bi-familias";
import { getPerformancePortfolioTarget } from "./performance-portfolio-targets";
import { METAS_FAMILY_LABEL, META_ORIGEM_LABEL, type MetaOrigem } from "./performance-metas";
import { baseFromBackend } from "./performance-metas-persistence";
import type { BaseFonte } from "./performance-metas";

type NumMap = Record<string, number | string | null> | null | undefined;

/** Linha devolvida pela RPC get_performance_goals_bi. */
export type MetasBiBackendRow = {
  row_id: string;
  representative_id: string | null;
  rep_regiao: string | null;
  cliente_regiao: string | null;
  cliente_uf: string | null;
  cliente_cidade: string | null;
  ciclo_inicio: string | null;
  ciclo_fim: string | null;
  metas: NumMap;
  realizado: NumMap;
  media: NumMap;
  familia_pct: NumMap;
  items: Array<{ familia: string; meta_mensal: number | string | null; origem: string }>;
};

/** Cliente da carteira (já resolvido na versão mais recente de cada representante). */
export type MetasBiClient = {
  id: string;
  razao_social: string;
  categoria: string | null;
  repId: string | null;
  repName: string;
};

export type MetasBiFact = {
  rowId: string;
  cliente: string;
  repId: string | null;
  repName: string;
  regiao: string;
  uf: string;
  categoria: string;
  familia: CanonicalFamily;
  metaAtual: number | null;
  metaPadrao: number | null;
  origem: MetaOrigem;
  /** Base vendida (R$) comparável à meta mensal; null sem dado. */
  realizado: number | null;
  fonte: BaseFonte | null;
};

export const SEM_REGIAO = "Sem região";
export const SEM_UF = "Sem UF";
export const SEM_CATEGORIA = "Sem categoria";

const ORIGENS: readonly MetaOrigem[] = ["padrao", "ia", "representante", "gestor"];

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

const clean = (v: string | null | undefined) => (v ?? "").trim();

/** Fatos cliente × portfólio. Clientes sem retorno do backend entram só com a meta padrão. */
export function buildMetasBiFacts(
  clients: readonly MetasBiClient[],
  backend: readonly MetasBiBackendRow[],
): MetasBiFact[] {
  const byRow = new Map(backend.map((b) => [b.row_id, b]));
  const facts: MetasBiFact[] = [];
  for (const c of clients) {
    const b = byRow.get(c.id);
    const base = baseFromBackend(
      b
        ? {
            metas: b.metas ?? {},
            realizado: b.realizado ?? {},
            media: b.media ?? {},
            familia_pct: b.familia_pct ?? {},
          }
        : undefined,
    );
    const items = new Map((b?.items ?? []).map((i) => [i.familia, i]));
    const regiao = clean(b?.cliente_regiao) || clean(b?.rep_regiao) || SEM_REGIAO;
    const uf = clean(b?.cliente_uf).toUpperCase() || SEM_UF;
    const categoria = clean(c.categoria) || SEM_CATEGORIA;
    for (const familia of CANONICAL_FAMILIES) {
      const metaPadrao = getPerformancePortfolioTarget(c.categoria, familia);
      const item = items.get(familia);
      const origem = (ORIGENS as readonly string[]).includes(item?.origem ?? "")
        ? (item!.origem as MetaOrigem)
        : "padrao";
      const bv = base[familia] ?? null;
      facts.push({
        rowId: c.id,
        cliente: c.razao_social,
        repId: c.repId,
        repName: c.repName,
        regiao,
        uf,
        categoria,
        familia,
        metaAtual: item ? num(item.meta_mensal) : metaPadrao,
        metaPadrao,
        origem,
        realizado: bv?.valor ?? null,
        fonte: bv?.fonte ?? null,
      });
    }
  }
  return facts;
}

// ------------------------------- Dimensões -----------------------------------

export type MetasBiDimension =
  | "regiao"
  | "uf"
  | "representante"
  | "familia"
  | "categoria"
  | "origem"
  | "cliente";

export const DIMENSION_LABEL: Record<MetasBiDimension, string> = {
  regiao: "Região",
  uf: "UF",
  representante: "Representante",
  familia: "Portfólio",
  categoria: "Categoria",
  origem: "Origem da meta",
  cliente: "Cliente",
};

export function dimensionKey(f: MetasBiFact, d: MetasBiDimension): string {
  switch (d) {
    case "regiao":
      return f.regiao;
    case "uf":
      return f.uf;
    case "representante":
      return f.repId ?? "—";
    case "familia":
      return f.familia;
    case "categoria":
      return f.categoria;
    case "origem":
      return f.origem;
    case "cliente":
      return f.rowId;
  }
}

export function dimensionLabel(f: MetasBiFact, d: MetasBiDimension): string {
  switch (d) {
    case "representante":
      return f.repName;
    case "familia":
      return METAS_FAMILY_LABEL[f.familia];
    case "origem":
      return META_ORIGEM_LABEL[f.origem];
    case "cliente":
      return f.cliente;
    default:
      return dimensionKey(f, d);
  }
}

// ------------------------------- Filtros -------------------------------------

/** Filtro por dimensão: lista de chaves aceitas (vazia = sem filtro). */
export type MetasBiFilters = Partial<Record<MetasBiDimension, string[]>>;

export function applyMetasBiFilters(
  facts: readonly MetasBiFact[],
  filters: MetasBiFilters,
): MetasBiFact[] {
  const active = (Object.entries(filters) as Array<[MetasBiDimension, string[] | undefined]>)
    .filter(([, v]) => v && v.length > 0)
    .map(([d, v]) => [d, new Set(v)] as const);
  if (active.length === 0) return [...facts];
  return facts.filter((f) => active.every(([d, set]) => set.has(dimensionKey(f, d))));
}

/** Opções distintas de uma dimensão (rótulo legível), ordenadas por rótulo. */
export function dimensionOptions(
  facts: readonly MetasBiFact[],
  d: MetasBiDimension,
): Array<{ key: string; label: string }> {
  const map = new Map<string, string>();
  for (const f of facts) {
    const k = dimensionKey(f, d);
    if (!map.has(k)) map.set(k, dimensionLabel(f, d));
  }
  const order =
    d === "familia"
      ? (k: string) => (CANONICAL_FAMILIES as readonly string[]).indexOf(k)
      : d === "origem"
        ? (k: string) => (ORIGENS as readonly string[]).indexOf(k)
        : null;
  return [...map.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) =>
      order ? order(a.key) - order(b.key) : a.label.localeCompare(b.label, "pt-BR"),
    );
}

// ------------------------------- Agregação -----------------------------------

export type MetasBiAggregate = {
  key: string;
  label: string;
  clientes: number;
  /** Clientes com ao menos um portfólio fora da meta padrão. */
  personalizados: number;
  metaAtual: number;
  metaPadrao: number;
  diferenca: number;
  /** Σ base vendida nos portfólios com meta > 0 e base disponível. */
  realizado: number;
  /** Σ meta atual dos mesmos portfólios do realizado (denominador do atingimento). */
  metaComBase: number;
  /** realizado ÷ metaComBase; null sem base. */
  atingimento: number | null;
  /** Fonte menos confiável entre os portfólios considerados. */
  fonte: BaseFonte | null;
};

function emptyAgg(key: string, label: string) {
  return {
    key,
    label,
    rows: new Set<string>(),
    custom: new Set<string>(),
    metaAtual: 0,
    metaPadrao: 0,
    realizado: 0,
    metaComBase: 0,
    fontes: new Set<BaseFonte>(),
  };
}

function finish(a: ReturnType<typeof emptyAgg>): MetasBiAggregate {
  const fonte = a.fontes.has("estimado")
    ? "estimado"
    : a.fontes.has("media")
      ? "media"
      : a.fontes.has("realizado")
        ? "realizado"
        : null;
  return {
    key: a.key,
    label: a.label,
    clientes: a.rows.size,
    personalizados: a.custom.size,
    metaAtual: a.metaAtual,
    metaPadrao: a.metaPadrao,
    diferenca: a.metaAtual - a.metaPadrao,
    realizado: a.realizado,
    metaComBase: a.metaComBase,
    atingimento: a.metaComBase > 0 ? a.realizado / a.metaComBase : null,
    fonte,
  };
}

function add(a: ReturnType<typeof emptyAgg>, f: MetasBiFact) {
  a.rows.add(f.rowId);
  if (f.origem !== "padrao") a.custom.add(f.rowId);
  a.metaAtual += f.metaAtual ?? 0;
  a.metaPadrao += f.metaPadrao ?? 0;
  if (f.realizado != null && f.metaAtual != null && f.metaAtual > 0) {
    a.realizado += f.realizado;
    a.metaComBase += f.metaAtual;
    if (f.fonte) a.fontes.add(f.fonte);
  }
}

export function totalMetasBi(facts: readonly MetasBiFact[]): MetasBiAggregate {
  const a = emptyAgg("__total__", "Total");
  for (const f of facts) add(a, f);
  return finish(a);
}

export type MetasBiSort = "metaAtual" | "atingimento" | "diferenca" | "label";

/** Agrupa pelos valores da dimensão; ordena por meta atual (desc) por padrão. */
export function aggregateMetasBi(
  facts: readonly MetasBiFact[],
  d: MetasBiDimension,
  sort: MetasBiSort = "metaAtual",
): MetasBiAggregate[] {
  const groups = new Map<string, ReturnType<typeof emptyAgg>>();
  for (const f of facts) {
    const k = dimensionKey(f, d);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = emptyAgg(k, dimensionLabel(f, d))));
    add(g, f);
  }
  const out = [...groups.values()].map(finish);
  if (d === "familia" && sort === "metaAtual") {
    const idx = (k: string) => (CANONICAL_FAMILIES as readonly string[]).indexOf(k);
    return out.sort((a, b) => idx(a.key) - idx(b.key));
  }
  return out.sort((a, b) => {
    if (sort === "label") return a.label.localeCompare(b.label, "pt-BR");
    if (sort === "atingimento") return (b.atingimento ?? -1) - (a.atingimento ?? -1);
    if (sort === "diferenca") return b.diferenca - a.diferenca;
    return b.metaAtual - a.metaAtual;
  });
}

/** Matriz dimensão × portfólio (linhas na ordem de `aggregateMetasBi`). */
export function matrixMetasBi(
  facts: readonly MetasBiFact[],
  d: Exclude<MetasBiDimension, "familia">,
  sort: MetasBiSort = "metaAtual",
): Array<{ row: MetasBiAggregate; cells: Record<CanonicalFamily, MetasBiAggregate | null> }> {
  const rows = aggregateMetasBi(facts, d, sort);
  const cells = new Map<string, ReturnType<typeof emptyAgg>>();
  for (const f of facts) {
    const k = `${dimensionKey(f, d)}|${f.familia}`;
    let g = cells.get(k);
    if (!g) cells.set(k, (g = emptyAgg(f.familia, METAS_FAMILY_LABEL[f.familia])));
    add(g, f);
  }
  return rows.map((row) => ({
    row,
    cells: Object.fromEntries(
      CANONICAL_FAMILIES.map((fam) => {
        const g = cells.get(`${row.key}|${fam}`);
        return [fam, g ? finish(g) : null];
      }),
    ) as Record<CanonicalFamily, MetasBiAggregate | null>,
  }));
}
