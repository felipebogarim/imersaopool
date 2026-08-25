import { describe, expect, it } from "vitest";
import {
  CALCULATION_VERSION,
  FAROL_COEFFICIENT,
  calculateClientBI,
  calculateRepresentativeBI,
  classifyFarol,
  getFarolCoefficient,
  isBIForVersion,
  validateClientBIResult,
  type PerformanceRow,
  type PerformanceVersion,
} from "./performance-bi-engine";

// Dados 100% sintéticos: nenhum nome real, nenhum resultado esperado da planilha.
const FAMS = ["F1", "F2", "F3", "F4"];

const makeVersion = (id: string, pesos?: Record<string, number>): PerformanceVersion => ({
  id,
  periodo_label: `versao-${id}`,
  familias: FAMS,
  familia_participacao_categoria: pesos ? { A: pesos } : null,
});

const makeRow = (ratios: Array<number | null>, categoria = "A"): PerformanceRow => ({
  razao_social: "CLIENTE SINTETICO",
  categoria,
  familia_pct: Object.fromEntries(FAMS.map((f, i) => [f, ratios[i] ?? null])),
});

describe("invariantes do motor Performance → BI", () => {
  const ratiosSinteticos = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5, 10];

  it("A/B/C — farol, coeficiente e índice ponderado derivam do ratio", () => {
    const version = makeVersion("v1");
    for (const r of ratiosSinteticos) {
      const bi = calculateClientBI(version, makeRow([r, r, r, r]));
      for (const f of bi.familias) {
        expect(f.farol).toBe(classifyFarol(f.atingimento_ratio));
        expect(f.coeficiente_farol).toBe(getFarolCoefficient(f.farol));
        expect(f.indice_ponderado).toBeCloseTo(f.meta_peso * (f.coeficiente_farol as number), 10);
      }
      expect(validateClientBIResult(bi)).toEqual([]);
    }
  });

  it("ratios > 1 nunca mudam de unidade", () => {
    const bi = calculateClientBI(makeVersion("v1"), makeRow([2.3, 5.4, 0, 0.8]));
    expect(bi.familias[0].atingimento_ratio).toBe(2.3);
    expect(bi.familias[1].atingimento_ratio).toBe(5.4);
    expect(bi.familias[2].atingimento_ratio).toBe(0);
    expect(bi.familias[0].farol).toBe("excelente");
    expect(bi.familias[2].farol).toBe("sem_compra");
  });

  it("D — a distribuição do farol soma o total de famílias", () => {
    const bi = calculateClientBI(makeVersion("v1"), makeRow([0, 0.4, 0.8, 1.2]));
    const soma = bi.distribuicao_farol.reduce((s, g) => s + g.quantidade, 0);
    expect(soma).toBe(bi.familias.length);
  });

  it("participações somam 1 quando existe índice positivo", () => {
    const bi = calculateClientBI(makeVersion("v1"), makeRow([0.3, 0.6, 0.95, 1.4]));
    const soma = bi.familias.reduce((s, f) => s + (f.participacao ?? 0), 0);
    expect(soma).toBeCloseTo(1, 10);
  });

  it("E — alterar o atingimento de uma família altera os indicadores", () => {
    const version = makeVersion("v1");
    const antes = calculateClientBI(version, makeRow([0.4, 0.4, 0.4, 0.4]));
    const depois = calculateClientBI(version, makeRow([1.4, 0.4, 0.4, 0.4]));
    expect(depois.indice_geral).toBeGreaterThan(antes.indice_geral as number);
    expect(depois.atingimento_geral_ratio).toBeGreaterThan(antes.atingimento_geral_ratio as number);
    expect(depois.melhor_familia.label).toBe("F1");
  });

  it("F — alterar a meta (peso) altera as ponderações", () => {
    const row = makeRow([0.4, 1.4, 0.4, 0.4]);
    const igual = calculateClientBI(makeVersion("v1"), row);
    const pesado = calculateClientBI(
      makeVersion("v1", { F1: 0.1, F2: 0.7, F3: 0.1, F4: 0.1 }),
      row,
    );
    const pF2Igual = igual.familias.find((f) => f.familia === "F2")?.participacao as number;
    const pF2Pesado = pesado.familias.find((f) => f.familia === "F2")?.participacao as number;
    expect(pF2Pesado).toBeGreaterThan(pF2Igual);
    expect(pesado.indice_geral).not.toBeCloseTo(igual.indice_geral as number, 6);
  });

  it("G/H — o BI carrega a versão de Performance de origem", () => {
    const a = calculateClientBI(makeVersion("vA"), makeRow([0.5, 0.5, 0.5, 0.5]));
    const b = calculateClientBI(makeVersion("vB"), makeRow([0.9, 0.9, 0.9, 0.9]));
    expect(a.performance_version_id).toBe("vA");
    expect(b.performance_version_id).toBe("vB");
    expect(isBIForVersion(a, "vB")).toBe(false);
    expect(isBIForVersion(a, "vA")).toBe(true);
    expect(isBIForVersion({ ...a, calculation_version: "outra" }, "vA")).toBe(false);
  });

  it("I/J — reproduzível sem qualquer artefato antigo de BI", () => {
    const version = makeVersion("v1");
    const row = makeRow([0.2, 0.65, 0.99, 1.3]);
    const x = calculateClientBI(version, row);
    const y = calculateClientBI(version, row);
    expect(x.calculation_version).toBe(CALCULATION_VERSION);
    expect({ ...x, calculated_at: "" }).toEqual({ ...y, calculated_at: "" });
  });

  it("coeficientes do farol seguem a metodologia declarada", () => {
    expect(FAROL_COEFFICIENT).toEqual({
      sem_compra: 0,
      abaixo_meta: 0.25,
      pode_melhorar: 0.6,
      proximo: 0.8,
      otimo: 0.95,
      excelente: 1.1,
    });
  });

  it("ausência de informação não vira zero", () => {
    const bi = calculateClientBI(makeVersion("v1"), makeRow([null, null, null, null]));
    for (const f of bi.familias) {
      expect(f.atingimento_ratio).toBeNull();
      expect(f.farol).toBeNull();
    }
    expect(bi.atingimento_geral_ratio).toBeNull();
    expect(bi.erros.length).toBeGreaterThan(0);
  });

  it("BI do representante agrega apenas a versão informada", () => {
    const version = makeVersion("v1");
    const rows: PerformanceRow[] = [
      { ...makeRow([0.2, 0.4, 0.6, 0.8], "A"), razao_social: "C1" },
      { ...makeRow([1.2, 1.4, 0.6, 0.1], "B"), razao_social: "C2" },
    ];
    const rep = calculateRepresentativeBI(version, rows);
    expect(rep.performance_version_id).toBe("v1");
    expect(rep.clientes.map((c) => c.razao_social)).toEqual(["C1", "C2"]);
    const somaCat = rep.categorias.reduce((s, c) => s + (c.participacao ?? 0), 0);
    expect(somaCat).toBeCloseTo(1, 10);
    const somaFam = rep.familias.reduce((s, f) => s + f.shareRatio, 0);
    expect(somaFam).toBeCloseTo(1, 10);
  });
});
