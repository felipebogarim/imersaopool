import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseWorkbook } from "./performance-parser";
import { parsePercentRatio } from "./performance-import-engine";
import * as XLSXStyle from "xlsx-js-style";

const FABIO = "/mnt/user-uploads/file-15"; // DESEMPENHO_FABIO_BRISTOTTI_1_SEMESTRE_26_IMPORTACAO_FINAL_CORRIGIDA.xlsx
const SALTON = "/mnt/user-uploads/DESEMPENHO_SALTON_1_SEMESTRE_26_AJUSTADO.xlsx";

const load = (p: string) => {
  const b = readFileSync(p);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

const maybe = (p: string) => (existsSync(p) ? describe : describe.skip);

maybe(FABIO)("integração — arquivo real Fabio Bristotti", () => {
  it("reconhece estrutura e preserva as relações internas", async () => {
    const r = await parseWorkbook(load(FABIO));
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.familias.length).toBeGreaterThan(0);
    expect(new Set(r.familias).size).toBe(r.familias.length);
    expect(r.rows.every((row) => row.razao_social.trim().length > 0)).toBe(true);
    expect(r.rows.every((row) => Object.keys(row.metas_status).every((f) => r.familias.includes(f)))).toBe(true);
    expect(r.conflitos).toHaveLength(0);
    expect(r.diagnostic?.resultado.statusCells ?? r.stats.celulas_avaliadas).toBeGreaterThan(0);
  });
});

maybe(SALTON)("regressão — arquivo antigo Salton", () => {
  it("mantém clientes, famílias e ignora linhas de total", async () => {
    const r = await parseWorkbook(load(SALTON));
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.familias.length).toBeGreaterThan(0);
    expect(r.rows.every((x) => !!x.categoria)).toBe(true);
    expect(r.rows.every((row) => Object.keys(row.metas_status).every((f) => r.familias.includes(f)))).toBe(true);
  });
});

describe("parser determinístico de performance", () => {
  const ratios = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5, 10];

  it.each(ratios)("preserva o ratio numérico %s sem heurística por magnitude", (ratio) => {
    expect(parsePercentRatio({ v: ratio, w: `${ratio * 100}%`, z: "0%" })).toBe(ratio);
  });

  it("converte somente a representação textual explícita em percentual", () => {
    expect(parsePercentRatio({ v: "125%", w: null, z: null })).toBe(1.25);
    expect(parsePercentRatio({ v: "1,25", w: null, z: null })).toBe(1.25);
  });

  it("valida ratios sintéticos pela relação realizado ÷ meta, inclusive acima de 100%", async () => {
    const wb = XLSXStyle.utils.book_new();
    const aoa = [
      [null, null, "DECOR NEWLINE", null, null, "DECOR STUDIO", null, null],
      ["RAZÃO SOCIAL", "CATEGORIA", "R$ MÉDIA", "R$ META", "% META", "R$ MÉDIA", "R$ META", "% META"],
      ...ratios.map((ratio, index) => [
        `CLIENTE ${index + 1}`,
        "Gold",
        ratio * 100,
        100,
        ratio,
        ratio * 200,
        200,
        ratio,
      ]),
    ];
    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
    for (let row = 3; row <= ratios.length + 2; row++) {
      ws[`E${row}`].z = "0.00%";
      ws[`H${row}`].z = "0.00%";
    }
    XLSXStyle.utils.book_append_sheet(wb, ws, "Performance");
    const buf = XLSXStyle.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const parsed = await parseWorkbook(buf);

    expect(parsed.rows).toHaveLength(ratios.length);
    parsed.rows.forEach((row, index) => {
      expect(row.familia_pct?.["DECOR NEWLINE"]).toBeCloseTo(ratios[index], 10);
      expect(row.familia_pct?.["DECOR STUDIO"]).toBeCloseTo(ratios[index], 10);
    });
    expect(parsed.diagnostic?.validacao.mathChecks).toBe(ratios.length * 2);
    expect(parsed.diagnostic?.validacao.mathMismatches).toBe(0);
  });

  it("reconhece cabeçalho em duas linhas e preserva ausência sem converter em zero", async () => {
    const wb = XLSXStyle.utils.book_new();
    const aoa = [
      [],
      [null, null, null, null, null, null, "Sem Compra = 0%"],
      [null, null, null, null, null, null, "Abaixo da Meta = Abaixo de 49,99 %"],
      [null, null, "DECOR NEWLINE", "DECOR STUDIO", "SISTEMAS E MODULOS", null],
      ["GRUPO", "CATEGORIA", "R$ META", "R$ META ", "R$ META  ", "Total R$ META"],
      ["CLIENTE A", "Silver", 1000, 1500, 1000, 3500],
      ["CLIENTE B", "Gold", 2500, 3000, 2500, 8000],
    ];
    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
    ws.C6.s = { fill: { fgColor: { rgb: "FF9FC7E8" } } };
    ws.D6.s = { fill: { fgColor: { rgb: "FFE8A0A0" } } };
    ws.E6.s = { fill: { fgColor: { rgb: "FFF4D7BE" } } };
    ws.C7.s = { fill: { fgColor: { rgb: "00000000" } } };
    ws.D7.s = { fill: { fgColor: { rgb: "00000000" } } };
    ws.E7.s = { fill: { fgColor: { rgb: "00000000" } } };
    XLSXStyle.utils.book_append_sheet(wb, ws, "Planilha1");
    const buf = XLSXStyle.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const parsed = await parseWorkbook(buf);

    expect(parsed.parser_version).toBe("performance-parser@8-deterministic");
    expect(parsed.familias).toEqual(["DECOR NEWLINE", "DECOR STUDIO", "SISTEMAS E MÓDULOS"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].metas_status).toEqual({
      "DECOR NEWLINE": "excelente",
      "DECOR STUDIO": "abaixo_meta",
      "SISTEMAS E MÓDULOS": "pode_melhorar",
    });
    expect(parsed.rows[1].metas_status).toEqual({});
    expect(parsed.rows[1].familia_pct).toEqual({});
    expect(parsed.rows[0].total_pct).toBeNull();
    expect(parsed.diagnostic?.validacao.colorFallbackCells).toBe(3);
  });
});
