import { describe, expect, it } from "vitest";
import { buildInitialDrafts, buildSavePayload, setMetaOficial } from "./performance-metas";
import {
  baseFromBackend,
  cycleInfo,
  gestorRpcArgs,
  hydrateDrafts,
  repView,
  type GoalsState,
} from "./performance-metas-persistence";

// Valores sintéticos: nenhum dado financeiro real de cliente.
const state: GoalsState = {
  cycle: { id: "c1", inicio: "2026-11-01", fim: "2027-04-01", client_id: "x" },
  items: [
    { familia: "PERFIL", meta_mensal: 1200, origem: "gestor", comentario_gestor: "obra" },
    { familia: "PRO LED", meta_mensal: 500, origem: "ia", comentario_gestor: "" },
  ],
  rep_suggestions: [{ familia: "PERFIL", valor: 900, justificativa: "queda" }],
  ai_suggestions: [
    { familia: "PERFIL", valor: 1100, justificativa: "j", tag: "imersao", origem: "simulacao" },
  ],
  base: {
    realizado: { PERFIL: 600 },
    media: { "PRO LAMP": 300 },
    familia_pct: { "PRO LED": 0.5, PERFIL: 0.6 },
    metas: { "PRO LED": 800, PERFIL: 1000 },
  },
};

describe("performance-metas-persistence", () => {
  it("base financeira: realizado → média → atingimento × meta do upload (estimado)", () => {
    const b = baseFromBackend(state.base);
    expect(b.PERFIL).toEqual({ valor: 600, estimado: false });
    expect(b["PRO LAMP"]).toEqual({ valor: 300, estimado: false });
    expect(b["PRO LED"]).toEqual({ valor: 400, estimado: true });
    expect(b["DECOR NEWLINE"]).toBeUndefined();
    expect(baseFromBackend(undefined)).toEqual({});
  });

  it("hidrata os rascunhos com o que está gravado", () => {
    const d = hydrateDrafts(buildInitialDrafts("Gold"), state);
    const perfil = d.find((x) => x.familia === "PERFIL");
    expect(perfil).toMatchObject({
      metaOficial: 1200,
      origem: "gestor",
      comentarioGestor: "obra",
      sugestaoRep: 900,
      justificativaRep: "queda",
    });
    expect(perfil?.sugestaoIa).toEqual({
      valor: 1100,
      justificativa: "j",
      tag: "imersao",
      simulada: true,
    });
    const decor = d.find((x) => x.familia === "DECOR NEWLINE");
    expect(decor?.origem).toBe("padrao");
    expect(decor?.metaOficial).toBe(decor?.referencia);
  });

  it("visão do representante: atingimento pronto, sem base financeira nem IA", () => {
    const v = repView(state);
    expect(v.atingimento.PERFIL).toEqual({ ratio: 0.5, estimado: false });
    expect(v.atingimento["PRO LED"]).toEqual({ ratio: 0.8, estimado: true });
    const json = JSON.stringify(v);
    expect(json).not.toMatch(/comentario_gestor|ai_suggestions|realizado|familia_pct|client_id/);
    expect(json).not.toMatch(/"origem"/);
  });

  it("argumentos da RPC do gestor", () => {
    const d = setMetaOficial(hydrateDrafts(buildInitialDrafts("Gold"), state), "PERFIL", 1300);
    const p = buildSavePayload(d, "gestor", ["PERFIL"]);
    if (p.perfil !== "gestor") throw new Error("perfil");
    const args = gestorRpcArgs(p);
    expect(args.metas).toEqual([
      expect.objectContaining({ familia: "PERFIL", meta_mensal: 1300, origem: "gestor" }),
    ]);
    expect(args.sugestoes_ia[0]).toMatchObject({ origem: "simulacao", tag: "imersao" });
  });

  it("ciclo: rótulo, duração e vencimento", () => {
    const c = { id: "c", inicio: "2026-11-01", fim: "2027-04-01" };
    expect(cycleInfo(c, new Date(2026, 11, 10))).toEqual({
      label: "nov/26 – abr/27",
      meses: 6,
      vencido: false,
      podeEstender: true,
    });
    expect(cycleInfo(c, new Date(2027, 4, 2)).vencido).toBe(true);
    expect(cycleInfo({ ...c, fim: "2027-10-01" }).podeEstender).toBe(false);
  });
});
