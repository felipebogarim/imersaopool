import { describe, expect, it } from "vitest";
import { detectKind, normalizeReport, resolveChart, type ParsedSheet } from "./general-report-lib";

const sheet: ParsedSheet = {
  name: "Vendas",
  headers: ["Mês", "Valor", "Loja"],
  rows: [
    ["Jan", 100, "A"],
    ["Jan", 50, "B"],
    ["Fev", "1.200,50", "A"],
  ],
  rowCount: 3,
  truncated: false,
};

describe("general-report-lib", () => {
  it("detecta o tipo pelo arquivo", () => {
    expect(detectKind("dados.XLSX")).toBe("sheet");
    expect(detectKind("foto.jpg")).toBe("image");
    expect(detectKind("reuniao.m4a")).toBe("audio");
    expect(detectKind("x.pptx")).toBe("presentation");
    expect(detectKind("x.bin", "video/mp4")).toBe("video");
  });

  it("agrega dados reais da planilha, aceitando número em formato brasileiro", () => {
    const c = resolveChart(
      { kind: "bar", fileId: "f", sheet: "Vendas", x: "Mês", ys: ["Valor"], agg: "sum" },
      sheet,
    )!;
    expect(c.data).toEqual([
      { Mês: "Fev", Valor: 1200.5 },
      { Mês: "Jan", Valor: 150 },
    ]);
  });

  it("rejeita coluna inexistente e conta registros", () => {
    expect(
      resolveChart({ kind: "bar", fileId: "f", sheet: "Vendas", x: "Nope", ys: ["Valor"] }, sheet),
    ).toBeNull();
    const c = resolveChart(
      { kind: "pie", fileId: "f", sheet: "Vendas", x: "Loja", ys: [], agg: "count" },
      sheet,
    )!;
    expect(c.data[0]).toEqual({ Loja: "A", Quantidade: 2 });
  });

  it("normaliza o relatório descartando blocos inválidos", () => {
    const r = normalizeReport(
      {
        title: "R",
        executive_summary: "ok",
        chapters: [
          {
            title: "Cap 1",
            blocks: [
              { type: "text", text: "olá" },
              { type: "chart", kind: "bar", fileId: "f", sheet: "Vendas", x: "Mês", ys: ["Valor"] },
              { type: "chart", kind: "bar", fileId: "inexistente", x: "Mês", ys: ["Valor"] },
              { type: "image", fileId: "img-que-nao-existe", caption: "x" },
              { type: "bullets", items: [] },
            ],
          },
          { title: "Vazio", blocks: [] },
        ],
      },
      { sheets: new Map([["f", [sheet]]]), imageIds: new Set() },
    );
    expect(r.chapters).toHaveLength(1);
    expect(r.chapters[0].blocks.map((b) => b.type)).toEqual(["text", "chart"]);
  });
});
