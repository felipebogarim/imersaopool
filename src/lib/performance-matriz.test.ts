import { describe, expect, it } from "vitest";
import { parseMatrizFinanceiraGrid, validateMatrizFinanceira } from "./performance-matriz";

const HEADER = [
  "CATEGORIA",
  "DECOR NEWLINE",
  "DECOR STUDIO",
  "SISTEMAS E MÓDULOS",
  "PRO LED",
  "PRO LAMP",
  "PERFIL",
  "FITAS E FONTES",
  "TOTAL META",
];

const linha = (cat: string, v: number[]) => [cat, ...v, v.reduce((a, b) => a + b, 0)];

const gridOk = () => [
  ["Matriz Financeira"],
  HEADER,
  linha("Black", [10000, 9000, 8000, 7000, 6000, 5000, 4000]),
  linha("Gold", [5000, 4500, 4000, 3500, 3000, 2500, 2000]),
  linha("Silver", [2500, 2250, 2000, 1750, 1500, 1250, 1000]),
];

describe("parseMatrizFinanceiraGrid", () => {
  it("lê Black, Gold e Silver com as sete famílias e o Total Meta", () => {
    const res = parseMatrizFinanceiraGrid(gridOk());
    expect(res.categorias).toEqual(["Black", "Gold", "Silver"]);
    expect(res.familias).toHaveLength(7);
    expect(Object.keys(res.matriz.Black)).toHaveLength(7);
    expect(res.totais.Black).toBe(49000);
    expect(validateMatrizFinanceira(res)).toEqual([]);
  });

  it("aponta categoria ausente", () => {
    const g = gridOk().filter((r) => r[0] !== "Silver");
    const erros = validateMatrizFinanceira(parseMatrizFinanceiraGrid(g));
    expect(erros.some((e) => e.includes("Silver"))).toBe(true);
  });

  it("aponta família sem valor", () => {
    const g = gridOk();
    (g[2] as any[])[6] = null; // Perfil do Black
    const erros = validateMatrizFinanceira(parseMatrizFinanceiraGrid(g));
    expect(erros.some((e) => e.includes("Black") && e.toLowerCase().includes("perfil"))).toBe(true);
  });

  it("aponta Total Meta incoerente com a soma das famílias", () => {
    const g = gridOk();
    (g[3] as any[])[8] = 999999; // total do Gold
    const erros = validateMatrizFinanceira(parseMatrizFinanceiraGrid(g));
    expect(erros.some((e) => e.includes("Gold") && e.includes("Total Meta"))).toBe(true);
  });

  it("não expõe valores financeiros nas mensagens de erro", () => {
    const g = gridOk();
    (g[3] as any[])[8] = 999999;
    for (const e of validateMatrizFinanceira(parseMatrizFinanceiraGrid(g))) {
      expect(/\d{3,}/.test(e)).toBe(false);
    }
  });

  it("falha quando o cabeçalho CATEGORIA não existe", () => {
    expect(() => parseMatrizFinanceiraGrid([["algo"], ["outro"]])).toThrow(/CATEGORIA/);
  });
});
