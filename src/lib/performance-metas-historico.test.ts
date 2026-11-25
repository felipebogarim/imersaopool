import { describe, expect, it } from "vitest";
import { historicoPeriodos } from "./performance-metas-historico";

describe("historicoPeriodos", () => {
  const cycles = [
    {
      id: "s2",
      inicio: "2026-07-01",
      fim: "2026-12-01",
      items: [
        { familia: "PERFIL", vigente_desde: "2026-11-01", meta_mensal: 1000 },
        { familia: "PRO LED", vigente_desde: "2026-11-01", meta_mensal: 500 },
      ],
    },
    {
      id: "s1",
      inicio: "2027-01-01",
      fim: "2027-06-01",
      items: [
        { familia: "PERFIL", vigente_desde: "2027-01-01", meta_mensal: 1500 },
        { familia: "PRO LED", vigente_desde: "2027-01-01", meta_mensal: 500 },
        { familia: "PERFIL", vigente_desde: "2027-04-01", meta_mensal: 1800 },
      ],
    },
  ];

  it("períodos por mudança, do mais recente ao mais antigo, sem meses antes da 1ª meta", () => {
    const r = historicoPeriodos(cycles, new Date(2026, 10, 25));
    expect(r.map((p) => [p.inicio, p.fim, p.total, p.situacao])).toEqual([
      ["2027-04-01", "2027-06-01", 2300, "futuro"],
      ["2027-01-01", "2027-03-01", 2000, "futuro"],
      ["2026-11-01", "2026-12-01", 1500, "vigente"],
    ]);
    expect(r[0].metas).toEqual({ PERFIL: 1800, "PRO LED": 500 });
  });

  it("período passado e meta nula", () => {
    const r = historicoPeriodos(
      [
        {
          id: "x",
          inicio: "2026-01-01",
          fim: "2026-06-01",
          items: [{ familia: "PERFIL", vigente_desde: "2026-01-01", meta_mensal: null }],
        },
      ],
      new Date(2026, 10, 1),
    );
    expect(r).toHaveLength(1);
    expect(r[0].situacao).toBe("passado");
    expect(r[0].total).toBe(0);
    expect(r[0].metas.PERFIL).toBeNull();
  });
});
