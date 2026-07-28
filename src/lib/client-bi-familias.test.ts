import { describe, expect, it } from "vitest";
import {
  CANONICAL_FAMILIES,
  buildBI,
  calculateBestFamily,
  calculateTrafficLightDistribution,
  calculateWorstFamily,
  deriveFamiliasItens,
  farolFromAtingimento,
  getFamiliasCliente,
  normalizeFamilyName,
  validateClientBI,
  validateFamilias,
  type FamiliaResultado,
} from "./client-bi-familias";

const fam = (
  familia: string,
  atingimento: number | null,
  participacao: number | null = 0,
): FamiliaResultado => ({
  familia,
  atingimento,
  participacao,
  farol: farolFromAtingimento(atingimento),
});

const seven = (vals: number[], parts?: number[]) =>
  CANONICAL_FAMILIES.map((f, i) => fam(f, vals[i], parts ? parts[i] : 0));

describe("famílias canônicas", () => {
  it("tem exatamente as 7 famílias oficiais", () => {
    expect([...CANONICAL_FAMILIES]).toEqual([
      "DECOR NEWLINE",
      "DECOR STUDIO",
      "SISTEMAS E MÓDULOS",
      "PRO LED",
      "PRO LAMP",
      "PERFIL",
      "FITAS E FONTES",
    ]);
  });

  it("mapeia ACESSÓRIOS legado para FITAS E FONTES", () => {
    expect(normalizeFamilyName("Acessórios")).toBe("FITAS E FONTES");
  });

  it("rejeita famílias numéricas", () => {
    expect(normalizeFamilyName("1.1")).toBeNull();
    expect(normalizeFamilyName("0.6")).toBeNull();
    expect(normalizeFamilyName("25%")).toBeNull();
  });
});

describe("regras do farol", () => {
  const cases: Array<[number, string]> = [
    [0, "Sem compra"],
    [25, "Abaixo da meta"],
    [60, "Pode melhorar"],
    [80, "Próximo"],
    [95, "Ótimo"],
    [110, "Excelente"],
  ];
  it.each(cases)("%i%% => %s", (pct, label) => {
    expect(farolFromAtingimento(pct)).toBe(label);
    expect(farolFromAtingimento(pct / 100)).toBe(label);
  });
});

describe("melhor e pior família (desempate pela ordem oficial)", () => {
  it("empate na melhor família", () => {
    const fams = seven([1.1, 0.5, 1.1, 0.5, 0.5, 0.5, 0.5]);
    expect(calculateBestFamily(fams)?.familia).toBe("DECOR NEWLINE");
  });

  it("empate na pior família (PRO LAMP antes de FITAS E FONTES)", () => {
    const fams = seven([1.1, 1.1, 1.1, 1.1, 0.25, 1.1, 0.25]);
    expect(calculateWorstFamily(fams)?.familia).toBe("PRO LAMP");
  });

  it("cliente com todas as famílias em 0%", () => {
    const bi = buildBI("Silver", 0, seven([0, 0, 0, 0, 0, 0, 0]));
    expect(bi.melhor_familia.label).toBe("DECOR NEWLINE");
    expect(bi.pior_familia.label).toBe("DECOR NEWLINE");
    expect(bi.distribuicao_farol).toEqual([{ grupo: "Sem compra", quantidade: 7 }]);
    expect(validateClientBI(bi)).toBeNull();
  });

  it("cliente com todas as famílias no mesmo farol", () => {
    const bi = buildBI("Gold", 0.8, seven([0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8]));
    expect(bi.distribuicao_farol).toEqual([{ grupo: "Próximo", quantidade: 7 }]);
  });
});

describe("distribuição do farol", () => {
  it("soma sempre 7", () => {
    const fams = seven([1.1, 1.1, 1.1, 1.1, 0.8, 0.25, 0.25]);
    const dist = calculateTrafficLightDistribution(fams);
    expect(dist.reduce((s, g) => s + g.quantidade, 0)).toBe(7);
    expect(dist).toEqual([
      { grupo: "Abaixo da meta", quantidade: 2 },
      { grupo: "Próximo", quantidade: 1 },
      { grupo: "Excelente", quantidade: 4 },
    ]);
  });
});

describe("validação estrutural", () => {
  it("aceita um BI válido com participação somando 100%", () => {
    const bi = buildBI(
      "Black",
      0.9,
      seven([0.95, 0.6, 1.1, 0.6, 0.95, 1.1, 0.95], [20, 10, 20, 10, 15, 15, 10]),
    );
    expect(validateClientBI(bi)).toBeNull();
  });

  it("rejeita 9 famílias", () => {
    const fams = [...seven([1, 1, 1, 1, 1, 1, 1]), fam("1.1", null), fam("0.6", null)];
    expect(validateFamilias(fams)).toMatch(/9 famílias/);
  });

  it("rejeita família inválida, duplicada, nula e negativa", () => {
    const base = seven([1, 1, 1, 1, 1, 1, 1]);
    expect(validateFamilias([...base.slice(0, 6), fam("1.1", 1)])).toMatch(/inválida/);
    expect(validateFamilias([...base.slice(0, 6), base[0]])).toMatch(/duplicada/);
    expect(validateFamilias([...base.slice(0, 6), fam("PERFIL", -0.2)])).toMatch(
      /duplicada|negativo/,
    );
    expect(
      validateFamilias([...base.slice(0, 6), { ...base[6], atingimento: null }]),
    ).toMatch(/atingimento nulo/);
    expect(validateFamilias([...base.slice(0, 6), { ...base[6], farol: null }])).toMatch(
      /farol nulo/,
    );
    expect(validateFamilias([...base.slice(0, 6), { ...base[6], atingimento: 4 }])).toMatch(
      /300%|incompat/,
    );
  });

  it("rejeita atingimento incompatível com o farol", () => {
    const base = seven([1, 1, 1, 1, 1, 1, 1]);
    const bad = [...base.slice(0, 6), { ...base[6], farol: "Sem compra" }];
    expect(validateFamilias(bad)).toMatch(/incompatível/);
  });

  it("rejeita categoria fora de Black/Gold/Silver", () => {
    const bi = buildBI("Bronze", 1, seven([1, 1, 1, 1, 1, 1, 1]));
    expect(validateClientBI(bi)).toMatch(/categoria inválida/);
  });
});

describe("fonte única bi.familias -> familias.itens", () => {
  it("deriva itens exatamente de bi.familias", () => {
    const bi = buildBI("Gold", 0.7, seven([0.95, 0.6, 1.1, 0.6, 0.95, 1.1, 0.95]));
    const itens = deriveFamiliasItens(bi).itens;
    expect(itens).toHaveLength(7);
    expect(itens).toEqual(getFamiliasCliente(bi));
    expect(itens.map((i) => i.familia)).toEqual([...CANONICAL_FAMILIES]);
  });

  it("descarta registros fora da lista oficial ao derivar", () => {
    const bi = buildBI("Gold", 0.7, [
      ...seven([1, 1, 1, 1, 1, 1, 1]),
      { familia: "1.1", atingimento: null, farol: null },
    ]);
    expect(deriveFamiliasItens(bi).itens).toHaveLength(7);
  });
});
