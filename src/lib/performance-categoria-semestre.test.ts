import { describe, expect, it } from "vitest";
import {
  baseCategoriaSemestral,
  baseEstimada,
  pisoSemestral,
  posicaoReguaMensal,
  semestreDeCorte,
  situacaoCategoria,
  type UploadCategoria,
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

const FAM = ["PERFIL", "PRO LED"];
const HOJE = new Date(2026, 10, 25);
const up = (
  id: string,
  ini: string,
  fim: string,
  realizado: Record<string, number>,
  media: Record<string, number>,
  atual = false,
): UploadCategoria => ({
  upload_id: id,
  atual,
  periodo_label: id,
  periodo_inicio: ini,
  periodo_fim: fim,
  realizado,
  media,
});

describe("baseCategoriaSemestral", () => {
  it("upload jan–out sem dados só do semestre → média ESTIMADA pelo período do upload", () => {
    const b = baseCategoriaSemestral(
      [
        up(
          "Janeiro a Outubro 2026",
          "2026-01-01",
          "2026-10-31",
          { PERFIL: 9000, "PRO LED": 10200 },
          { PERFIL: 12000, "PRO LED": 9000 },
          true,
        ),
      ],
      FAM,
      HOJE,
    );
    expect(b.fonte).toBe("estimada");
    expect(b.mediaMensal).toBe(21_000); // coluna MÉDIA, não o realizado
    expect(b.acumuladoReal).toBeNull();
    expect(b.semestre.label).toBe("2º semestre 2026");
    expect(b.composicao).toEqual([
      { familia: "PERFIL", mediaMensal: 12000, origem: "média do período do upload" },
      { familia: "PRO LED", mediaMensal: 9000, origem: "média do período do upload" },
    ]);
    expect(b.memoria.join(" ")).toContain("ESTIMADA");
  });

  it("uploads mensais jul–out → média real do semestre e acumulado real", () => {
    const b = baseCategoriaSemestral(
      [
        up("Jan-Out", "2026-01-01", "2026-10-31", { PERFIL: 1 }, { PERFIL: 99999 }, true),
        up("jul", "2026-07-01", "2026-07-31", { PERFIL: 20000 }, { PERFIL: 5 }),
        up("ago", "2026-08-01", "2026-08-31", { PERFIL: 22000 }, { PERFIL: 5 }),
        up("set", "2026-09-01", "2026-09-30", { PERFIL: 18000 }, {}),
        up("out", "2026-10-01", "2026-10-31", { PERFIL: 24000 }, {}),
      ],
      FAM,
      HOJE,
    );
    expect(b.fonte).toBe("semestre");
    expect(b.acumuladoReal).toBe(84_000);
    expect(b.mediaMensal).toBe(21_000);
    expect(b.periodoMedia).toBe("jul/2026 a out/2026");
    expect(b.composicao[0]).toMatchObject({ familia: "PERFIL", mediaMensal: 21000 });
  });

  it("upload jul–out (vários meses) usa a média mensal desse período", () => {
    const b = baseCategoriaSemestral(
      [up("Jul-Out", "2026-07-01", "2026-10-31", { PERFIL: 50000 }, { PERFIL: 19000 }, true)],
      FAM,
      HOJE,
    );
    expect(b.fonte).toBe("semestre");
    expect(b.mediaMensal).toBe(19_000);
    expect(b.acumuladoReal).toBe(76_000);
  });

  it("só parte dos meses do semestre → parcial, acumulado não é real", () => {
    const b = baseCategoriaSemestral(
      [
        up("Jan-Out", "2026-01-01", "2026-10-31", {}, { PERFIL: 1 }, true),
        up("set", "2026-09-01", "2026-09-30", { PERFIL: 30000 }, {}),
      ],
      FAM,
      HOJE,
    );
    expect(b.fonte).toBe("semestre_parcial");
    expect(b.mesesObservados).toBe(1);
    expect(b.mediaMensal).toBe(30_000);
    expect(b.acumuladoReal).toBeNull();
  });
});

describe("situacaoCategoria", () => {
  it("pisos semestrais = 6 × piso mensal", () => {
    expect(pisoSemestral("Silver")).toBe(18_000);
    expect(pisoSemestral("Gold")).toBe(36_000);
    expect(pisoSemestral("Black")).toBe(120_000);
  });

  it("Black, média estimada 19.200 até outubro → em risco, indicadores separados", () => {
    const s = situacaoCategoria("Black", baseEstimada(19_200, "2026-10-31", "Jan-Out", HOJE));
    expect(s.estado).toBe("risco");
    expect(s.mediaEstimada).toBe(true);
    expect(s.acumuladoEstimado).toBe(true);
    expect(s.manter.pisoMensal).toBe(20_000);
    expect(s.manter.atingimentoPct).toBeCloseTo(96);
    expect(s.acumulado).toBe(76_800);
    expect(s.projecao).toBe(115_200);
    expect(s.manter.saldoProjetado).toBe(-4_800); // déficit no fechamento
    expect(s.manter.volumeNecessario).toBe(43_200); // compras até dez
    expect(s.manter.necessarioMes).toBe(21_600); // nov–dez
    expect(s.risco.nivel).toBe("medio");
    expect(s.risco.descricao).toContain("(estimada)");
  });

  it("Black com média ≥ 20.000 → em manutenção (não garantida sem acumulado real)", () => {
    const s = situacaoCategoria("Black", baseEstimada(21_000, "2026-10-31", "x", HOJE));
    expect(s.estado).toBe("manutencao");
    expect(s.manter.saldoProjetado).toBe(6_000); // excedente
    expect(s.manter.atingimentoPct).toBe(105);
  });

  it("acumulado real ≥ piso semestral → garantida", () => {
    const base = baseCategoriaSemestral(
      [up("Jul-Out", "2026-07-01", "2026-10-31", {}, { PERFIL: 40000 }, true)],
      FAM,
      HOJE,
    );
    const s = situacaoCategoria("Black", base);
    expect(base.acumuladoReal).toBe(160_000);
    expect(s.estado).toBe("garantida");
    expect(s.manter.volumeNecessario).toBe(0);
    expect(s.manter.necessarioMes).toBeNull();
  });

  it("Gold com média da próxima categoria → evolução projetada", () => {
    const s = situacaoCategoria("Gold", baseEstimada(22_000, "2026-10-31", "x", HOJE));
    expect(s.estado).toBe("manutencao");
    expect(s.evolucaoProjetada).toBe(true);
    expect(s.proxima?.categoria).toBe("Black");
  });

  it("média abaixo do piso anterior → alto risco; semestre encerrado → degrade no corte", () => {
    expect(
      situacaoCategoria("Black", baseEstimada(5_000, "2026-08-31", "x", HOJE)).risco.nivel,
    ).toBe("alto");
    const enc = situacaoCategoria("Gold", baseEstimada(5_000, "2026-06-30", "x", HOJE));
    expect(enc.encerrado).toBe(true);
    expect(enc.risco.titulo).toBe("Degrade no corte");
    expect(enc.manter.necessarioMes).toBeNull();
  });

  it("média exatamente no piso conta como manutenção", () => {
    expect(situacaoCategoria("Gold", baseEstimada(6_000, "2026-08-31", "x", HOJE)).estado).toBe(
      "manutencao",
    );
  });
});

describe("posicaoReguaMensal", () => {
  it("marcos nos pisos mensais", () => {
    expect(posicaoReguaMensal(0)).toBe(0);
    expect(posicaoReguaMensal(3_000)).toBeCloseTo(33.3);
    expect(posicaoReguaMensal(6_000)).toBeCloseTo(66.6);
    expect(posicaoReguaMensal(20_000)).toBe(100);
  });
});
