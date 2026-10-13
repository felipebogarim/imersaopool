import { describe, expect, it } from "vitest";
import { parseTablePriceSheet, planTablePriceImport } from "./price-table-import";

const sheet = [
  ["Tabela Stella"],
  ["Código", "Descrição", "Preço", "Preço por metro", "Unidade"],
  ["STL21834/27", "Fita 24V", "R$ 1.234,50", 24.69, "bobina"],
  ["NOVO-1", "Novo", 10, null, "un"],
  ["STL21834/27", "dup", 11, null, null],
  ["SEM-PRECO", "x", null, null, null],
  [null, null, null, null, null],
];

describe("parseTablePriceSheet", () => {
  it("acha o cabeçalho, lê preços pt-BR e ignora linhas sem código", () => {
    const { rows, avisos } = parseTablePriceSheet(sheet);
    expect(avisos).toEqual([]);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      codigo: "STL21834/27",
      price: 1234.5,
      pricePerMeter: 24.69,
      priceUnit: "bobina",
      linha: 3,
    });
  });

  it("avisa quando não há colunas Código/Preço", () => {
    expect(parseTablePriceSheet([["a", "b"]]).rows).toEqual([]);
    expect(parseTablePriceSheet([["a", "b"]]).avisos).toHaveLength(1);
  });
});

describe("planTablePriceImport", () => {
  const { rows } = parseTablePriceSheet(sheet);
  const products = [{ id: "p1", sku: "stl21834/27", referencia: null }];

  it("cria preço, atualiza o da mesma tabela, aponta não encontrados e erros", () => {
    const plan = planTablePriceImport(rows, products, [], false);
    expect(plan.map((a) => a.kind)).toEqual(["create", "not-found", "error", "error"]);
    const again = planTablePriceImport(rows, products, [{ id: "pr1", product_id: "p1" }], false);
    expect(again[0]).toMatchObject({ kind: "update", priceId: "pr1", productId: "p1" });
  });

  it("createMissing cria produto com dados mínimos", () => {
    expect(planTablePriceImport(rows, products, [], true)[1].kind).toBe("create-product");
  });
});
