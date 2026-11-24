import { describe, expect, it } from "vitest";
import {
  AI_TOOL,
  aiBaseFromContext,
  buildAiPrompt,
  extractAnalysis,
  referenciasDaCategoria,
  validateAnalysis,
  type AiContext,
} from "./performance-metas-ai";

// Valores sintéticos: nenhum dado financeiro real de cliente.
const semImersao: AiContext = {
  cliente: {
    razao_social: "Cliente Teste",
    categoria: "Gold",
    periodo: "Out/26",
    realizado_rs: { PERFIL: 800 },
    media_historica_rs: { "PRO LED": 300 },
    meta_upload_rs: { PERFIL: 1000 },
  },
  perfil: { categoria: "Gold", cidade: "Curitiba", estado: "PR", regiao: "Sul", grupo: null },
  historico: [{ periodo: "Set/26" }, { periodo: "Out/26" }],
  imersao: { entrevistas: [], visitas: [], representante: [], imersoes: [], relatorios: [] },
  comparaveis: {
    clientes: 5,
    escopo: "regiao",
    regiao: "Sul",
    categoria: "Gold",
    realizado_medio_rs: { "DECOR STUDIO": 600 },
  },
};
const comImersao: AiContext = {
  ...semImersao,
  imersao: {
    entrevistas: [{ data: "2026-10-12" }],
    visitas: [{ data: "2026-10-12", oportunidades: "Obra de 40 apartamentos" }],
    representante: [],
    imersoes: [],
    relatorios: [{ data: "2026-10-15" }],
  },
};
const refs = referenciasDaCategoria("Gold");
const semRefs = referenciasDaCategoria(null);

const item = (familia: string, valor: number, origem = "tendencia", confianca = "media") => ({
  familia,
  valor_mensal: valor,
  origem,
  confianca,
  justificativa: `Evidência concreta para ${familia}.`,
});

describe("performance-metas-ai", () => {
  it("base: fontes presentes no contexto, com contagem da imersão", () => {
    const b = aiBaseFromContext(comImersao);
    expect(b.fontes).toEqual(["imersao", "historico", "upload", "comparaveis", "perfil"]);
    expect(b.imersao).toEqual({
      entrevistas: 1,
      formularios: 1,
      relatorios: 1,
      ultima: "2026-10-15",
    });
    expect(aiBaseFromContext(semImersao).imersao).toBeUndefined();
  });

  it("prompt: prioridade da imersão, só R$ e ferramenta estruturada com as 7 famílias", () => {
    const { system, user } = buildAiPrompt(comImersao, refs);
    expect(system).toMatch(/Imersões do cliente/);
    expect(system).toMatch(/Não há pontos de farol/);
    const u = JSON.parse(user);
    expect(u.performance_rs_por_familia.PERFIL).toMatchObject({
      realizado_rs: 800,
      meta_upload_rs: 1000,
    });
    expect(user).not.toMatch(/familia_pct|farol/);
    expect(
      AI_TOOL.function.parameters.properties.familias.items.properties.familia.enum,
    ).toHaveLength(7);
  });

  it("lê a saída da ferramenta (ou JSON no conteúdo como reserva)", () => {
    const args = JSON.stringify({ resumo: "r", familias: [] });
    expect(extractAnalysis({ tool_calls: [{ function: { arguments: args } }] })).toEqual({
      resumo: "r",
      familias: [],
    });
    expect(extractAnalysis({ content: "```json\n" + args + "\n```" })).toEqual({
      resumo: "r",
      familias: [],
    });
    expect(extractAnalysis({ content: "sem json" })).toBeNull();
  });

  it("valida: 7 famílias, participação soma 1, origem coerente com os dados", () => {
    const { resumo, sugestoes } = validateAnalysis(
      {
        resumo: "Cliente em expansão.",
        familias: [
          item("PERFIL", 1234, "imersao", "alta"),
          item("PRO LED", 99999999, "tendencia"),
          item("DECOR NEWLINE", 500, "tendencia", "alta"),
        ],
      },
      comImersao,
      refs,
    );
    expect(resumo).toBe("Cliente em expansão.");
    expect(sugestoes).toHaveLength(7);
    const by = Object.fromEntries(sugestoes.map((s) => [s.familia, s]));
    expect(by.PERFIL).toMatchObject({ valor: 1250, tag: "imersao", confianca: "alta" });
    expect(by.PERFIL.base.resumo).toBe("Cliente em expansão.");
    // teto de sanidade: 3× a maior referência em R$
    expect(by["PRO LED"].valor).toBeLessThanOrEqual(3 * Math.max(300, refs["PRO LED"] ?? 0));
    // "tendência" sem dado financeiro nem comparável da família → dados limitados
    expect(by["DECOR NEWLINE"]).toMatchObject({ tag: "limitado", confianca: "baixa" });
    expect(by["DECOR NEWLINE"].valor).toBeLessThanOrEqual(1.1 * (refs["DECOR NEWLINE"] ?? 0));
    // família ausente → recomendação conservadora marcada como dados limitados
    expect(by["FITAS E FONTES"]).toMatchObject({
      tag: "limitado",
      confianca: "baixa",
      valor: Math.round((refs["FITAS E FONTES"] ?? 0) / 50) * 50,
    });
    const soma = sugestoes.reduce((s, x) => s + x.participacao, 0);
    expect(soma).toBeCloseTo(1, 3);
  });

  it("'imersao' sem registro de imersão vira tendência", () => {
    const { sugestoes } = validateAnalysis(
      { resumo: "", familias: [item("PERFIL", 900, "imersao", "alta")] },
      semImersao,
      refs,
    );
    expect(sugestoes.find((s) => s.familia === "PERFIL")?.tag).toBe("tendencia");
  });

  it("pode reduzir a meta (não compensa diferenças)", () => {
    const { sugestoes } = validateAnalysis(
      { resumo: "", familias: [item("PERFIL", 400, "tendencia")] },
      semImersao,
      refs,
    );
    expect(sugestoes.find((s) => s.familia === "PERFIL")?.valor).toBe(400);
  });

  it("sem nenhuma referência (categoria desconhecida e sem dados) não sugere", () => {
    const vazio: AiContext = { cliente: { razao_social: "X", categoria: null, periodo: null } };
    expect(validateAnalysis({ familias: [] }, vazio, semRefs).sugestoes).toEqual([]);
  });

  describe("hasNewInputsForAi", () => {
    it("sem sugestão anterior (primeira geração), indica que há novos inputs", async () => {
      const { hasNewInputsForAi } = await import("./performance-metas-ai");
      const res = hasNewInputsForAi(semImersao, [], null);
      expect(res.hasNewInputs).toBe(true);
    });

    it("com inputs anteriores à data da análise, indica ausência de novos inputs", async () => {
      const { hasNewInputsForAi } = await import("./performance-metas-ai");
      const contextComDataAntiga: AiContext = {
        ...semImersao,
        imersao: {
          entrevistas: [{ data: "2026-10-10" }],
          visitas: [{ data: "2026-10-10" }],
        },
      };
      // Sugestão gerada em 2026-10-15 (posterior aos dados)
      const res = hasNewInputsForAi(contextComDataAntiga, [], "2026-10-15T12:00:00Z");
      expect(res.hasNewInputs).toBe(false);
      expect(res.detalhes).toEqual([]);
    });

    it("com nova visita ou entrevista posterior à análise, identifica novos inputs", async () => {
      const { hasNewInputsForAi } = await import("./performance-metas-ai");
      const contextComNovaVisita: AiContext = {
        ...semImersao,
        imersao: {
          entrevistas: [{ data: "2026-10-10" }],
          visitas: [{ data: "2026-10-20" }], // posterior
        },
      };
      const res = hasNewInputsForAi(contextComNovaVisita, [], "2026-10-15T12:00:00Z");
      expect(res.hasNewInputs).toBe(true);
      expect(res.detalhes).toContain("Novo formulário de visita de campo");
    });

    it("com nova sugestão de representante posterior, identifica novos inputs", async () => {
      const { hasNewInputsForAi } = await import("./performance-metas-ai");
      const repSugs = [
        { valor: 3000, updated_at: "2026-10-25T14:00:00Z" }, // posterior a 15/10
      ];
      const res = hasNewInputsForAi(semImersao, repSugs, "2026-10-15T12:00:00Z");
      expect(res.hasNewInputs).toBe(true);
      expect(res.detalhes).toContain("Nova sugestão enviada pelo representante");
    });
  });
});
