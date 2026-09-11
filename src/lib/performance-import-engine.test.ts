import { describe, expect, it } from "vitest";

import { classifySubheader, parseAmount, parsePercentRatio } from "./performance-import-engine";

describe("performance import engine", () => {
  it("trata Resultado como realizado e não como percentual", () => {
    expect(classifySubheader("RESULTADO")).toBe("realizado");
    expect(classifySubheader("Resultado R$")).toBe("realizado");
    expect(classifySubheader("Resultado %")).toBe("percentual");
    expect(classifySubheader("% Meta")).toBe("percentual");
  });

  it("não converte marcadores sem dado em zero", () => {
    expect(parseAmount("N/D")).toBeNull();
    expect(parseAmount("S/D")).toBeNull();
    expect(parseAmount("sem dado")).toBeNull();
    expect(parseAmount(0)).toBe(0);
  });

  it("preserva zero somente quando a célula percentual é numericamente zero", () => {
    expect(parsePercentRatio({ v: 0, w: "0%", z: "0%" })).toBe(0);
    expect(parsePercentRatio({ v: null, w: "N/D", z: null })).toBeNull();
  });
});