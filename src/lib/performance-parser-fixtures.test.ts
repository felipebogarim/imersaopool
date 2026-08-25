import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseWorkbook } from "./performance-parser";
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
