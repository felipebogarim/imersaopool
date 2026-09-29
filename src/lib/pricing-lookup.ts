import { supabase } from "@/integrations/supabase/client";
import {
  comparablePrice,
  type ComparablePrice,
  type Confidence,
  type SpecValue,
} from "@/lib/price-comparativos-core";
import { top6For } from "@/lib/price-comparison-groups-attributes";
import { getFamilyConfig } from "@/lib/price-mapa/family-config";
import type { ProductRow } from "@/lib/price-comparativos-data";

export type PricingLookupState =
  | "FOUND_COMPLETE"
  | "FOUND_INCOMPLETE"
  | "FOUND_NO_PRICE"
  | "NOT_FOUND"
  | "AMBIGUOUS";

export type PricingCatalogCandidate = Pick<
  ProductRow,
  | "id"
  | "sku"
  | "referencia"
  | "marca"
  | "nome"
  | "descricao"
  | "familia"
  | "categoria"
  | "tipo"
  | "is_base"
>;

export type PricingPriceRow = {
  id: string;
  product_id: string;
  price: number | null;
  price_unit: string | null;
  price_per_meter: number | null;
  price_list_name: string | null;
  effective_date: string | null;
  source_file: string | null;
  region: string | null;
  price_availability: string;
};

export type PricingResolvedProduct = {
  state: Exclude<PricingLookupState, "NOT_FOUND" | "AMBIGUOUS">;
  product: ProductRow;
  specs: Record<string, SpecValue>;
  prices: PricingPriceRow[];
  comparablePrice: number | null;
  comparableUnit: string | null;
  originalPrice: number | null;
  originalUnit: string | null;
  priceListName: string | null;
  effectiveDate: string | null;
  source: string | null;
  missingFields: string[];
};

export type PricingLookupResult =
  | PricingResolvedProduct
  | { state: "NOT_FOUND"; query: string; candidates: [] }
  | { state: "AMBIGUOUS"; query: string; candidates: PricingCatalogCandidate[] };

export type PricingLookupContext = { productId?: string };

const PRODUCT_FIELDS =
  "id, marca, is_base, familia, categoria, tipo, sku, referencia, nome, descricao, imagem_url, status, source_file, source_page, source_date, updated_at";

const CANDIDATE_FIELDS =
  "id, sku, referencia, marca, nome, descricao, familia, categoria, tipo, is_base";

const PRICE_FIELDS =
  "id, product_id, price, price_unit, price_per_meter, price_list_name, effective_date, source_file, region, price_availability";

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isPricingFieldMissing(value: unknown): boolean {
  const normalized = normalizeText(value);
  return (
    !normalized || normalized === "nao informado" || normalized === "n/a" || normalized === "nd"
  );
}

function specDisplayValue(spec: SpecValue | undefined): unknown {
  return spec?.value_numeric ?? spec?.value_text ?? spec?.normalized_value ?? spec?.original_value;
}

export function pricingMissingFields(
  product: ProductRow,
  specs: Record<string, SpecValue>,
): string[] {
  const missing: string[] = [];
  if (isPricingFieldMissing(product.sku ?? product.referencia)) missing.push("codigo");
  if (isPricingFieldMissing(product.marca)) missing.push("marca");
  if (isPricingFieldMissing(product.descricao ?? product.nome)) missing.push("descricao");
  if (isPricingFieldMissing(product.familia)) missing.push("familia");
  if (isPricingFieldMissing(product.categoria ?? product.tipo)) missing.push("categoria");
  for (const attr of top6For(product.familia)) {
    if (isPricingFieldMissing(specDisplayValue(specs[attr.key]))) missing.push(`spec:${attr.key}`);
  }
  return missing;
}

export function buildPricingResolvedProduct(
  product: ProductRow,
  specs: Record<string, SpecValue>,
  prices: PricingPriceRow[],
): PricingResolvedProduct {
  const analysisUnit = getFamilyConfig(product.familia).unidade;
  const evaluated = prices.map((row) => ({ row, normalized: comparablePrice(row, analysisUnit) }));
  const selected =
    evaluated.find(
      ({ row, normalized }) => row.price_availability === "informado" && normalized.price != null,
    ) ??
    evaluated.find(({ row }) => row.price_availability === "informado") ??
    evaluated[0] ??
    null;
  const current = selected?.row ?? null;
  const normalized: ComparablePrice = selected?.normalized ?? {
    price: null,
    originalPrice: null,
    originalUnit: null,
    comparableUnit: null,
  };
  const missingFields = pricingMissingFields(product, specs);
  const identityMissing = missingFields.some((field) => !field.startsWith("spec:"));
  const state: PricingResolvedProduct["state"] = identityMissing
    ? "FOUND_INCOMPLETE"
    : normalized.price == null
      ? "FOUND_NO_PRICE"
      : missingFields.length > 0
        ? "FOUND_INCOMPLETE"
        : "FOUND_COMPLETE";
  return {
    state,
    product,
    specs,
    prices,
    comparablePrice: normalized.price,
    comparableUnit: normalized.comparableUnit,
    originalPrice: normalized.originalPrice,
    originalUnit: normalized.originalUnit,
    priceListName: current?.price_list_name ?? null,
    effectiveDate: current?.effective_date ?? null,
    source: current?.source_file ?? product.source_file,
    missingFields,
  };
}

function uniqueCandidates(rows: PricingCatalogCandidate[]): PricingCatalogCandidate[] {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values()).sort((a, b) => {
    const exactBrand = a.marca.localeCompare(b.marca, "pt-BR");
    return (
      exactBrand ||
      (a.sku ?? a.referencia ?? a.nome).localeCompare(b.sku ?? b.referencia ?? b.nome, "pt-BR")
    );
  });
}

async function candidateQuery(field: "sku" | "referencia" | "nome" | "descricao", term: string) {
  const { data, error } = await supabase
    .from("price_products")
    .select(CANDIDATE_FIELDS)
    .eq("is_deleted", false)
    .ilike(field, `%${term}%`)
    .order("marca")
    .limit(20);
  if (error) throw error;
  return (data ?? []) as PricingCatalogCandidate[];
}

/** Autocomplete code-first. Consulta somente o catálogo; preço nunca elimina um resultado. */
export async function searchPricingProductCatalog(
  term: string,
): Promise<PricingCatalogCandidate[]> {
  const query = term.trim();
  if (!query) return [];
  const results = await Promise.all([
    candidateQuery("sku", query),
    candidateQuery("referencia", query),
    candidateQuery("nome", query),
    candidateQuery("descricao", query),
  ]);
  return uniqueCandidates(results.flat()).slice(0, 30);
}

async function exactCandidates(code: string): Promise<PricingCatalogCandidate[]> {
  const [bySku, byReference] = await Promise.all([
    supabase
      .from("price_products")
      .select(CANDIDATE_FIELDS)
      .eq("is_deleted", false)
      .ilike("sku", code),
    supabase
      .from("price_products")
      .select(CANDIDATE_FIELDS)
      .eq("is_deleted", false)
      .ilike("referencia", code),
  ]);
  if (bySku.error) throw bySku.error;
  if (byReference.error) throw byReference.error;
  return uniqueCandidates([
    ...((bySku.data ?? []) as PricingCatalogCandidate[]),
    ...((byReference.data ?? []) as PricingCatalogCandidate[]),
  ]);
}

async function fetchPricingSpecs(productId: string): Promise<Record<string, SpecValue>> {
  const { data, error } = await supabase
    .from("price_product_specs")
    .select(
      "attribute_key, original_value, normalized_value, value_numeric, value_text, original_unit, normalized_unit, confidence_level",
    )
    .eq("product_id", productId);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((row) => [
      row.attribute_key,
      {
        attribute_key: row.attribute_key,
        original_value: row.original_value,
        normalized_value: row.normalized_value,
        value_numeric: row.value_numeric == null ? null : Number(row.value_numeric),
        value_text: row.value_text,
        original_unit: row.original_unit,
        normalized_unit: row.normalized_unit,
        confidence_level: row.confidence_level as Confidence,
      } satisfies SpecValue,
    ]),
  );
}

async function fetchPricingPrices(productId: string): Promise<PricingPriceRow[]> {
  const { data, error } = await supabase
    .from("price_product_prices")
    .select(PRICE_FIELDS)
    .eq("product_id", productId)
    .eq("status", "atual")
    .order("effective_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    price: row.price == null ? null : Number(row.price),
    price_per_meter: row.price_per_meter == null ? null : Number(row.price_per_meter),
    price_availability: row.price_availability ?? "informado",
  })) as PricingPriceRow[];
}

/** Fonte única dos cards da nova área Pricing. */
export async function resolvePricingProduct(
  code: string,
  context: PricingLookupContext = {},
): Promise<PricingLookupResult> {
  const query = code.trim();
  if (!query) return { state: "NOT_FOUND", query, candidates: [] };
  let candidates = await exactCandidates(query);
  if (context.productId)
    candidates = candidates.filter((candidate) => candidate.id === context.productId);
  if (candidates.length === 0) return { state: "NOT_FOUND", query, candidates: [] };
  if (candidates.length > 1) return { state: "AMBIGUOUS", query, candidates };

  const productId = candidates[0].id;
  const [productResult, specs, prices] = await Promise.all([
    supabase.from("price_products").select(PRODUCT_FIELDS).eq("id", productId).single(),
    fetchPricingSpecs(productId),
    fetchPricingPrices(productId),
  ]);
  if (productResult.error) throw productResult.error;
  return buildPricingResolvedProduct(productResult.data as ProductRow, specs, prices);
}

export type PricingMasterUpdate = {
  family: string;
  identification?: Partial<
    Pick<
      ProductRow,
      "marca" | "nome" | "descricao" | "familia" | "categoria" | "tipo" | "sku" | "referencia"
    >
  >;
  specs?: Record<string, string>;
};

/** Mutação mestre explícita; a RLS mantém esta operação restrita a administradores. */
export async function updatePricingMasterProduct(
  productId: string,
  update: PricingMasterUpdate,
): Promise<void> {
  if (update.identification && Object.keys(update.identification).length > 0) {
    const { error } = await supabase
      .from("price_products")
      .update(update.identification)
      .eq("id", productId);
    if (error) throw error;
  }
  for (const [attributeKey, rawValue] of Object.entries(update.specs ?? {})) {
    const numericMatch = rawValue.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    const attribute = top6For(update.family).find((item) => item.key === attributeKey);
    const { error } = await supabase.from("price_product_specs").upsert(
      {
        product_id: productId,
        attribute_key: attributeKey,
        attribute_name: attribute?.label ?? attributeKey,
        original_value: rawValue,
        normalized_value: rawValue,
        value_numeric: numericMatch ? Number(numericMatch[0]) : null,
        value_text: rawValue,
        source_type: "manual",
        extraction_method: "pricing_manual",
        confidence_level: "manual",
        manually_reviewed: true,
      },
      { onConflict: "product_id,attribute_key" },
    );
    if (error) throw error;
  }
}
