import { describe, expect, it } from "vitest";
import type { ProductRow } from "./price-comparativos-data";
import type { SpecValue } from "./price-comparativos-core";
import {
  buildPricingResolvedProduct,
  isPricingFieldMissing,
  pricingMissingFields,
  type PricingPriceRow,
} from "./pricing-lookup";

function product(sku: string, marca: string, source = "catalogo.xlsx"): ProductRow {
  return {
    id: `${marca}-${sku}`,
    marca,
    is_base: marca === "Studio",
    familia: "Fitas e Fontes",
    categoria: "Fitas LED",
    tipo: null,
    sku,
    referencia: null,
    nome: `${marca} ${sku}`,
    descricao: `Fita ${sku}`,
    imagem_url: null,
    status: "ativo",
    source_file: source,
    source_page: null,
    source_date: null,
    updated_at: "2026-09-29T00:00:00Z",
  };
}

function spec(key: string, value: number, original: string): SpecValue {
  return {
    attribute_key: key,
    original_value: original,
    normalized_value: String(value),
    value_numeric: value,
    value_text: null,
  };
}

const completeSpecs = {
  tensao: spec("tensao", 12, "12 V"),
  potencia_m: spec("potencia_m", 14, "14 W/m"),
  fluxo_m: spec("fluxo_m", 1500, "1500 lm/m"),
  leds_m: spec("leds_m", 180, "180 LEDs/m"),
  irc: spec("irc", 90, "90"),
  sdcm: spec("sdcm", 3, "<3"),
};

describe("Pricing lookup code-first", () => {
  it("normaliza FT2307 em R$/m sem perder o preço original da bobina", () => {
    const price: PricingPriceRow = {
      id: "price-1",
      product_id: "Studio-FT2307",
      price: 59.9,
      price_unit: "bobina",
      price_per_meter: 11.98,
      price_list_name: null,
      effective_date: "2026-08-03",
      source_file: "modelo_comparativo_preenchido_v2.xlsx",
      region: null,
      price_availability: "informado",
    };
    const resolved = buildPricingResolvedProduct(product("FT2307", "Studio"), completeSpecs, [
      price,
    ]);
    expect(resolved.comparablePrice).toBe(11.98);
    expect(resolved.comparableUnit).toBe("m");
    expect(resolved.originalPrice).toBe(59.9);
    expect(resolved.originalUnit).toBe("bobina");
    expect(resolved.state).toBe("FOUND_COMPLETE");
  });

  it.each(["STL21834/27", "STL21836/27"])(
    "%s permanece tecnicamente comparável sem preço",
    (sku) => {
      const resolved = buildPricingResolvedProduct(product(sku, "STELLA"), completeSpecs, []);
      expect(resolved.product.sku).toBe(sku);
      expect(resolved.comparablePrice).toBeNull();
      expect(resolved.originalPrice).toBeNull();
      expect(resolved.state).toBe("FOUND_NO_PRICE");
      expect(Object.keys(resolved.specs)).toHaveLength(6);
    },
  );

  it("STL21837/27 preserva campos conhecidos e identifica os ausentes", () => {
    const partial = {
      tensao: spec("tensao", 24, "24 V"),
      potencia_m: spec("potencia_m", 19, "19 W/m"),
    };
    const p = product("STL21837/27", "STELLA");
    expect(pricingMissingFields(p, partial)).toEqual(
      expect.arrayContaining(["spec:fluxo_m", "spec:leds_m", "spec:irc", "spec:sdcm"]),
    );
    expect(buildPricingResolvedProduct(p, partial, []).specs.potencia_m.value_numeric).toBe(19);
  });

  it("trata vazio e NÃO INFORMADO como ausentes", () => {
    expect(isPricingFieldMissing("")).toBe(true);
    expect(isPricingFieldMissing("NÃO INFORMADO")).toBe(true);
    expect(isPricingFieldMissing("24 V")).toBe(false);
  });
});
