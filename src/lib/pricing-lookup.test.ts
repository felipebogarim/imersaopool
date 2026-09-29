import { describe, expect, it } from "vitest";
import type { ProductRow } from "./price-comparativos-data";
import type { SpecValue } from "./price-comparativos-core";
import {
  buildPricingResolvedProduct,
  selectPricingTable,
  type PricingTableInfo,
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

  describe("tabelas de preço (price_tables)", () => {
    const table = (id: string, titulo: string, date: string): PricingTableInfo => ({
      id,
      titulo,
      competitor_id: "stella",
      data_referencia: date,
      file_name: "STELLA - 17.04.2026.pdf",
      hasPrice: false,
    });
    const stella = table("t1", "Stella - Tabela 17/04/2026", "2026-04-17");

    it("STL21834/27 sem preço mostra a tabela Stella disponível e não some", () => {
      const r = buildPricingResolvedProduct(
        product("STL21834/27", "STELLA"),
        completeSpecs,
        [],
        [stella],
      );
      expect(r.availableTables).toHaveLength(1);
      expect(r.selectedTable?.id).toBe("t1");
      expect(r.comparablePrice).toBeNull();
      expect(r.priceOrigin).toBe("table");
      expect(r.state).toBe("FOUND_NO_PRICE");
    });

    it("preço vinculado aparece na tabela e troca de tabela recarrega o preço", () => {
      const other = table("t2", "Stella - 01/01/2026", "2026-01-01");
      const row: PricingPriceRow = {
        id: "p1",
        product_id: "STELLA-X",
        price: 100,
        price_unit: "bobina",
        price_per_meter: 20,
        price_list_name: null,
        effective_date: "2026-04-17",
        source_file: "STELLA - 17.04.2026.pdf",
        region: null,
        price_availability: "informado",
        price_table_id: "t1",
      };
      const r = buildPricingResolvedProduct(
        product("X", "STELLA"),
        completeSpecs,
        [row],
        [other, stella],
      );
      expect(r.selectedTable?.id).toBe("t1");
      expect(r.comparablePrice).toBe(20);
      const switched = selectPricingTable(r, "t2");
      expect(switched.comparablePrice).toBeNull();
      expect(switched.state).toBe("FOUND_NO_PRICE");
    });

    it("preço legado sem vínculo fica como origem legada, sem inventar tabela", () => {
      const legacy: PricingPriceRow = {
        id: "p2",
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
      const r = buildPricingResolvedProduct(product("FT2307", "Studio"), completeSpecs, [legacy]);
      expect(r.priceOrigin).toBe("legacy");
      expect(r.selectedTable).toBeNull();
      expect(r.priceListName).toBeNull();
      expect(r.comparablePrice).toBe(11.98);
    });

    it("com tabelas oficiais, preço legado não vira preço da tabela e aparece à parte", () => {
      const legacy: PricingPriceRow = {
        id: "p3",
        product_id: "STELLA-X",
        price: 59.9,
        price_unit: "bobina",
        price_per_meter: 11.98,
        price_list_name: null,
        effective_date: "2026-08-03",
        source_file: "modelo_comparativo_preenchido_v2.xlsx",
        region: null,
        price_availability: "informado",
      };
      const r = buildPricingResolvedProduct(
        product("STL21834/27", "STELLA"),
        completeSpecs,
        [legacy],
        [stella],
      );
      expect(r.priceOrigin).toBe("table");
      expect(r.comparablePrice).toBeNull();
      expect(r.legacy?.comparablePrice).toBe(11.98);
      expect(r.legacy?.sourceFile).toBe("modelo_comparativo_preenchido_v2.xlsx");
      expect(selectPricingTable(r, "legacy").selectedTableKey).toBe("t1");
    });
  });
});
