import { describe, expect, it } from "vitest";
import {
  pickPriceRow,
  priceTableKey,
  resolveTableKey,
  tablesForComparisonSide,
  tablesFromPriceRows,
  type ProductPriceRow,
} from "./price-comparison-lookup";
import { formatPreco } from "./price-comparativos-core";

const legacy: ProductPriceRow = {
  id: "1",
  product_id: "p",
  tableKey: priceTableKey({
    price_list_name: null,
    source_file: "modelo_comparativo_preenchido_v2.xlsx",
    effective_date: "2026-08-03",
  }),
  price: 59.9,
  price_unit: "bobina",
  price_per_meter: 11.98,
  price_availability: "informado",
  effective_date: "2026-08-03",
  source_file: "modelo_comparativo_preenchido_v2.xlsx",
  region: null,
};

describe("preço legado sem price_list_name", () => {
  it("identifica a tabela por arquivo e data", () => {
    expect(legacy.tableKey).toBe("modelo_comparativo_preenchido_v2.xlsx — 03/08/2026");
    expect(priceTableKey({ price_list_name: " Black SP ", source_file: "x" })).toBe("Black SP");
    expect(priceTableKey({ effective_date: "2026-08-03" })).toBe("Importado — 03/08/2026");
  });

  it("seleciona a única tabela e usa R$/m como preço comparável", () => {
    const tables = tablesFromPriceRows([legacy]);
    const key = resolveTableKey(tables, null);
    expect(key).toBe(legacy.tableKey);
    const p = pickPriceRow([legacy], key, "R$/m");
    expect(p.price).toBe(11.98);
    expect(p.originalPrice).toBe(59.9);
    expect(p.originalUnit).toBe("bobina");
    expect(p.comparableUnit).toBe("m");
    expect(
      formatPreco({
        preco: p.price,
        precoUnidade: p.comparableUnit,
        precoOriginal: p.originalPrice,
      }),
    ).toBe("R$ 11,98/m");
  });

  it("bobina sem price_per_meter não vira preço comparável em R$/m", () => {
    const semMetro = { ...legacy, price_per_meter: null };
    const p = pickPriceRow([semMetro], semMetro.tableKey, "R$/m");
    expect(p.price).toBeNull();
    expect(p.comparableUnit).toBeNull();
    expect(p.originalPrice).toBe(59.9);
    expect(
      formatPreco({
        preco: p.price,
        precoUnidade: p.comparableUnit,
        precoOriginal: p.originalPrice,
      }),
    ).toBe("Preço comparável não disponível");
  });

  it("mantém o preço original quando a unidade de análise não é por metro", () => {
    expect(pickPriceRow([legacy], legacy.tableKey, "R$/un").price).toBe(59.9);
  });

  it("não escolhe entre várias tabelas e nunca usa 0", () => {
    const other = { ...legacy, id: "2", tableKey: "Outra" };
    expect(resolveTableKey(tablesFromPriceRows([legacy, other]), null)).toBeNull();
    const semPreco = { ...legacy, price: null, price_per_meter: null };
    expect(pickPriceRow([semPreco], semPreco.tableKey, "R$/m").price).toBeNull();
  });

  it("não oferece ao concorrente uma tabela de outro produto da mesma marca", () => {
    const brandTables = tablesFromPriceRows([legacy]);
    expect(
      tablesForComparisonSide({
        productSelected: false,
        productTables: [],
        brandTables,
        useBrandTables: false,
      }),
    ).toEqual([]);
    expect(
      tablesForComparisonSide({
        productSelected: true,
        productTables: [],
        brandTables,
        useBrandTables: false,
      }),
    ).toEqual([]);
    expect(
      tablesForComparisonSide({
        productSelected: true,
        productTables: brandTables,
        brandTables: [],
        useBrandTables: false,
      }),
    ).toEqual(brandTables);
  });
});
