import { describe, it, expect } from "vitest";
import { buildPeriodLabel } from "./RepPerformanceYtdCard";

describe("buildPeriodLabel helper", () => {
  it("trata lista vazia ou nula", () => {
    expect(buildPeriodLabel([])).toBe("Nenhum mês selecionado");
    expect(buildPeriodLabel(undefined)).toBe("Nenhum mês selecionado");
  });

  it("retorna 'Ano Completo (Jan a Dez)' para 12 meses", () => {
    expect(buildPeriodLabel([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe(
      "Ano Completo (Jan a Dez)"
    );
  });

  it("retorna intervalo contíguo formatado", () => {
    expect(buildPeriodLabel([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe("Jan a Out");
    expect(buildPeriodLabel([1, 2, 3, 4, 5, 6])).toBe("Jan a Jun");
    expect(buildPeriodLabel([7, 8, 9, 10, 11, 12])).toBe("Jul a Dez");
    expect(buildPeriodLabel([3, 4, 5])).toBe("Mar a Mai");
  });

  it("retorna nome do mês único quando apenas 1 mês é selecionado", () => {
    expect(buildPeriodLabel([5])).toBe("Mai");
  });

  it("formata meses não contíguos", () => {
    expect(buildPeriodLabel([1, 3, 5])).toBe("Jan, Mar, Mai");
    expect(buildPeriodLabel([1, 3, 5, 7, 9])).toBe("5 meses selecionados");
  });
});
