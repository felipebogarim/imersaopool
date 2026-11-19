import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatBRL,
  formatPct,
  looksLikePdf,
  noteText,
  parseImportJson,
  periodText,
  validateImport,
} from "./general-report-import";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const example = (): any =>
  JSON.parse(readFileSync("docs/relatorio-geral-import-exemplo.json", "utf8"));
const paths = (r: ReturnType<typeof validateImport>) => r.issues.map((i) => i.path);

describe("importação — contrato", () => {
  it("o JSON de exemplo documentado é válido", () => {
    const r = parseImportJson(readFileSync("docs/relatorio-geral-import-exemplo.json", "utf8"));
    expect(r.ok).toBe(true);
  });
  it("mantém a ordem e os dados sem alterar nada", () => {
    const raw = example();
    const r = validateImport(raw);
    expect(r.ok && r.data).toEqual(raw);
    expect(r.ok && r.data.blocks.map((b) => b.type)).toEqual(
      raw.blocks.map((b: { type: string }) => b.type),
    );
  });
  it("JSON com erro de sintaxe é recusado com mensagem", () => {
    const r = parseImportJson("{ nao é json");
    expect(r.ok).toBe(false);
    expect(r.issues[0].message).toMatch(/JSON inválido/);
  });
  it("versão do contrato e campos obrigatórios", () => {
    const raw = example();
    raw.schema_version = 2;
    delete raw.title;
    const r = validateImport(raw);
    expect(paths(r)).toEqual(expect.arrayContaining(["schema_version", "$.title"]));
  });
  it("período: exige texto aprovado ou datas completas e válidas", () => {
    const a = example();
    a.period = {};
    expect(paths(validateImport(a))).toContain("period");
    const b = example();
    b.period = { start: "2025-11-01" };
    expect(validateImport(b).ok).toBe(false);
    const c = example();
    c.period = { start: "2025-11-31", end: "2026-10-31" };
    expect(paths(validateImport(c))).toContain("period.start");
    const d = example();
    d.period = { start: "2025-11-01", end: "2026-10-31" };
    expect(validateImport(d).ok).toBe(true);
  });
  it("tipo de bloco desconhecido aponta o bloco", () => {
    const raw = example();
    raw.blocks[1].type = "pareto";
    expect(paths(validateImport(raw))).toContain("blocks[1].type");
  });
  it("valor ausente ou não inteiro em centavos é erro (nunca vira zero)", () => {
    const raw = example();
    delete raw.blocks[1].current_cents;
    raw.blocks[2].items[0].previous_cents = 50000.5;
    const r = validateImport(raw);
    expect(paths(r)).toEqual(
      expect.arrayContaining(["blocks[1].current_cents", "blocks[2].items[0].previous_cents"]),
    );
  });
  it("Top 6: motivos devem ter as mesmas contas na mesma ordem do comparativo", () => {
    const raw = example();
    const reasons = raw.blocks.find((b: { type: string }) => b.type === "top6_reasons");
    [reasons.items[0], reasons.items[1]] = [reasons.items[1], reasons.items[0]];
    const r = validateImport(raw);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /diferente do comparativo/.test(i.message))).toBe(true);
    // não corrige sozinho
    expect(reasons.items[0].account).toBe("LOJA ÉPSILON");
  });
  it("Top 6: um bloco sem o outro é erro", () => {
    const raw = example();
    raw.blocks = raw.blocks.filter((b: { type: string }) => b.type !== "top6_reasons");
    expect(validateImport(raw).ok).toBe(false);
  });
});

describe("importação — formatação pt-BR", () => {
  it("moeda a partir de centavos", () => {
    expect(formatBRL(57320016)).toBe("R$ 573.200,16");
    expect(formatBRL(46818619)).toBe("R$ 468.186,19");
    expect(formatBRL(-10501397)).toBe("−R$ 105.013,97");
    expect(formatBRL(8382500, { sign: true })).toBe("+R$ 83.825,00");
    expect(formatBRL(5)).toBe("R$ 0,05");
  });
  it("percentual em pontos percentuais", () => {
    expect(formatPct(-18.3)).toBe("−18,3%");
    expect(formatPct(81.3)).toBe("81,3%");
    expect(formatPct(5, { sign: true })).toBe("+5,0%");
    expect(formatPct(0)).toBe("0,0%");
  });
  it("período, relato e PDF", () => {
    expect(periodText({ label: "Texto aprovado" })).toBe("Texto aprovado");
    expect(periodText({ start: "2025-11-01", end: "2026-10-31" })).toBe("01/11/2025 a 31/10/2026");
    expect(noteText("Dados ainda não inputados")).toBe("Dados ainda não inputados");
    expect(noteText(undefined)).toBe("—");
    expect(looksLikePdf(new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(looksLikePdf(new TextEncoder().encode("PK\u0003\u0004"))).toBe(false);
  });
});
