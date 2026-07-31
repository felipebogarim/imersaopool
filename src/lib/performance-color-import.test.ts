import { describe, expect, it } from "vitest";
import { cellHex, cellFill } from "./performance-parser";
import { statusFromHex, statusFromHexAproximado, IMPORT_FAROL_HEX } from "./performance-farol";
import { resolveCellStatus, conflictMessage } from "./performance-cell-status";

describe("cellHex", () => {
  it("formato achatado do xlsx-js-style", () => {
    expect(cellHex({ s: { patternType: "solid", fgColor: { rgb: "9FC7E8" } } })).toBe("9FC7E8");
  });
  it("formato aninhado", () => {
    expect(cellHex({ s: { fill: { fgColor: { rgb: "E8A0A0" } } } })).toBe("E8A0A0");
  });
  it("ARGB com prefixo FF", () => {
    expect(cellHex({ s: { fgColor: { rgb: "FF9FC7E8" } } })).toBe("9FC7E8");
  });
  it("minúsculas", () => {
    expect(cellHex({ s: { fgColor: { rgb: "9fc7e8" } } })).toBe("9FC7E8");
  });
  it("com # e espaços", () => {
    expect(cellHex({ s: { fgColor: { rgb: " #E8A0A0 " } } })).toBe("E8A0A0");
  });
  it("célula sem estilo", () => {
    expect(cellHex({})).toBeNull();
    expect(cellHex(undefined)).toBeNull();
    expect(cellFill(undefined).hasStyle).toBe(false);
  });
  it("estilo sem fgColor", () => {
    expect(cellHex({ s: { patternType: "none" } })).toBeNull();
    expect(cellFill({ s: { patternType: "none" } }).hasStyle).toBe(true);
  });
  it("bgColor.indexed = 64 não é cor de farol", () => {
    expect(cellHex({ s: { patternType: "solid", bgColor: { indexed: 64 } } })).toBeNull();
  });
  it("00000000 é tratado como sem preenchimento", () => {
    expect(cellHex({ s: { fgColor: { rgb: "00000000" } } })).toBeNull();
  });
  it("valores inválidos", () => {
    expect(cellHex({ s: { fgColor: { rgb: "ZZZZZZ" } } })).toBeNull();
    expect(cellHex({ s: { fgColor: { rgb: "ABCDE" } } })).toBeNull();
    expect(cellHex({ s: {} })).toBeNull();
  });
  it("tema e indexado ficam registrados como cor bruta", () => {
    expect(cellFill({ s: { fgColor: { theme: 4 } } })).toEqual({
      hasStyle: true,
      raw: "theme:4",
      hex: null,
    });
    expect(cellFill({ s: { fgColor: { indexed: 22 } } }).raw).toBe("indexed:22");
  });
});

describe("statusFromHex (exato)", () => {
  const canonica: [string, string][] = [
    ["E5E5E5", "sem_compra"],
    ["FCA5A5", "abaixo_meta"],
    ["FDBA74", "pode_melhorar"],
    ["FDE68A", "proximo"],
    ["BEF264", "otimo"],
    ["6EE7B7", "excelente"],
  ];
  const original: [string, string][] = [
    ["E5E5E5", "sem_compra"],
    ["E8A0A0", "abaixo_meta"],
    ["F4D7BE", "pode_melhorar"],
    ["F3EFD9", "proximo"],
    ["DFF0D0", "otimo"],
    ["9FC7E8", "excelente"],
  ];
  it.each([...canonica, ...original])("%s → %s", (hex, status) => {
    expect(statusFromHex(hex)).toBe(status);
  });
  it("ARGB e minúsculas", () => {
    expect(statusFromHex("FF9FC7E8")).toBe("excelente");
    expect(statusFromHex("dff0d0")).toBe("otimo");
    expect(statusFromHex("#E8A0A0")).toBe("abaixo_meta");
  });
  it("cor desconhecida retorna null (nunca sem_compra)", () => {
    expect(statusFromHex("9ABCDE")).toBeNull();
    expect(statusFromHex("")).toBeNull();
    expect(statusFromHex("XYZ")).toBeNull();
    expect(statusFromHex(null)).toBeNull();
  });
  it("aproximação continua disponível fora da validação", () => {
    expect(statusFromHexAproximado("DC3C3C")).toBe("abaixo_meta");
    expect(Object.keys(IMPORT_FAROL_HEX)).toContain("9FC7E8");
  });
});

describe("resolveCellStatus — tipos de falha", () => {
  it("texto e cor coerentes", () => {
    expect(resolveCellStatus(">100", "9FC7E8", { hasStyle: true, rawColor: "FF9FC7E8" })).toEqual({
      ok: true,
      status: "excelente",
    });
  });
  it("divergência real bloqueia", () => {
    const res = resolveCellStatus(">100", "E8A0A0", { hasStyle: true, rawColor: "FFE8A0A0" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.conflito.motivo).toBe("divergencia_texto_cor");
      expect(res.conflito.status_texto).toBe("excelente");
      expect(res.conflito.status_cor).toBe("abaixo_meta");
      const msg = conflictMessage({
        ...res.conflito,
        linha: 12,
        razao_social: "TESTE ALFA LTDA",
        familia: "PERFIL",
      });
      expect(msg).toContain("TESTE ALFA LTDA");
      expect(msg).toContain("E8A0A0");
    }
  });
  it("estilo ausente", () => {
    const res = resolveCellStatus("70-89", null, { hasStyle: false, rawColor: null });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.conflito.motivo).toBe("estilo_ausente");
  });
  it("cor ausente (estilo presente sem RGB)", () => {
    const res = resolveCellStatus("70-89", null, { hasStyle: true, rawColor: null });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.conflito.motivo).toBe("cor_ausente");
  });
  it("cor não reconhecida", () => {
    const res = resolveCellStatus("70-89", null, { hasStyle: true, rawColor: "9ABCDE" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.conflito.motivo).toBe("cor_nao_reconhecida");
  });
  it("cor de tema vira cor_nao_reconhecida", () => {
    const res = resolveCellStatus("<50", null, { hasStyle: true, rawColor: "theme:4" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.conflito.motivo).toBe("cor_nao_reconhecida");
  });
  it("Sem compra sem preenchimento é aceito (retroativo)", () => {
    expect(resolveCellStatus("0%", null, { hasStyle: false, rawColor: null })).toEqual({
      ok: true,
      status: "sem_compra",
    });
  });
  it("Sem compra com cor canônica é aceito", () => {
    expect(resolveCellStatus("Sem compra", "E5E5E5", { hasStyle: true, rawColor: "FFE5E5E5" })).toEqual(
      { ok: true, status: "sem_compra" },
    );
  });
  it("célula vazia não gera status nem conflito", () => {
    expect(resolveCellStatus(null, null, { hasStyle: false, rawColor: null })).toEqual({
      ok: true,
      status: null,
    });
  });
});
