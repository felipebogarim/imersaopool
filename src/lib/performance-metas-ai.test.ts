import { describe, expect, it } from "vitest";
import {
  aiBaseFromContext,
  buildAiPrompt,
  parseAiSuggestions,
  referenciasDaCategoria,
  type AiContext,
} from "./performance-metas-ai";

// Valores sintéticos: nenhum dado financeiro real de cliente.
const semImersao: AiContext = {
  cliente: {
    razao_social: "Cliente Teste",
    categoria: "Gold",
    periodo: "Out/26",
    realizado: { PERFIL: 800 },
    media: {},
    metas_upload: { PERFIL: 1000 },
  },
  perfil: { categoria: "Gold", cidade: "Curitiba", estado: "PR", regiao: "Sul", grupo: null },
  historico: [{ periodo: "Set/26" }, { periodo: "Out/26" }],
  imersao: { entrevistas: [], imersoes: [], relatorios: [] },
  comparaveis: { clientes: 5, regiao: "Sul", categoria: "Gold", realizado_medio: { PERFIL: 600 } },
};
const comImersao: AiContext = {
  ...semImersao,
  imersao: {
    entrevistas: [{ data: "2026-10-12" }],
    imersoes: [],
    relatorios: [{ data: "2026-10-15" }],
  },
};
const refs = referenciasDaCategoria("Gold");

describe("performance-metas-ai", () => {
  it("base: imersão tem prioridade; sem imersão a base é tendência", () => {
    const a = aiBaseFromContext(comImersao);
    expect(a.tag).toBe("imersao");
    expect(a.base.fontes).toEqual(["imersao", "historico", "upload", "perfil", "comparaveis"]);
    expect(a.base.imersao).toEqual({ entrevistas: 1, relatorios: 1, ultima: "2026-10-15" });
    const b = aiBaseFromContext(semImersao);
    expect(b.tag).toBe("tendencia");
    expect(b.base.imersao).toBeUndefined();
    expect(b.base.comparaveis).toEqual({ clientes: 5, regiao: "Sul", categoria: "Gold" });
  });

  it("comparáveis insuficientes não entram na base", () => {
    const ctx = {
      ...semImersao,
      comparaveis: { clientes: 2, regiao: "Sul", categoria: "Gold", insuficiente: true },
    };
    expect(aiBaseFromContext(ctx).base.fontes).not.toContain("comparaveis");
  });

  it("prompt traz a prioridade da evidência e o contexto", () => {
    const { system, user } = buildAiPrompt(comImersao, refs);
    expect(system).toMatch(/PRIORIDADE DA EVIDÊNCIA/);
    expect(JSON.parse(user)).toMatchObject({ base_principal: "imersão" });
  });

  it("valida a resposta: portfólio conhecido, múltiplo de 50, teto de sanidade, justificativa", () => {
    const raw =
      "```json\n" +
      JSON.stringify({
        sugestoes: [
          { familia: "perfil", valor: 1234, justificativa: "Entrevista indica obra." },
          { familia: "PRO LED", valor: 99999999, justificativa: "exagero" },
          { familia: "INEXISTENTE", valor: 10, justificativa: "x" },
          { familia: "PRO LAMP", valor: -5, justificativa: "negativo" },
          { familia: "FITAS E FONTES", valor: 500, justificativa: "" },
        ],
      }) +
      "\n```";
    const out = parseAiSuggestions(raw, comImersao, refs);
    const perfil = out.find((s) => s.familia === "PERFIL");
    expect(perfil).toMatchObject({ valor: 1250, tag: "imersao" });
    expect(perfil?.base.fontes).toContain("imersao");
    const proLed = out.find((s) => s.familia === "PRO LED");
    expect(proLed?.valor).toBeLessThanOrEqual(3 * (refs["PRO LED"] ?? 0));
    expect(out.map((s) => s.familia)).not.toContain("PRO LAMP");
    expect(out.map((s) => s.familia)).not.toContain("FITAS E FONTES");
  });

  it("resposta inválida → nenhuma sugestão", () => {
    expect(parseAiSuggestions("não sei", semImersao, refs)).toEqual([]);
  });
});
