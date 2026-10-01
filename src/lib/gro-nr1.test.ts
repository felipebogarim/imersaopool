import { describe, expect, it } from "vitest";
import { GRO_SECTIONS, isConsultant, isOverdue, periodKind } from "./gro-nr1";

describe("GRO NR1 longitudinal rules", () => {
  it("classifies current, previous and planned periods", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(periodKind({ starts_on: today, ends_on: today })).toBe("atual");
    expect(periodKind({ starts_on: "2000-01-01", ends_on: "2000-12-31" })).toBe("anterior");
    expect(periodKind({ starts_on: "2999-01-01", ends_on: "2999-12-31" })).toBe("programado");
  });

  it("calculates overdue from current status, not origin period", () => {
    expect(isOverdue({ due_on: "2000-01-01", status: "in_progress" })).toBe(true);
    expect(isOverdue({ due_on: "2000-01-01", status: "completed" })).toBe(false);
  });

  it("separates consultancy and company roles", () => {
    expect(isConsultant(["admin"])).toBe(true);
    expect(isConsultant(["gestor"])).toBe(true);
    expect(isConsultant(["agente"])).toBe(true);
    expect(isConsultant(["consultoria_operador"])).toBe(true);
    expect(isConsultant(["empresa_admin"])).toBe(false);
    expect(isConsultant(["empresa_usuario"])).toBe(false);
  });

  it("keeps private consultancy areas out of the company menu", () => {
    expect(GRO_SECTIONS.consultant.map(([key]) => key)).toEqual([
      "panorama",
      "documentos",
      "questionarios",
      "reportes-de-campo",
      "relatorio-final",
      "plano-de-acao",
      "nossa-cultura",
    ]);
    expect(GRO_SECTIONS.company.map(([key]) => key)).toEqual([
      "panorama",
      "relatorio-final",
      "plano-de-acao",
      "nossa-cultura",
    ]);
  });
});
