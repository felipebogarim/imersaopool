import { describe, expect, it } from "vitest";
import {
  deslocarSemana,
  ordenarVisitas,
  pontosDaVisita,
  resumoPerformance,
  semanaDe,
} from "./rep-agenda";

describe("guia de agenda", () => {
  it("semana de segunda a domingo", () => {
    const s = semanaDe("2026-11-25"); // quarta
    expect(s.inicio).toBe("2026-11-23");
    expect(s.fim).toBe("2026-11-29");
    expect(s.dias[0].label).toBe("Segunda, 23/11");
    expect(semanaDe("2026-11-29").inicio).toBe("2026-11-23"); // domingo
    expect(deslocarSemana("2026-11-25", 1)).toBe("2026-12-02");
  });

  it("ordena por data e hora, sem hora no fim do dia", () => {
    const v = ordenarVisitas([
      { data: "2026-11-24", hora: null, cliente: "B" },
      { data: "2026-11-24", hora: "09:00", cliente: "C" },
      { data: "2026-11-23", hora: "15:00", cliente: "A" },
    ]);
    expect(v.map((x) => x.cliente)).toEqual(["A", "C", "B"]);
  });

  it("resumo pondera o atingimento pela meta e separa destaques/atenção", () => {
    const r = resumoPerformance({
      items: [
        { familia: "PERFIL", meta_mensal: 3000 },
        { familia: "PRO LED", meta_mensal: 1000 },
      ],
      atingimento: { PERFIL: { ratio: 1.2 }, "PRO LED": { ratio: 0.4 } },
    } as never);
    expect(r.geral).toBeCloseTo((1.2 * 3000 + 0.4 * 1000) / 4000);
    expect(r.destaques.map((p) => p.familia)).toEqual(["PERFIL"]);
    expect(r.atencao.map((p) => p.familia)).toEqual(["PRO LED"]);
    const pontos = pontosDaVisita({
      resumo: r,
      acoesAbertas: [{ title: "Treinar vendedores", due_date: "2026-12-05" }],
      solicitacoesAbertas: [{ titulo: "Banner" }],
      revisaoPendente: true,
    });
    expect(pontos.join(" ")).toMatch(/Reforçar .*40%/);
    expect(pontos.join(" ")).toMatch(/prazo 05\/12\/2026/);
    expect(pontos.join(" ")).toMatch(/Banner/);
  });
});
