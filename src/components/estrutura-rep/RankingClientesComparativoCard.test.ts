import { describe, it, expect } from "vitest";
import { calcPontosRanking } from "./RankingClientesComparativoCard";

describe("RankingClientesComparativoCard - calcPontosRanking", () => {
  it("calcula pontuação corretamente com 1 pt silver, 2 pts gold e 3 pts black", () => {
    const periodo = {
      label: "2025 (Ano Completo)",
      qtd_silver: 18,
      qtd_gold: 8,
      qtd_black: 3,
    };

    const res = calcPontosRanking(periodo);

    expect(res.pontosSilver).toBe(18 * 1); // 18
    expect(res.pontosGold).toBe(8 * 2); // 16
    expect(res.pontosBlack).toBe(3 * 3); // 9
    expect(res.totalPontos).toBe(18 + 16 + 9); // 43
    expect(res.totalClientes).toBe(18 + 8 + 3); // 29
  });

  it("trata valores nulos ou vazios com segurança", () => {
    const res = calcPontosRanking(undefined);
    expect(res.totalPontos).toBe(0);
    expect(res.totalClientes).toBe(0);
  });

  it("calcula aumento de pontuação em período de expansão", () => {
    const periodo1 = {
      label: "2025",
      qtd_silver: 10,
      qtd_gold: 5,
      qtd_black: 2,
    };
    const periodo2 = {
      label: "2026",
      qtd_silver: 12,
      qtd_gold: 8,
      qtd_black: 4,
    };

    const res1 = calcPontosRanking(periodo1); // 10*1 + 5*2 + 2*3 = 10 + 10 + 6 = 26 pts
    const res2 = calcPontosRanking(periodo2); // 12*1 + 8*2 + 4*3 = 12 + 16 + 12 = 40 pts

    expect(res1.totalPontos).toBe(26);
    expect(res2.totalPontos).toBe(40);
    expect(res2.totalPontos - res1.totalPontos).toBe(14);
  });
});
