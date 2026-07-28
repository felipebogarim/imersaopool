import { describe, expect, it } from "vitest";
import { CANONICAL_FAMILIES, buildBI, farolFromAtingimento, type FamiliaResultado } from "./client-bi-familias";
import {
  buildProfileComparison,
  calculateCategoryAverageExcludingClient,
  calculateCategoryAverageIncludingClient,
  calculateCategoryFamilyAverages,
  calculateClientDifferences,
  calculateClientRanking,
  calculateProfileFarolDistribution,
  formatPp,
  getComparableClients,
  getLargestAdvantage,
  getLargestGap,
  isValidRecord,
  situacaoFromDiff,
  validateComparableGroup,
  type ComparableRecord,
} from "./client-profile-comparison";

const fam = (familia: string, at: number): FamiliaResultado => ({
  familia,
  atingimento: at,
  participacao: 0,
  farol: farolFromAtingimento(at),
});

/** BI com atingimentos por família em % (7 valores) e geral em %. */
const bi = (categoria: string, geral: number, vals: number[]) =>
  ({ ...buildBI(categoria, geral, CANONICAL_FAMILIES.map((f, i) => fam(f, vals[i]))) });

const rec = (over: Partial<ComparableRecord> & { data: any }): ComparableRecord => ({
  representative_id: "rep-1",
  periodo_label: "1º Semestre 2026",
  substituida_em: null,
  kind: "bi",
  ...over,
});

const flat = (v: number) => [v, v, v, v, v, v, v];

const FILTER = { representativeId: "rep-1", categoria: "Black", periodoLabel: "1º Semestre 2026" };

describe("filtragem da base comparável", () => {
  const alvo = rec({ data: bi("Black", 44.5, flat(50)) });
  const outros: ComparableRecord[] = [
    alvo,
    rec({ data: bi("Black", 60, flat(60)) }),
    rec({ representative_id: "rep-2", data: bi("Black", 90, flat(90)) }),
    rec({ data: bi("Gold", 90, flat(90)) }),
    rec({ periodo_label: "2º Semestre 2026", data: bi("Black", 90, flat(90)) }),
    rec({ substituida_em: "2026-01-01", data: bi("Black", 90, flat(90)) }),
    rec({ kind: "familias", data: bi("Black", 90, flat(90)) }),
  ];

  it("mantém apenas mesmo rep, categoria, período e versão ativa", () => {
    const { validos, excluidos } = getComparableClients(outros, FILTER);
    expect(validos).toHaveLength(2);
    expect(excluidos).toBe(0);
  });

  it("exclui registros incompletos e conta os excluídos", () => {
    const invalido = rec({ data: { categoria: "Black", geral: 30, familias: [fam("PRO LED", 10)] } as any });
    const { validos, excluidos } = getComparableClients([...outros, invalido], FILTER);
    expect(validos).toHaveLength(2);
    expect(excluidos).toBe(1);
  });

  it("valida o grupo comparável", () => {
    expect(validateComparableGroup(getComparableClients(outros, FILTER).validos)).toBe(true);
    expect(validateComparableGroup([])).toBe(false);
    expect(isValidRecord(null)).toBe(false);
  });
});

describe("médias", () => {
  const a = bi("Black", 44.5, flat(50));
  const b = bi("Black", 60, flat(60));
  const c = bi("Black", 80, flat(80));

  it("média geral com 2 clientes", () => {
    expect(calculateCategoryAverageIncludingClient([a, b])).toBeCloseTo(52.25, 6);
  });

  it("média geral com vários clientes", () => {
    expect(calculateCategoryAverageIncludingClient([a, b, c])).toBeCloseTo(61.5, 6);
  });

  it("média sem o cliente atual", () => {
    expect(calculateCategoryAverageExcludingClient([a, b, c], a)).toBeCloseTo(70, 6);
    expect(calculateCategoryAverageExcludingClient([a], a)).toBeNull();
  });

  it("média por família não arredonda no cálculo", () => {
    const g = [bi("Black", 90, [110, 0, 0, 110, 0, 0, 0]), bi("Black", 80, [95, 0, 0, 95, 0, 0, 0]), bi("Black", 60, [60, 0, 0, 60, 0, 0, 0])];
    const avg = calculateCategoryFamilyAverages(g);
    expect(avg["PRO LED"]).toBeCloseTo(88.3333333, 5);
  });
});

describe("diferenças", () => {
  const cliente = bi("Black", 44.5, [60, 25, 25, 110, 110, 25, 0]);
  const grupo = [cliente, bi("Black", 80, flat(80)), bi("Black", 60, flat(60))];

  it("calcula diferença em p.p. por família", () => {
    const fams = calculateClientDifferences(cliente, grupo);
    const proled = fams.find((f) => f.familia === "PRO LED")!;
    expect(proled.media).toBeCloseTo((110 + 80 + 60) / 3, 6);
    expect(proled.diffPp).toBeCloseTo(110 - 83.3333333, 5);
    expect(proled.situacao).toBe("acima");
  });

  it("classifica dentro de ±5 p.p. como próximo", () => {
    expect(situacaoFromDiff(4.9)).toBe("proximo");
    expect(situacaoFromDiff(-4.9)).toBe("proximo");
    expect(situacaoFromDiff(5.1)).toBe("acima");
    expect(situacaoFromDiff(-5.1)).toBe("abaixo");
    expect(situacaoFromDiff(0)).toBe("proximo");
    expect(situacaoFromDiff(null)).toBeNull();
  });

  it("formata p.p. sem símbolo de percentual", () => {
    expect(formatPp(-17)).toBe("−17,0 p.p.");
    expect(formatPp(8.5)).toBe("+8,5 p.p.");
    expect(formatPp(0)).toBe("0,0 p.p.");
  });
});

describe("ranking", () => {
  const c = bi("Black", 80, flat(80));
  it("sem empate", () => {
    expect(calculateClientRanking(c, [bi("Black", 110, flat(110)), bi("Black", 95, flat(95)), c])).toBe(3);
  });
  it("competitivo com empate", () => {
    const grupo = [bi("Black", 110, flat(110)), bi("Black", 95, flat(95)), bi("Black", 95, flat(95)), c];
    expect(calculateClientRanking(c, grupo)).toBe(4);
    expect(calculateClientRanking(bi("Black", 95, flat(95)), grupo)).toBe(2);
  });
  it("não ranqueia com apenas um cliente", () => {
    expect(calculateClientRanking(c, [c])).toBeNull();
  });
});

describe("destaques", () => {
  const grupo = (vals: number[][]) => vals.map((v) => bi("Black", v[0], v));

  it("maior vantagem e maior lacuna", () => {
    const cliente = bi("Black", 44.5, [60, 25, 25, 110, 110, 25, 0]);
    const fams = calculateClientDifferences(cliente, [cliente, ...grupo([flat(80), flat(60)])]);
    expect(getLargestAdvantage(fams)!.familia).toBe("PRO LED");
    expect(getLargestGap(fams)!.familia).toBe("FITAS E FONTES");
  });

  it("empate resolvido pela ordem oficial", () => {
    const cliente = bi("Black", 50, flat(50));
    const fams = calculateClientDifferences(cliente, [cliente, bi("Black", 40, flat(40))]);
    expect(getLargestAdvantage(fams)!.familia).toBe("DECOR NEWLINE");
    expect(getLargestGap(fams)!.familia).toBe("DECOR NEWLINE");
  });

  it("todas acima / todas abaixo / todas iguais", () => {
    const rows = (list: any[]) => list.map((d) => rec({ data: d }));
    const acima = bi("Black", 90, flat(90));
    const r1 = buildProfileComparison({
      cliente: acima,
      rows: rows([acima, bi("Black", 50, flat(50))]),
      representativeId: "rep-1",
      representante: "MARIO",
      periodoLabel: "1º Semestre 2026",
    });
    expect(r1.lacunaLabel).toBe("Ponto de menor diferenciação");

    const abaixo = bi("Black", 50, flat(50));
    const r2 = buildProfileComparison({
      cliente: abaixo,
      rows: rows([abaixo, bi("Black", 90, flat(90))]),
      representativeId: "rep-1",
      representante: "MARIO",
      periodoLabel: "1º Semestre 2026",
    });
    expect(r2.vantagemLabel).toBe("Resultado mais próximo da média");

    const igual = bi("Black", 60, flat(60));
    const r3 = buildProfileComparison({
      cliente: igual,
      rows: rows([igual, bi("Black", 60, flat(60))]),
      representativeId: "rep-1",
      representante: "MARIO",
      periodoLabel: "1º Semestre 2026",
    });
    expect(r3.destaquesMensagem).toBe("Desempenho alinhado à média em todas as famílias.");
  });
});

describe("faróis", () => {
  const cliente = bi("Black", 44.5, [60, 25, 25, 110, 110, 25, 0]);
  const grupo = [cliente, bi("Black", 110, flat(110))];

  it("distribuição do cliente totaliza 7 e categoria é percentual sobre n×7", () => {
    const dist = calculateProfileFarolDistribution(cliente, grupo);
    expect(dist.reduce((s, d) => s + d.clienteQtd, 0)).toBe(7);
    const soma = dist.reduce((s, d) => s + (d.categoriaPct ?? 0), 0);
    expect(soma).toBeCloseTo(100, 6);
    const excelente = dist.find((d) => d.status === "excelente")!;
    expect(excelente.clienteQtd).toBe(2);
    expect(excelente.categoriaPct).toBeCloseTo((9 / 14) * 100, 6);
  });
});

describe("orquestração e casos especiais", () => {
  const cliente = bi("Black", 44.5, [60, 25, 25, 110, 110, 25, 0]);

  it("cliente sozinho na categoria", () => {
    const r = buildProfileComparison({
      cliente,
      rows: [rec({ data: cliente })],
      representativeId: "rep-1",
      representante: "MARIO",
      periodoLabel: "1º Semestre 2026",
    });
    expect(r.ok).toBe(true);
    expect(r.soCliente).toBe(true);
    expect(r.posicao).toBeNull();
    expect(r.mediaGeral).toBeNull();
    expect(r.leituraExecutiva).toContain("base comparável");
  });

  it("sem base válida", () => {
    const r = buildProfileComparison({
      cliente,
      rows: [rec({ representative_id: "rep-2", data: cliente })],
      representativeId: "rep-1",
      representante: "MARIO",
      periodoLabel: "1º Semestre 2026",
    });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("sem_base");
  });

  it("cliente inválido interrompe a comparação", () => {
    const r = buildProfileComparison({
      cliente: { categoria: "Black", geral: 10, familias: [] } as any,
      rows: [],
      representativeId: "rep-1",
      representante: "MARIO",
      periodoLabel: "1º Semestre 2026",
    });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("cliente_invalido");
  });

  it("não mistura períodos", () => {
    const outro = bi("Black", 100, flat(100));
    const r = buildProfileComparison({
      cliente,
      rows: [rec({ data: cliente }), rec({ periodo_label: "2º Semestre 2026", data: outro })],
      representativeId: "rep-1",
      representante: "MARIO",
      periodoLabel: "1º Semestre 2026",
    });
    expect(r.baseSize).toBe(1);
  });

  it("leitura executiva é descritiva e em pontos percentuais", () => {
    const r = buildProfileComparison({
      cliente,
      rows: [rec({ data: cliente }), rec({ data: bi("Black", 61.5, flat(70)) })],
      representativeId: "rep-1",
      representante: "MARIO",
      periodoLabel: "1º Semestre 2026",
    });
    expect(r.mediaGeral).toBeCloseTo(53, 6);
    expect(r.leituraExecutiva).toContain("pontos percentuais");
    expect(r.leituraExecutiva).not.toMatch(/R\$/);
  });
});
