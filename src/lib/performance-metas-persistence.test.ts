import { describe, expect, it } from "vitest";
import { buildInitialDrafts, buildSavePayload, setMetaOficial } from "./performance-metas";
import {
  baseFromBackend,
  competenciasDoCiclo,
  cycleInfo,
  groupRepSuggestionHistory,
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
  rep_suggestions: [
    {
      familia: "PERFIL",
      valor: 900,
      justificativa: "queda",
      updated_at: "2026-11-24T09:30:00Z",
    },
  ],
  ai_suggestions: [
    {
      familia: "PERFIL",
      valor: 1100,
      justificativa: "j",
      tag: "imersao",
      origem: "modelo",
      confianca: "alta",
      participacao: "0.4000",
      created_at: "2026-11-24T10:00:00Z",
      base: {
        resumo: "Cliente em expansão.",
        fontes: ["imersao", "historico"],
        imersao: { entrevistas: 2, relatorios: 1, ultima: "2026-10-12" },
        historico: { periodos: 4 },
      },
    },
    // registro antigo da fase de protótipo: não aparece
    { familia: "PRO LED", valor: 10, justificativa: "x", tag: "imersao", origem: "simulacao" },
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
    expect(b.PERFIL).toEqual({ valor: 600, fonte: "realizado" });
    expect(b["PRO LAMP"]).toEqual({ valor: 300, fonte: "media" });
    expect(b["PRO LED"]).toEqual({ valor: 400, fonte: "estimado" });
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
      sugestaoRepEnviadaEm: "2026-11-24T09:30:00Z",
    });
    expect(perfil?.sugestaoIa).toMatchObject({
      valor: 1100,
      justificativa: "j",
      tag: "imersao",
      fundamento:
        "Imersão 12/10/26: 2 entrevista(s), 1 relatório(s) de campo · 4 período(s) de histórico",
    });
    expect(perfil?.sugestaoIa).toMatchObject({
      confianca: "alta",
      participacao: 0.4,
      resumo: "Cliente em expansão.",
      geradaEm: "2026-11-24T10:00:00Z",
    });
    expect(d.find((x) => x.familia === "PRO LED")?.sugestaoIa).toBeNull();
    const decor = d.find((x) => x.familia === "DECOR NEWLINE");
    expect(decor?.origem).toBe("padrao");
    expect(decor?.metaOficial).toBe(decor?.referencia);
  });

  it("visão do representante: atingimento pronto, sem base financeira nem IA", () => {
    const v = repView(state);
    expect(v.atingimento.PERFIL).toEqual({ ratio: 0.5, fonte: "realizado" });
    expect(v.atingimento["PRO LED"]).toEqual({ ratio: 0.8, fonte: "estimado" });
    const json = JSON.stringify(v);
    expect(json).not.toMatch(
      /comentario_gestor|ai_suggestions|agendadas|"base"|familia_pct|client_id/,
    );
    expect(json).not.toMatch(/"origem"/);
  });

  it("visão do representante: sem metas gravadas pela gestão, usa meta padrão da categoria", () => {
    const emptyState: GoalsState = {
      cycle: null,
      items: [],
      rep_suggestions: [],
      ai_suggestions: [],
      base: {
        realizado: { "DECOR NEWLINE": 1250 },
        familia_pct: { "DECOR STUDIO": 0.85 },
      },
    };
    const v = repView(emptyState, "Silver");
    expect(v.items).toHaveLength(7);
    expect(v.items.find((i) => i.familia === "DECOR NEWLINE")?.meta_mensal).toBe(1000);
    expect(v.items.find((i) => i.familia === "DECOR STUDIO")?.meta_mensal).toBe(1500);
    expect(v.atingimento["DECOR NEWLINE"]).toEqual({ ratio: 1.25, fonte: "realizado" });
    expect(v.atingimento["DECOR STUDIO"]).toEqual({ ratio: 0.85, fonte: "estimado" });
  });

  it("agrupa o histórico de sugestões por envio e remove campos internos", () => {
    const history = groupRepSuggestionHistory([
      {
        changed_at: "2026-11-24T10:00:00Z",
        familia: "PERFIL",
        dados_novos: { valor: "1200.00", justificativa: "Novo projeto", company_id: "privado" },
      },
      {
        changed_at: "2026-11-24T10:00:00Z",
        familia: "PRO LED",
        dados_novos: { valor: 800, justificativa: "Reposição" },
      },
      {
        changed_at: "2026-11-20T09:00:00Z",
        familia: "INVALIDA",
        dados_novos: { valor: 1 },
      },
    ]);
    expect(history).toEqual([
      {
        sent_at: "2026-11-24T10:00:00Z",
        items: [
          { familia: "PERFIL", valor: 1200, justificativa: "Novo projeto" },
          { familia: "PRO LED", valor: 800, justificativa: "Reposição" },
        ],
      },
    ]);
    expect(JSON.stringify(history)).not.toContain("company_id");
  });

  it("argumentos da RPC do gestor", () => {
    const d = setMetaOficial(hydrateDrafts(buildInitialDrafts("Gold"), state), "PERFIL", 1300);
    const p = buildSavePayload(d, "gestor", ["PERFIL"]);
    if (p.perfil !== "gestor") throw new Error("perfil");
    const args = gestorRpcArgs(p);
    expect(args.metas).toEqual([
      expect.objectContaining({ familia: "PERFIL", meta_mensal: 1300, origem: "gestor" }),
    ]);
    expect(args).not.toHaveProperty("sugestoes_ia");
  });

  it("competências: meses do ciclo, padrão no mês corrente", () => {
    const c = { id: "c", inicio: "2026-11-01", fim: "2027-04-01" };
    const r = competenciasDoCiclo(c, null, new Date(2027, 0, 15));
    expect(r.meses).toHaveLength(6);
    expect(r.meses[0]).toBe("2026-11-01");
    expect(r.padrao).toBe("2027-01-01");
    expect(competenciasDoCiclo(c, null, new Date(2026, 5, 1)).padrao).toBe("2026-11-01");
    expect(competenciasDoCiclo(c, null, new Date(2028, 0, 1)).padrao).toBe("2027-04-01");
    // renovado: o próximo ciclo continua a sequência, sem interrupção
    const prox = { id: "p", inicio: "2027-05-01", fim: "2027-10-01" };
    const r2 = competenciasDoCiclo(c, prox, new Date(2027, 0, 15));
    expect(r2.meses).toHaveLength(12);
    expect(r2.meses[6]).toBe("2027-05-01");
    expect(r2.padrao).toBe("2027-01-01");
    // sem ciclo: o semestre corrente (jul–dez), padrão no mês corrente
    const novo = competenciasDoCiclo(null, null, new Date(2026, 10, 23));
    expect(novo.meses).toEqual([
      "2026-07-01",
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
      "2026-12-01",
    ]);
    expect(novo.padrao).toBe("2026-11-01");
    expect(competenciasDoCiclo(null, null, new Date(2027, 1, 3)).meses[0]).toBe("2027-01-01");
  });

  it("ciclo semestral: rótulo, próximo semestre e vencimento", () => {
    const c = { id: "c", inicio: "2026-07-01", fim: "2026-12-01" };
    expect(cycleInfo(c, new Date(2026, 10, 10))).toEqual({
      label: "2º semestre 2026 (jul/26 – dez/26)",
      meses: 6,
      vencido: false,
      proximoLabel: "1º semestre 2027",
    });
    expect(cycleInfo(c, new Date(2027, 0, 2)).vencido).toBe(true);
    const s1 = cycleInfo({ id: "s", inicio: "2027-01-01", fim: "2027-06-01" });
    expect(s1.label).toBe("1º semestre 2027 (jan/27 – jun/27)");
    expect(s1.proximoLabel).toBe("2º semestre 2027");
    // ciclo legado fora do calendário: só o intervalo
    expect(cycleInfo({ id: "x", inicio: "2026-11-01", fim: "2027-04-01" }).label).toBe(
      "nov/26 – abr/27",
    );
  });
});
