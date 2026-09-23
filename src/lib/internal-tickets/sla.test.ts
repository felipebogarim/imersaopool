import { describe, expect, it } from "vitest";
import { computeSlaDueDates, isOverdue, resolveEffectiveSlaMinutes } from "./sla";

describe("internal-tickets sla", () => {
  it("calcula prazos somando minutos à data de criação", () => {
    const createdAt = new Date("2026-09-23T10:00:00Z");
    const due = computeSlaDueDates(createdAt, {
      firstResponseMinutes: 60,
      resolutionMinutes: 1440,
    });
    expect(due.firstResponseDueAt?.toISOString()).toBe("2026-09-23T11:00:00.000Z");
    expect(due.resolutionDueAt?.toISOString()).toBe("2026-09-24T10:00:00.000Z");
  });

  it("devolve null quando não há SLA configurado para o marco", () => {
    const due = computeSlaDueDates(new Date(), {
      firstResponseMinutes: null,
      resolutionMinutes: null,
    });
    expect(due.firstResponseDueAt).toBeNull();
    expect(due.resolutionDueAt).toBeNull();
  });

  it("categoria sobrepõe o padrão do setor quando definida", () => {
    expect(resolveEffectiveSlaMinutes(1440, 240)).toBe(240);
  });

  it("cai para o padrão do setor quando a categoria não define SLA", () => {
    expect(resolveEffectiveSlaMinutes(1440, null)).toBe(1440);
  });

  it("sem SLA em nenhum dos dois níveis, não há prazo", () => {
    expect(resolveEffectiveSlaMinutes(null, null)).toBeNull();
  });

  it("isOverdue: sem prazo definido, nunca está atrasado", () => {
    expect(isOverdue(null, null)).toBe(false);
  });

  it("isOverdue: prazo não atingido e já vencido", () => {
    const dueAt = new Date("2026-09-23T12:00:00Z");
    const now = new Date("2026-09-23T13:00:00Z");
    expect(isOverdue(dueAt, null, now)).toBe(true);
  });

  it("isOverdue: prazo não atingido e ainda dentro do prazo", () => {
    const dueAt = new Date("2026-09-23T12:00:00Z");
    const now = new Date("2026-09-23T11:00:00Z");
    expect(isOverdue(dueAt, null, now)).toBe(false);
  });

  it("isOverdue: marco atingido depois do prazo conta como atraso histórico", () => {
    const dueAt = new Date("2026-09-23T12:00:00Z");
    const reachedAt = new Date("2026-09-23T12:30:00Z");
    expect(isOverdue(dueAt, reachedAt)).toBe(true);
  });

  it("isOverdue: marco atingido dentro do prazo não é atraso", () => {
    const dueAt = new Date("2026-09-23T12:00:00Z");
    const reachedAt = new Date("2026-09-23T11:30:00Z");
    expect(isOverdue(dueAt, reachedAt)).toBe(false);
  });
});
