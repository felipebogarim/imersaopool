import { describe, expect, it } from "vitest";
import {
  SEM_REGIAO,
  aggregateMetasBi,
  applyMetasBiFilters,
  buildMetasBiFacts,
  dimensionOptions,
  matrixMetasBi,
  totalMetasBi,
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
