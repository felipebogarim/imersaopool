import { describe, expect, it } from "vitest";
import { acumuladoNoAno, mediaDoPortfolio, mediaMensalCompras } from "./performance-media-cliente";

describe("média mensal de compras (fonte única)", () => {
  it("prioriza valor real: média, depois realizado", () => {
    expect(
      mediaDoPortfolio({ media: { PERFIL: 5000 }, realizado: { PERFIL: 9000 } }, "PERFIL"),
    ).toEqual({ valor: 5000, fonte: "media" });
    expect(mediaDoPortfolio({ realizado: { PERFIL: 9000 } }, "PERFIL")).toEqual({
      valor: 9000,
      fonte: "realizado",
    });
  });

  it("estima por % × meta ORIGINAL do upload (aceita 0,8 ou 80)", () => {
    expect(
      mediaDoPortfolio({ familia_pct: { PERFIL: 0.8 }, metas: { PERFIL: 7000 } }, "PERFIL"),
    ).toEqual({ valor: 5600, fonte: "estimado" });
    expect(
      mediaDoPortfolio({ familia_pct: { PERFIL: 80 }, metas: { PERFIL: 7000 } }, "PERFIL")?.valor,
    ).toBe(5600);
  });

  it("sem meta original não estima (não usa meta padrão nem meta do gestor)", () => {
    expect(mediaDoPortfolio({ familia_pct: { PERFIL: 0.8 }, metas: {} }, "PERFIL")).toBeNull();
  });

  it("ausência de dado NUNCA vira zero; zero informado continua zero", () => {
    const m = mediaMensalCompras({
      media: { PERFIL: 12000 },
      realizado: { "PRO LED": 0 },
      familia_pct: { "DECOR STUDIO": 1.1 },
      metas: { "DECOR STUDIO": 6000 },
    });
    expect(m.total).toBe(12000 + 0 + 6600);
    expect(m.estimado).toBe(true);
    expect(m.semDado).toHaveLength(4);
    expect(m.portfolios.find((p) => p.familia === "PRO LED")).toMatchObject({
      valor: 0,
      fonte: "realizado",
    });
    expect(mediaMensalCompras({}).total).toBeNull();
    expect(mediaMensalCompras(null).total).toBeNull();
    expect(mediaMensalCompras(undefined).total).toBeNull();
  });

  it("cliente só com % (caso A&M/AMX): média estimada, não R$ 0", () => {
    const m = mediaMensalCompras({
      familia_pct: { PERFIL: 0.95, "PRO LED": 0.6, "DECOR NEWLINE": 1.1 },
      metas: { PERFIL: 7000, "PRO LED": 3000, "DECOR NEWLINE": 8000 },
    });
    expect(m.total).toBeCloseTo(6650 + 1800 + 8800);
    expect(m.estimado).toBe(true);
  });

  it("acumulado no ano = média × meses do período no ano; sem datas, não supõe", () => {
    expect(acumuladoNoAno(20000, "2026-01-01", "2026-10-31")).toEqual({
      valor: 200000,
      meses: 10,
      ano: 2026,
    });
    expect(acumuladoNoAno(20000, "2025-11-01", "2026-03-31")?.meses).toBe(3);
    expect(acumuladoNoAno(20000, null, "2026-10-31")).toBeNull();
    expect(acumuladoNoAno(null, "2026-01-01", "2026-10-31")).toBeNull();
  });
});
