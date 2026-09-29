import { describe, expect, it } from "vitest";
import type { SpecValue } from "./price-comparativos-core";
import {
  hydrateCatalogProducts,
  matchesProductClassification,
  type ProductRow,
} from "./price-comparativos-data";

const STELLA_SKUS = ["STL21834/27", "STL21836/27", "STL21837/27"];

function stellaProduct(sku: string, index: number): ProductRow {
  return {
    id: `stella-${index}`,
    marca: "STELLA",
    is_base: false,
    familia: "Fitas e Fontes",
    categoria: "Fitas LED",
    tipo: null,
    sku,
    referencia: null,
    nome: `Fita Stella ${sku}`,
    descricao: null,
    imagem_url: null,
    status: "ativo",
    source_file: "catalogo-stella.xlsx",
    source_page: null,
    source_date: null,
    updated_at: "2026-09-29T00:00:00Z",
  };
}

describe("catálogo da Validação de Comparáveis", () => {
  it("mantém produtos e specs no autocomplete mesmo sem qualquer preço", () => {
    const rows = STELLA_SKUS.map(stellaProduct);
    const fluxo: SpecValue = {
      attribute_key: "fluxo_m",
      original_value: "1500 lm/m",
      normalized_value: "1500",
      value_numeric: 1500,
      value_text: null,
    };
    const specs = Object.fromEntries(rows.map((row) => [row.id, { fluxo_m: fluxo }]));

    const loaded = hydrateCatalogProducts(rows, specs);

    expect(loaded.map((row) => row.sku)).toEqual(STELLA_SKUS);
    expect(loaded.every((row) => row.priceRow === null)).toBe(true);
    expect(loaded.every((row) => row.product.preco === null)).toBe(true);
    expect(loaded.every((row) => row.product.specs.fluxo_m?.value_numeric === 1500)).toBe(true);
  });

  it("aceita o tipo selecionado vindo de categoria ou de tipo", () => {
    const byCategory = stellaProduct("STL21834/27", 1);
    const byType = {
      ...stellaProduct("STL21837/27", 2),
      categoria: "Iluminação",
      tipo: "Fitas LED",
    };

    expect(matchesProductClassification(byCategory, "Fitas LED")).toBe(true);
    expect(matchesProductClassification(byType, "fitas led")).toBe(true);
    expect(matchesProductClassification(byType, "Perfis")).toBe(false);
  });
});
