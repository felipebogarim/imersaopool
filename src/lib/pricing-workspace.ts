import { comparablePrice, type SpecValue } from "@/lib/price-comparativos-core";
import { getFamilyConfig } from "@/lib/price-mapa/family-config";
import type { PricingLookupResult, PricingResolvedProduct } from "@/lib/pricing-lookup";

export type PricingIdentity = {
  code: string;
  brand: string;
  description: string;
  family: string;
  category: string;
  type: string;
};

export type PricingManualPrice = {
  originalPrice: string;
  originalUnit: string;
  pricePerMeter: string;
  priceListName: string;
  effectiveDate: string;
  source: string;
};

export type PricingSideDraft = {
  query: string;
  resolution: PricingLookupResult | null;
  identity: PricingIdentity;
  identityOverrides: Partial<PricingIdentity>;
  specOverrides: Record<string, string>;
  manualPrice: PricingManualPrice;
  adjustmentPercent: number | null;
};

export type EffectivePricingSide = {
  productId: string | null;
  identity: PricingIdentity;
  specs: Record<string, SpecValue>;
  comparablePrice: number | null;
  comparableUnit: string | null;
  originalPrice: number | null;
  originalUnit: string | null;
  priceListName: string | null;
  effectiveDate: string | null;
  source: string | null;
  missingFields: string[];
  priceTableId: string | null;
  priceOrigin: "table" | "legacy" | "none";
};

export function emptyPricingSide(): PricingSideDraft {
  return {
    query: "",
    resolution: null,
    identity: { code: "", brand: "", description: "", family: "", category: "", type: "" },
    identityOverrides: {},
    specOverrides: {},
    manualPrice: {
      originalPrice: "",
      originalUnit: "",
      pricePerMeter: "",
      priceListName: "",
      effectiveDate: "",
      source: "",
    },
    adjustmentPercent: null,
  };
}

function resolved(result: PricingLookupResult | null): PricingResolvedProduct | null {
  return result && result.state.startsWith("FOUND_") ? (result as PricingResolvedProduct) : null;
}

function codeOf(result: PricingResolvedProduct): string {
  return result.product.sku ?? result.product.referencia ?? result.product.nome;
}

export function sideFromResolution(
  query: string,
  resolution: PricingLookupResult,
): PricingSideDraft {
  const found = resolved(resolution);
  const identity: PricingIdentity = found
    ? {
        code: codeOf(found),
        brand: found.product.marca,
        description: found.product.descricao ?? found.product.nome,
        family: found.product.familia,
        category: found.product.categoria,
        type: found.product.tipo ?? "",
      }
    : { code: query, brand: "", description: "", family: "", category: "", type: "" };
  return { ...emptyPricingSide(), query, resolution, identity };
}

function positiveNumber(value: string): number | null {
  if (!value.trim()) return null;
  const numeric = Number(value.replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function specFromRaw(key: string, raw: string): SpecValue {
  const numericMatch = raw.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return {
    attribute_key: key,
    original_value: raw,
    normalized_value: raw,
    value_numeric: numericMatch ? Number(numericMatch[0]) : null,
    value_text: raw,
    confidence_level: "manual",
  };
}

export function effectivePricingSide(side: PricingSideDraft): EffectivePricingSide {
  const found = resolved(side.resolution);
  const identity = { ...side.identity, ...side.identityOverrides };
  const specs = { ...(found?.specs ?? {}) };
  for (const [key, value] of Object.entries(side.specOverrides)) {
    if (value.trim()) specs[key] = specFromRaw(key, value.trim());
  }

  const hasManualPrice = Boolean(
    side.manualPrice.originalPrice.trim() ||
    side.manualPrice.originalUnit.trim() ||
    side.manualPrice.pricePerMeter.trim(),
  );
  const manualOriginal = positiveNumber(side.manualPrice.originalPrice);
  const manualPerMeter = positiveNumber(side.manualPrice.pricePerMeter);
  const normalized = hasManualPrice
    ? comparablePrice(
        {
          price: manualOriginal ?? found?.originalPrice ?? null,
          price_per_meter: manualPerMeter,
          price_unit: side.manualPrice.originalUnit.trim() || found?.originalUnit || null,
        },
        getFamilyConfig(identity.family).unidade,
      )
    : null;

  return {
    productId: found?.product.id ?? null,
    identity,
    specs,
    comparablePrice: normalized?.price ?? found?.comparablePrice ?? null,
    comparableUnit: normalized?.comparableUnit ?? found?.comparableUnit ?? null,
    originalPrice: hasManualPrice
      ? (normalized?.originalPrice ?? null)
      : (found?.originalPrice ?? null),
    originalUnit: hasManualPrice
      ? (normalized?.originalUnit ?? null)
      : (found?.originalUnit ?? null),
    priceListName: side.manualPrice.priceListName.trim() || found?.priceListName || null,
    effectiveDate: side.manualPrice.effectiveDate || found?.effectiveDate || null,
    source: side.manualPrice.source.trim() || found?.source || null,
    missingFields: found?.missingFields ?? [],
    priceTableId: found?.selectedTable?.id ?? null,
    priceOrigin: found?.priceOrigin ?? "none",
  };
}

export function canUsePricingSide(side: EffectivePricingSide): boolean {
  return Boolean(
    side.identity.code.trim() &&
    side.identity.brand.trim() &&
    side.identity.description.trim() &&
    side.identity.family.trim() &&
    side.identity.category.trim(),
  );
}

export function pricingSnapshot(side: EffectivePricingSide) {
  return {
    product_id: side.productId,
    identity: side.identity,
    specs: side.specs,
    price: {
      comparable_price: side.comparablePrice,
      comparable_unit: side.comparableUnit,
      original_price: side.originalPrice,
      original_unit: side.originalUnit,
      price_list_name: side.priceListName,
      price_table_id: side.priceTableId,
      price_origin: side.priceOrigin,
      effective_date: side.effectiveDate,
      source: side.source,
    },
  };
}
