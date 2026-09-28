import { describe, expect, it } from "vitest";
import { analyzeAttribute, simulatePrice, top6For } from "./price-comparison-groups-attributes";
import type { SpecValue } from "./price-comparativos-core";

function spec(value_numeric: number | null, value_text: string | null = null): SpecValue {
  return {
    attribute_key: "x",
    original_value: null,
    normalized_value: null,
    value_numeric,
    value_text,
  };
}

describe("top6For", () => {
  it("usa a ordem canônica de Fitas: Tensão, Potência/m, Fluxo/m, LEDs/m, IRC, SDCM", () => {
    const attrs = top6For("Fitas e Fontes");
    expect(attrs.map((a) => a.key)).toEqual(["tensao", "potencia_m", "fluxo_m", "leds_m", "irc", "sdcm"]);
    expect(attrs).toHaveLength(6);
  });

  it("usa os primeiros 6 campos técnicos já configurados para Perfis, sem hardcode de marca", () => {
    const attrs = top6For("Perfis");
    expect(attrs.length).toBeGreaterThan(0);
    expect(attrs.length).toBeLessThanOrEqual(6);
  });

  it("cai para lista vazia numa família desconhecida, sem quebrar", () => {
    expect(top6For("Família Inexistente")).toEqual([]);
  });
});

describe("simulatePrice — item 8: positivo=desconto, negativo=acréscimo", () => {
  it("ajuste positivo de 10% reduz o preço (desconto)", () => {
    expect(simulatePrice(100, 10)).toBeCloseTo(90);
  });

  it("ajuste negativo de 10% aumenta o preço (acréscimo)", () => {
    expect(simulatePrice(100, -10)).toBeCloseTo(110);
  });

  it("sem ajuste, preço simulado é igual ao original", () => {
    expect(simulatePrice(100, null)).toBe(100);
    expect(simulatePrice(100, 0)).toBe(100);
  });

  it("preço original nulo nunca gera preço simulado", () => {
    expect(simulatePrice(null, 10)).toBeNull();
  });
});

describe("analyzeAttribute — item 9 e cenário Stella x Fitas Studio", () => {
  const attrs = top6For("Fitas e Fontes");
  const tensao = attrs.find((a) => a.key === "tensao")!;
  const fluxo = attrs.find((a) => a.key === "fluxo_m")!;
  const potencia = attrs.find((a) => a.key === "potencia_m")!;
  const irc = attrs.find((a) => a.key === "irc")!;

  it("12V x 24V é comparação intencional entre tensões, não incompatibilidade (item 27)", () => {
    const r = analyzeAttribute(tensao, spec(12), spec(24));
    expect(r.text).toBe("Comparação intencional entre tensões");
    expect(r.tone).toBe("config");
  });

  it("mesma tensão é 'Igual'", () => {
    expect(analyzeAttribute(tensao, spec(24), spec(24)).text).toBe("Igual");
  });

  it("fluxo luminoso maior no concorrente é 'Concorrente superior' (superioridade, maior=melhor)", () => {
    const r = analyzeAttribute(fluxo, spec(1400), spec(1600));
    expect(r.text).toBe("Concorrente superior");
  });

  it("IRC maior na base é 'Base superior'", () => {
    const r = analyzeAttribute(irc, spec(90), spec(80));
    expect(r.text).toBe("Base superior");
  });

  it("potência/m com diferença pequena (<3%) é 'Equivalente' (compatibilidade)", () => {
    const r = analyzeAttribute(potencia, spec(10), spec(10.2));
    expect(r.text).toBe("Equivalente");
  });

  it("potência/m 12% maior no concorrente mostra o percentual (compatibilidade)", () => {
    const r = analyzeAttribute(potencia, spec(10), spec(11.2));
    expect(r.text).toBe("Concorrente +12%");
  });

  it("sem dado nos dois lados retorna 'Não informado'", () => {
    expect(analyzeAttribute(fluxo, null, null).text).toBe("Não informado");
    expect(analyzeAttribute(fluxo, spec(null), spec(null)).text).toBe("Não informado");
  });
});
