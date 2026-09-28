// Price › Validação de Comparáveis — consultas de marcas, tabelas e preços.
// Reaproveita as tabelas existentes do módulo Price (`price_products`, `price_product_prices`,
// `price_competitors`, `price_tables`); nada aqui cria ou duplica produto/preço/marca/tabela.
// Uma "tabela de preços" é identificada por `price_list_name` (ou, na falta, `source_file`)
// nas linhas de `price_product_prices`, que é como as importações de preços gravam a origem.

import { supabase } from "@/integrations/supabase/client";

export const PRICE_NOT_FOUND_LABEL = "Preço não encontrado";
const NO_TABLE_LABEL = "Tabela sem identificação";

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

export function priceTableKey(r: {
  price_list_name?: string | null;
  source_file?: string | null;
}): string {
  return r.price_list_name?.trim() || r.source_file?.trim() || NO_TABLE_LABEL;
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
  const base = uniqueCI(products.filter((p) => p.is_base).map((p) => p.marca as string));
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

/** Todas as linhas de preço vigentes de um produto (uma ou mais tabelas). */
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

/** Tabelas de preço (distintas) disponíveis para uma marca numa família. */
export async function fetchBrandPriceTables(
  marca: string,
  familia: string,
): Promise<PriceTableOption[]> {
  const rows = await fetchAllPages((from, to) =>
    supabase
      .from("price_product_prices")
      .select(
        "price_list_name, source_file, effective_date, price_products!inner(marca, familia, is_deleted)",
      )
      .eq("status", "atual")
      .eq("price_products.marca", marca)
      .eq("price_products.familia", familia)
      .eq("price_products.is_deleted", false)
      .range(from, to),
  );
  const byKey = new Map<string, PriceTableOption>();
  for (const r of rows) {
    const key = priceTableKey(r);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { key, label: key, date: r.effective_date, source: r.source_file });
    } else if (r.effective_date && (!prev.date || r.effective_date > prev.date)) {
      prev.date = r.effective_date;
    }
  }
  return enrichWithRegisteredTables(marca, Array.from(byKey.values()));
}

/** Tabelas de um produto específico, derivadas das linhas de preço dele. */
export function tablesFromPriceRows(rows: ProductPriceRow[]): PriceTableOption[] {
  const byKey = new Map<string, PriceTableOption>();
  for (const r of rows) {
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
        t.file_name?.trim().toLowerCase() === o.key.toLowerCase(),
    );
    return hit
      ? { ...o, categoria: hit.categoria as string, date: o.date ?? hit.data_referencia }
      : o;
  });
}

/** Tabela efetiva: a escolhida (se válida) ou a única disponível; nunca um chute entre várias. */
export function resolveTableKey(
  options: PriceTableOption[],
  chosen: string | null | undefined,
): string | null {
  if (chosen && options.some((o) => o.key === chosen)) return chosen;
  return options.length === 1 ? options[0].key : null;
}

/** Linha de preço do produto na tabela indicada (a mais recente). Preço ausente => null, nunca 0. */
export function pickPriceRow(
  rows: ProductPriceRow[],
  tableKey: string | null,
): { row: ProductPriceRow | null; price: number | null } {
  if (!tableKey) return { row: null, price: null };
  const matches = rows.filter((r) => r.tableKey === tableKey);
  if (matches.length === 0) return { row: null, price: null };
  const row = [...matches].sort((a, b) =>
    (b.effective_date ?? "").localeCompare(a.effective_date ?? ""),
  )[0];
  const price = row.price_availability === "informado" && row.price != null ? row.price : null;
  return { row, price };
}
