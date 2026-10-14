import { describe, it, expect } from "vitest";
import { computeFramedViewBox, DEFAULT_BRAZIL_VIEWBOX } from "./map-bounds";

describe("computeFramedViewBox", () => {
  it("retorna viewBox padrão do Brasil para lista vazia", () => {
    const res = computeFramedViewBox([]);
    expect(res).toEqual(DEFAULT_BRAZIL_VIEWBOX);
    expect(res.viewBox).toBe("0 0 800 800");
  });

  it("retorna viewBox padrão para UFs inválidas", () => {
    const res = computeFramedViewBox(["XX", "YY"]);
    expect(res).toEqual(DEFAULT_BRAZIL_VIEWBOX);
  });

  it("calcula enquadramento com zoom na região de BA, CE e SE", () => {
    const res = computeFramedViewBox(["BA", "CE", "SE"]);
    expect(res.width).toBeLessThan(800);
    expect(res.height).toBeLessThan(800);
    expect(res.width).toBe(res.height); // aspecto 1:1
    // Deve englobar CE (y min ~168) e BA (y max ~483)
    expect(res.y).toBeLessThanOrEqual(168);
    expect(res.y + res.height).toBeGreaterThanOrEqual(483);
    // Deve englobar BA (x min ~549) e SE (x max ~752)
    expect(res.x).toBeLessThanOrEqual(549);
    expect(res.x + res.width).toBeGreaterThanOrEqual(752);
    expect(res.viewBox).toBe(`${res.x} ${res.y} ${res.width} ${res.height}`);
  });

  it("aplica dimensão mínima para UF pequena individual (ex: DF)", () => {
    const res = computeFramedViewBox(["DF"]);
    expect(res.width).toBeGreaterThanOrEqual(240);
    expect(res.height).toBeGreaterThanOrEqual(240);
    expect(res.width).toBe(res.height);
  });

  it("retorna visão completa para cobertura nacional ampla (>= 18 estados)", () => {
    const muitosEstados = [
      "SP", "RJ", "MG", "ES", "PR", "SC", "RS", "MS", "MT", "GO",
      "DF", "BA", "SE", "AL", "PE", "PB", "RN", "CE", "PI"
    ];
    const res = computeFramedViewBox(muitosEstados);
    expect(res).toEqual(DEFAULT_BRAZIL_VIEWBOX);
  });
});
