// Price › Validação de Comparáveis — consultas de marcas, tabelas e preços.
// Reaproveita as tabelas existentes do módulo Price (`price_products`, `price_product_prices`,
// `price_competitors`, `price_tables`); nada aqui cria ou duplica produto/preço/marca/tabela.
// Uma "tabela de preços" é identificada por `price_list_name` (ou, na falta, `source_file`)
// nas linhas de `price_product_prices`, que é como as importações de preços gravam a origem.

import { supabase } from "@/integrations/supabase/client";
import { comparablePrice } from "@/lib/price-comparativos-core";

/** Marcas base permitidas na Validação de Comparáveis. */
export const BASE_BRANDS = ["Studio", "Newline", "Standard"] as const;

export type PriceTableOption = {
  /** Identificador estável da tabela (nome da lista ou arquivo de origem). */
  key: string;
  label: string;
  date: string | null;
  source: string | null;
  /** Metadados de `price_tables` (aba Tabelas) quando a tabela está cadastrada lá. */
  categoria?: string | null;
};

export type ProductPriceRow = {
  id: string;
  product_id: string;
  tableKey: string;
  price: number | null;
  price_unit: string | null;
  price_per_meter: number | null;
  price_availability: string;
  effective_date: string | null;
  source_file: string | null;
  region: string | null;
};

function formatDateBR(d: string | null | undefined): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/**
 * Identificação da tabela de uma linha de preço: `price_list_name` quando existe; para registros
 * legados/importados sem nome, "arquivo de origem — data" (ou "Importado — data"). Não inventa
 * uma tabela comercial: é só a origem registrada.
 */
export function priceTableKey(r: {
  price_list_name?: string | null;
  source_file?: string | null;
  effective_date?: string | null;
}): string {
  const name = r.price_list_name?.trim();
  if (name) return name;
  const origin = r.source_file?.trim() || "Importado";
  const date = formatDateBR(r.effective_date);
  return date ? `${origin} — ${date}` : origin;
}

async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; from < 20000; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

function uniqueCI(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const v of values) {
    const t = v?.trim();
    if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Marcas base (produtos `is_base`) e concorrentes (cadastro de competidores + marcas de produtos). */
export async function fetchBrandOptions(
  familia: string,
): Promise<{ base: string[]; competitors: string[] }> {
  const [products, competitors] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from("price_products")
        .select("marca, is_base")
        .eq("is_deleted", false)
        .eq("familia", familia)
        .range(from, to),
    ),
    supabase.from("price_competitors").select("nome").order("nome"),
  ]);
  if (competitors.error) throw competitors.error;
  // Marca base: só as permitidas, usando a grafia cadastrada nos produtos quando existir.
  const cadastradas = new Map(
    products.map((p) => [(p.marca as string).trim().toLowerCase(), (p.marca as string).trim()]),
  );
  const base = BASE_BRANDS.map((b) => cadastradas.get(b.toLowerCase()) ?? b);
  const baseSet = new Set(base.map((b) => b.toLowerCase()));
  const comp = uniqueCI([
    ...products.filter((p) => !p.is_base).map((p) => p.marca as string),
    ...(competitors.data ?? []).map((c) => c.nome as string),
  ]).filter((m) => !baseSet.has(m.toLowerCase()));
  return { base, competitors: comp };
}

type RawPriceRow = {
  id: string;
  product_id: string;
  price: number | null;
  price_unit: string | null;
  price_per_meter: number | null;
  price_availability: string | null;
  effective_date: string | null;
  source_file: string | null;
  region: string | null;
  price_list_name: string | null;
};

const PRICE_COLS =
  "id, product_id, price, price_unit, price_per_meter, price_availability, effective_date, source_file, region, price_list_name";

function toPriceRow(r: RawPriceRow): ProductPriceRow {
  return {
    id: r.id,
    product_id: r.product_id,
    tableKey: priceTableKey(r),
    price: r.price == null ? null : Number(r.price),
    price_unit: r.price_unit,
    price_per_meter: r.price_per_meter == null ? null : Number(r.price_per_meter),
    price_availability: r.price_availability ?? "informado",
    effective_date: r.effective_date,
    source_file: r.source_file,
    region: r.region,
  };
}

/**
 * Registros de preço vigentes (`status = 'atual'`) de um produto, direto de `price_product_prices`
 * por `product_id`. Não exige `price_list_name`.
 */
export async function fetchProductPriceRows(productId: string): Promise<ProductPriceRow[]> {
  const { data, error } = await supabase
    .from("price_product_prices")
    .select(PRICE_COLS)
    .eq("product_id", productId)
    .eq("status", "atual")
    .order("effective_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return ((data ?? []) as RawPriceRow[]).map(toPriceRow);
}

function mergeTable(byKey: Map<string, PriceTableOption>, r: ProductPriceRow) {
  const prev = byKey.get(r.tableKey);
  if (!prev) {
    byKey.set(r.tableKey, {
      key: r.tableKey,
      label: r.tableKey,
      date: r.effective_date,
      source: r.source_file,
    });
  } else if (r.effective_date && (!prev.date || r.effective_date > prev.date)) {
    prev.date = r.effective_date;
  }
}

/** Tabelas (distintas) com preço vigente para uma marca numa família, a partir dos preços. */
export async function fetchBrandPriceTables(
  marca: string,
  familia: string,
): Promise<PriceTableOption[]> {
  const products = await fetchAllPages((from, to) =>
    supabase
      .from("price_products")
      .select("id")
      .eq("is_deleted", false)
      .eq("familia", familia)
      .eq("marca", marca)
      .range(from, to),
  );
  const ids = products.map((p) => p.id as string);
  const byKey = new Map<string, PriceTableOption>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("price_product_prices")
      .select(PRICE_COLS)
      .in("product_id", ids.slice(i, i + 200))
      .eq("status", "atual");
    if (error) throw error;
    for (const r of (data ?? []) as RawPriceRow[]) mergeTable(byKey, toPriceRow(r));
  }
  return enrichWithRegisteredTables(marca, Array.from(byKey.values()));
}

/** Tabelas de um produto específico, derivadas dos registros de preço dele. */
export function tablesFromPriceRows(rows: ProductPriceRow[]): PriceTableOption[] {
  const byKey = new Map<string, PriceTableOption>();
  for (const r of rows) mergeTable(byKey, r);
  return Array.from(byKey.values());
}

/** Anexa categoria/data cadastradas na aba Tabelas (`price_tables`) quando o nome coincide. */
async function enrichWithRegisteredTables(
  marca: string,
  options: PriceTableOption[],
): Promise<PriceTableOption[]> {
  if (options.length === 0) return options;
  const { data: comp } = await supabase
    .from("price_competitors")
    .select("id")
    .ilike("nome", marca)
    .limit(1);
  const competitorId = comp?.[0]?.id as string | undefined;
  if (!competitorId) return options;
  const { data } = await supabase
    .from("price_tables")
    .select("titulo, file_name, categoria, data_referencia")
    .eq("competitor_id", competitorId);
  const registered = data ?? [];
  return options.map((o) => {
    const hit = registered.find(
      (t) =>
        t.titulo?.trim().toLowerCase() === o.key.toLowerCase() ||
        (!!o.source && t.file_name?.trim().toLowerCase() === o.source.toLowerCase()),
    );
    return hit ? { ...o, categoria: hit.categoria as string } : o;
  });
}

/**
 * Tabela efetiva: a escolhida (se válida) ou, havendo apenas um registro/tabela, essa única.
 * Nunca escolhe entre várias.
 */
export function resolveTableKey(
  options: PriceTableOption[],
  chosen: string | null | undefined,
): string | null {
  if (chosen && options.some((o) => o.key === chosen)) return chosen;
  return options.length === 1 ? options[0].key : null;
}

export type PickedPrice = {
  row: ProductPriceRow | null;
  /** Preço comparável (R$/m quando a família compara por metro e há `price_per_meter`). */
  price: number | null;
  /** Preço original do registro (ex.: bobina), mantido como metadado. */
  originalPrice: number | null;
  originalUnit: string | null;
  /** Unidade do preço comparável exibido (ex.: "m", "bobina"); null se sem preço. */
  comparableUnit: string | null;
};

/**
 * Registro de preço do produto na tabela indicada (o mais recente). Preço ausente => null, nunca 0.
 * Se a unidade de análise da família for R$/m e existir `price_per_meter`, ele é o preço
 * comparável; o preço original (bobina) permanece disponível como metadado.
 */
export function pickPriceRow(
  rows: ProductPriceRow[],
  tableKey: string | null,
  analysisUnit: string,
): PickedPrice {
  const empty: PickedPrice = {
    row: null,
    price: null,
    originalPrice: null,
    originalUnit: null,
    comparableUnit: null,
  };
  if (!tableKey) return empty;
  const matches = rows.filter((r) => r.tableKey === tableKey);
  if (matches.length === 0) return empty;
  const row = [...matches].sort((a, b) =>
    (b.effective_date ?? "").localeCompare(a.effective_date ?? ""),
  )[0];
  if (row.price_availability !== "informado") return { ...empty, row };
  const c = comparablePrice(row, analysisUnit);
  return {
    row,
    price: c.price,
    originalPrice: c.originalPrice,
    originalUnit: c.originalUnit,
    comparableUnit: c.comparableUnit,
  };
}
