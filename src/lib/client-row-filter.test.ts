import { describe, expect, it } from "vitest";
import { isClientRow, isTotalRowName, splitClientRows } from "./client-row-filter";

describe("isTotalRowName", () => {
  it("identifica linhas de totalização/legenda", () => {
    for (const v of [
      "TOTAL",
      "Total Geral",
      "TOTAL GERAL DA META",
      "total geral da meta ",
      "Subtotal",
      "SOMATÓRIO",
      "Média Geral",
      "LEGENDA",
      "Participação estimada na venda",
      "ATINGIMENTO ESTIMADO DA META",
      "",
      null,
    ]) {
      expect(isTotalRowName(v as unknown)).toBe(true);
    }
  });

  it("não marca clientes reais como total", () => {
    for (const v of [
      "LINEA LED COMERCIO E SERVICOS DE ARTIGOS ELETRICOS E DE ILUMINACAO LTDA",
      "TOTALLUX ILUMINACAO LTDA",
      "MEDIALUZ COMERCIO LTDA",
      "SOMAR ELETRICA EIRELI",
    ]) {
      expect(isTotalRowName(v)).toBe(false);
    }
  });
});

describe("isClientRow", () => {
  it("exige categoria válida", () => {
    expect(isClientRow({ razao_social: "CLIENTE X", categoria: "Silver" })).toBe(true);
    expect(isClientRow({ razao_social: "CLIENTE X", categoria: "" })).toBe(false);
    expect(isClientRow({ razao_social: "CLIENTE X", categoria: null })).toBe(false);
    expect(isClientRow({ razao_social: "TOTAL GERAL DA META", categoria: "Black" })).toBe(false);
  });
});

describe("splitClientRows", () => {
  it("separa clientes de linhas ignoradas com motivo", () => {
    const { clientes, ignoradas } = splitClientRows([
      { razao_social: "A LTDA", categoria: "Black" },
      { razao_social: "TOTAL GERAL DA META", categoria: "" },
      { razao_social: "B LTDA", categoria: "" },
      { razao_social: "C LTDA", categoria: "Gold" },
    ]);
    expect(clientes.map((c) => c.razao_social)).toEqual(["A LTDA", "C LTDA"]);
    expect(ignoradas).toEqual([
      { razao_social: "TOTAL GERAL DA META", motivo: "Linha de totalização/legenda" },
      { razao_social: "B LTDA", motivo: "Categoria ausente ou inválida" },
    ]);
  });

  it("é idempotente: reprocessar o mesmo lote gera o mesmo resultado", () => {
    const rows = [
      { razao_social: "A LTDA", categoria: "Black" },
      { razao_social: "TOTAL", categoria: "" },
    ];
    expect(splitClientRows(rows)).toEqual(splitClientRows(rows));
  });
});
