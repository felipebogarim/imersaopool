import { describe, expect, it } from "vitest";
import { describeSaveError, normalizeVisitDate } from "./visao-imersao-2-save";

describe("normalizeVisitDate", () => {
  it("mantém AAAA-MM-DD", () => expect(normalizeVisitDate("2026-11-17")).toBe("2026-11-17"));
  it("corta horário ISO", () => expect(normalizeVisitDate("2026-11-17T10:00:00Z")).toBe("2026-11-17"));
  it("converte DD/MM/AAAA", () => expect(normalizeVisitDate("17/11/2026")).toBe("2026-11-17"));
  it("converte data por extenso", () =>
    expect(normalizeVisitDate("17 de novembro de 2026")).toBe("2026-11-17"));
  it("rejeita data inexistente", () => expect(normalizeVisitDate("31/02/2026")).toBeNull());
  it("rejeita texto sem dia", () => expect(normalizeVisitDate("Novembro 2026")).toBeNull());
});

describe("describeSaveError", () => {
  it("mostra a mensagem do banco", () =>
    expect(describeSaveError({ message: "boom" })).toBe("Falha ao salvar a Visão Imersão 2. boom"));
  it("traduz falta de permissão", () =>
    expect(describeSaveError({ code: "42501", message: "x" })).toBe(
      "Sem permissão para salvar este relatório na empresa ativa.",
    ));
});
