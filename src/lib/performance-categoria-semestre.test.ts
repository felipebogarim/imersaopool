import { describe, expect, it } from "vitest";
import {
  pisoSemestral,
  posicaoReguaSemestral,
  semestreDeCorte,
  situacaoSemestral,
} from "./performance-categoria-semestre";

describe("semestreDeCorte", () => {
  it("dados até outubro → 2º semestre, jul–out decorridos, nov–dez restantes", () => {
    const s = semestreDeCorte("2026-10-31");
    expect(s).toMatchObject({
      ano: 2026,
      semestre: 2,
      label: "2º semestre 2026",
      mesesLabel: "jul–dez",
      mesesDecorridos: 4,
      mesesRestantes: 2,
      decorridosLabel: "jul–out",
      restantesLabel: "nov–dez",
    });
  });

  it("dados até junho → 1º semestre encerrado", () => {
    const s = semestreDeCorte("2026-06-30");
    expect(s.semestre).toBe(1);
    expect(s.mesesDecorridos).toBe(6);
    expect(s.mesesRestantes).toBe(0);
    expect(s.restantesLabel).toBe("");
  });

  it("sem data: mês corrente ainda em aberto", () => {
    const s = semestreDeCorte(null, new Date(2026, 10, 25)); // 25/nov
    expect(s.semestre).toBe(2);
    expect(s.mesesDecorridos).toBe(4); // jul–out
    const jul = semestreDeCorte(undefined, new Date(2026, 6, 3));
    expect(jul.mesesDecorridos).toBe(0);
    expect(jul.decorridosLabel).toBe("");
  });
});

describe("situacaoSemestral", () => {
  it("pisos semestrais = 6 × piso mensal", () => {
    expect(pisoSemestral("Silver")).toBe(18_000);
    expect(pisoSemestral("Gold")).toBe(36_000);
    expect(pisoSemestral("Black")).toBe(120_000);
  });

  it("Black com média 19.200 até outubro: falta o acumulado do semestre no ritmo atual", () => {
    const r = situacaoSemestral({
      categoria: "Black",
      mediaMensal: 19_200,
      semestre: semestreDeCorte("2026-10-31"),
    });
    expect(r.acumulado).toBe(76_800);
    expect(r.acumuladoEstimado).toBe(true);
    expect(r.projecao).toBe(115_200);
    expect(r.manter.piso).toBe(120_000);
    expect(r.manter.atingido).toBe(false);
    expect(r.manter.falta).toBe(4_800); // (20.000 − 19.200) × 6, não R$ 800
    expect(r.manter.necessarioMes).toBe(21_600); // (120.000 − 76.800) ÷ 2 meses
    expect(r.manter.atingimentoPct).toBeCloseTo(96);
    expect(r.upgrade).toBeNull();
    expect(r.risco.nivel).toBe("medio");
    expect(r.risco.descricao).toContain("nov–dez");
  });

  it("Black com média acima de 20.000: categoria mantida, nada falta", () => {
    const r = situacaoSemestral({
      categoria: "Black",
      mediaMensal: 21_000,
      semestre: semestreDeCorte("2026-10-31"),
    });
    expect(r.manter.atingido).toBe(true);
    expect(r.manter.garantido).toBe(false);
    expect(r.manter.falta).toBe(0);
    expect(r.manter.sobra).toBe(6_000);
    expect(r.risco.nivel).toBe("baixo");
    expect(r.risco.titulo).toBe("Categoria Mantida");
  });

  it("média exatamente no piso conta como atingido", () => {
    const r = situacaoSemestral({
      categoria: "Gold",
      mediaMensal: 6_000,
      semestre: semestreDeCorte("2026-08-31"),
    });
    expect(r.manter.atingido).toBe(true);
    expect(r.manter.falta).toBe(0);
  });

  it("usa o acumulado real quando informado", () => {
    const r = situacaoSemestral({
      categoria: "Gold",
      mediaMensal: 7_000,
      acumulado: 40_000,
      semestre: semestreDeCorte("2026-10-31"),
    });
    expect(r.acumuladoEstimado).toBe(false);
    expect(r.projecao).toBe(54_000);
    expect(r.manter.garantido).toBe(true);
    expect(r.manter.necessarioMes).toBeNull();
    expect(r.upgrade?.falta).toBe(66_000);
    expect(r.upgrade?.necessarioMes).toBe(40_000);
    expect(r.risco.titulo).toBe("Categoria Garantida");
  });

  it("semestre encerrado abaixo do piso → degrade no corte", () => {
    const r = situacaoSemestral({
      categoria: "Gold",
      mediaMensal: 5_000,
      semestre: semestreDeCorte("2026-06-30"),
    });
    expect(r.encerrado).toBe(true);
    expect(r.manter.falta).toBe(6_000);
    expect(r.manter.necessarioMes).toBeNull();
    expect(r.risco.titulo).toBe("Degrade no Corte");
  });

  it("média abaixo do piso anterior → alto risco", () => {
    const r = situacaoSemestral({
      categoria: "Black",
      mediaMensal: 5_000,
      semestre: semestreDeCorte("2026-08-31"),
    });
    expect(r.projecao).toBe(30_000);
    expect(r.risco.nivel).toBe("alto");
  });

  it("categoria desconhecida cai em Silver", () => {
    const r = situacaoSemestral({
      categoria: null,
      mediaMensal: 3_500,
      semestre: semestreDeCorte("2026-03-31"),
    });
    expect(r.categoria).toBe("Silver");
    expect(r.acumulado).toBe(10_500);
    expect(r.manter.atingido).toBe(true);
    expect(r.upgrade?.falta).toBe(15_000); // (6.000 − 3.500) × 6
  });
});

describe("posicaoReguaSemestral", () => {
  it("marcos nos pisos semestrais", () => {
    expect(posicaoReguaSemestral(0)).toBe(0);
    expect(posicaoReguaSemestral(18_000)).toBeCloseTo(33.3);
    expect(posicaoReguaSemestral(36_000)).toBeCloseTo(66.6);
    expect(posicaoReguaSemestral(120_000)).toBe(100);
  });
});
