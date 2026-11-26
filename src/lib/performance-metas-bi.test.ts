import { describe, expect, it } from "vitest";
import {
  SEM_REGIAO,
  aggregateMetasBi,
  applyMetasBiFilters,
  buildMetasBiFacts,
  buildRepMetasBiFacts,
  dimensionOptions,
  matrixMetasBi,
  totalMetasBi,
  savedGoalForMonth,
  semesterMonths,
  yearMonths,
  periodLabel,
  scaleMetasBiFactsToMonthlyTarget,
  type MetasBiBackendRow,
  type MetasBiClient,
} from "./performance-metas-bi";

const clients: MetasBiClient[] = [
  { id: "a", razao_social: "ALFA", categoria: "Gold", repId: "r1", repName: "REP 1" },
  { id: "b", razao_social: "BETA", categoria: "Silver", repId: "r2", repName: "REP 2" },
  { id: "c", razao_social: "GAMA", categoria: "Arquitetura", repId: "r2", repName: "REP 2" },
];

const backend: MetasBiBackendRow[] = [
  {
    row_id: "a",
    representative_id: "r1",
    rep_regiao: "Interior",
    cliente_regiao: "Capital",
    cliente_uf: "sp",
    cliente_cidade: "São Paulo",
    ciclo_inicio: "2026-11-01",
    ciclo_fim: "2027-04-01",
    metas: {},
    realizado: { "DECOR NEWLINE": 2800, "PRO LED": 1200 },
    media: {},
    familia_pct: {},
    items: [{ familia: "DECOR NEWLINE", meta_mensal: "3000", origem: "gestor" }],
  },
  {
    row_id: "b",
    representative_id: "r2",
    rep_regiao: "Litoral",
    cliente_regiao: null,
    cliente_uf: null,
    cliente_cidade: null,
    ciclo_inicio: null,
    ciclo_fim: null,
    metas: {},
    realizado: {},
    media: { "PRO LAMP": 500 },
    familia_pct: {},
    items: [],
  },
];

const facts = buildMetasBiFacts(clients, backend);

describe("buildMetasBiFacts", () => {
  it("gera 7 fatos por cliente, com meta gravada prevalecendo sobre a padrão", () => {
    expect(facts).toHaveLength(21);
    const dn = facts.find((f) => f.rowId === "a" && f.familia === "DECOR NEWLINE")!;
    expect(dn).toMatchObject({ metaAtual: 3000, metaPadrao: 2500, origem: "gestor" });
    const studio = facts.find((f) => f.rowId === "a" && f.familia === "DECOR STUDIO")!;
    expect(studio).toMatchObject({ metaAtual: 3000, metaPadrao: 3000, origem: "padrao" });
  });

  it("região do cliente → região do representante → sem região; UF em maiúsculas", () => {
    expect(facts.find((f) => f.rowId === "a")).toMatchObject({ regiao: "Capital", uf: "SP" });
    expect(facts.find((f) => f.rowId === "b")).toMatchObject({ regiao: "Litoral" });
    expect(facts.find((f) => f.rowId === "c")).toMatchObject({ regiao: SEM_REGIAO });
  });

  it("categoria fora da matriz fica sem meta padrão", () => {
    expect(facts.filter((f) => f.rowId === "c").every((f) => f.metaAtual == null)).toBe(true);
  });

  it("usa média histórica quando não há realizado", () => {
    const lamp = facts.find((f) => f.rowId === "b" && f.familia === "PRO LAMP")!;
    expect(lamp).toMatchObject({ realizado: 500, fonte: "media" });
  });
});

describe("agregações", () => {
  it("total = soma das metas; atingimento só nos portfólios com base", () => {
    const t = totalMetasBi(facts);
    // Gold padrão 15000 + 500 de personalização; Silver 7000; Arquitetura sem meta.
    expect(t.metaAtual).toBe(22500);
    expect(t.metaPadrao).toBe(22000);
    expect(t.diferenca).toBe(500);
    expect(t.clientes).toBe(3);
    expect(t.personalizados).toBe(1);
    // (2800 + 1200 + 500) ÷ (3000 + 1500 + 1000)
    expect(t.atingimento).toBeCloseTo(4500 / 5500);
    expect(t.fonte).toBe("media");
  });

  it("os recortes somam o total", () => {
    const total = totalMetasBi(facts).metaAtual;
    for (const d of ["regiao", "representante", "familia", "categoria", "origem"] as const) {
      const sum = aggregateMetasBi(facts, d).reduce((s, g) => s + g.metaAtual, 0);
      expect(sum).toBe(total);
    }
  });

  it("portfólio mantém a ordem canônica", () => {
    const fam = aggregateMetasBi(facts, "familia").map((g) => g.key);
    expect(fam[0]).toBe("DECOR NEWLINE");
    expect(fam).toHaveLength(7);
  });

  it("filtros combinam dimensões", () => {
    const f = applyMetasBiFilters(facts, { representante: ["r2"], familia: ["PRO LAMP"] });
    expect(f).toHaveLength(2);
    expect(applyMetasBiFilters(facts, { regiao: [] })).toHaveLength(21);
  });

  it("matriz dimensão × portfólio bate com o agregado da linha", () => {
    const m = matrixMetasBi(facts, "representante");
    for (const { row, cells } of m) {
      const sum = Object.values(cells).reduce((s, c) => s + (c?.metaAtual ?? 0), 0);
      expect(sum).toBe(row.metaAtual);
    }
  });

  it("opções da dimensão usam rótulos legíveis", () => {
    expect(dimensionOptions(facts, "representante")).toEqual([
      { key: "r1", label: "REP 1" },
      { key: "r2", label: "REP 2" },
    ]);
  });
});

describe("BI seguro do representante", () => {
  it("agrega atingimento ponderado usando apenas meta oficial e percentual", () => {
    const repFacts = buildRepMetasBiFacts([
      {
        rowId: "a",
        cliente: "ALFA",
        categoria: "Gold",
        familia: "DECOR NEWLINE",
        metaOficial: 100,
        atingimento: 1,
        fonte: "realizado",
      },
      {
        rowId: "b",
        cliente: "BETA",
        categoria: "Silver",
        familia: "DECOR NEWLINE",
        metaOficial: 300,
        atingimento: 0.5,
        fonte: "realizado",
      },
    ]);
    const total = totalMetasBi(repFacts);
    expect(total.metaAtual).toBe(400);
    expect(total.atingimento).toBeCloseTo(250 / 400);
    expect(total.diferenca).toBe(0);
  });
});

describe("visão mensal da gestão", () => {
  it("reescala todo o racional para R$ 9 milhões por mês", () => {
    const source = buildRepMetasBiFacts([
      {
        rowId: "a",
        cliente: "ALFA",
        categoria: "Gold",
        familia: "DECOR NEWLINE",
        metaOficial: 2_000_000,
        atingimento: 0.5,
        fonte: "realizado",
      },
      {
        rowId: "b",
        cliente: "BETA",
        categoria: "Silver",
        familia: "PRO LED",
        metaOficial: 1_000_000,
        atingimento: 1,
        fonte: "realizado",
      },
    ]);
    const scaled = scaleMetasBiFactsToMonthlyTarget(source, 9_000_000, 2);
    expect(totalMetasBi(scaled).metaAtual).toBe(18_000_000);
    expect(scaled[0].metaAtual).toBe(12_000_000);
    expect(scaled[1].metaAtual).toBe(6_000_000);
    // Cenário 8,5MM/mês: total do período e atingimento recalculados; realizado intacto.
    const s85 = scaleMetasBiFactsToMonthlyTarget(source, 8_500_000, 1);
    const t85 = totalMetasBi(s85);
    expect(t85.metaAtual).toBe(8_500_000);
    expect(t85.realizado).toBe(totalMetasBi(source).realizado);
    expect(t85.atingimento).toBeCloseTo(t85.realizado / t85.metaComBase);
  });
});

describe("período (meses)", () => {
  const withCycles: MetasBiBackendRow[] = [
    {
      ...backend[0],
      cycles: [
        {
          inicio: "2026-11-01",
          fim: "2027-04-01",
          items: [
            {
              familia: "DECOR NEWLINE",
              vigente_desde: "2026-11-01",
              meta_mensal: 3000,
              origem: "ia",
            },
            {
              familia: "DECOR NEWLINE",
              vigente_desde: "2027-01-01",
              meta_mensal: 3500,
              origem: "gestor",
            },
          ],
        },
      ],
    },
  ];
  const one = [clients[0]];
  const dn = (months: string[]) =>
    buildMetasBiFacts(one, withCycles, months).find((f) => f.familia === "DECOR NEWLINE")!;

  it("usa a versão vigente em cada mês e o padrão fora do ciclo", () => {
    expect(savedGoalForMonth(withCycles[0], "DECOR NEWLINE", "2026-12-01")?.meta).toBe(3000);
    expect(savedGoalForMonth(withCycles[0], "DECOR NEWLINE", "2027-02-01")?.meta).toBe(3500);
    expect(savedGoalForMonth(withCycles[0], "DECOR NEWLINE", "2026-10-01")).toBeUndefined();
  });

  it("soma os meses: meta original × n, meta atual mês a mês, base × n", () => {
    const f = dn(["2026-10-01", "2026-12-01", "2027-01-01"]);
    expect(f.metaPadrao).toBe(2500 * 3);
    expect(f.metaAtual).toBe(2500 + 3000 + 3500);
    expect(f.realizado).toBe(2800 * 3);
    expect(f.origem).toBe("gestor");
  });

  it("ano inteiro = 12 competências", () => {
    expect(yearMonths(2027)).toHaveLength(12);
    expect(dn(yearMonths(2027)).metaAtual).toBe(3500 * 4 + 2500 * 8);
    expect(periodLabel(yearMonths(2027), 2027)).toBe("Ano 2027");
    expect(periodLabel(["2026-11-01"])).toBe("nov/26");
  });

  it("semestre = 6 competências", () => {
    expect(semesterMonths(2027, 1)).toEqual(yearMonths(2027).slice(0, 6));
    expect(semesterMonths(2027, 2)[0]).toBe("2027-07-01");
    // jan–mar com 3500 (ciclo até abr), abr–jun padrão.
    expect(dn(semesterMonths(2027, 1)).metaAtual).toBe(3500 * 4 + 2500 * 2);
    expect(periodLabel(semesterMonths(2027, 2), 2027)).toBe("2º semestre 2027");
  });
});

describe("resumoPortfolioRep", () => {
  it("identifica melhor, pior e portfólios abaixo do limiar, ignorando os sem base", async () => {
    const { resumoPortfolioRep, matrixMetasBi } = await import("./performance-metas-bi");
    const fato = (familia: string, meta: number, realizado: number | null) => ({
      rowId: "r1",
      cliente: "C",
      repId: "rep",
      repName: "Rep",
      regiao: "Sul",
      uf: "SC",
      categoria: "Gold",
      familia,
      metaAtual: meta,
      metaPadrao: meta,
      origem: "padrao" as const,
      realizado,
      fonte: realizado == null ? null : ("realizado" as const),
    });
    const fams = [...(await import("./client-bi-familias")).CANONICAL_FAMILIES];
    const facts = [
      fato(fams[0], 100, 120),
      fato(fams[1], 100, 40),
      fato(fams[2], 100, 80),
      fato(fams[3], 100, null),
    ] as Parameters<typeof matrixMetasBi>[0];
    const [{ cells }] = matrixMetasBi(facts, "representante");
    const r = resumoPortfolioRep(cells);
    expect(r.avaliados).toBe(3);
    expect(r.abaixo).toBe(1);
    expect(r.melhor?.key).toBe(fams[0]);
    expect(r.pior?.key).toBe(fams[1]);
  });
});
