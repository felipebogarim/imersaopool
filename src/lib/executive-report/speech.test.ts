import { describe, expect, it } from "vitest";
import { buildSpeechScript } from "./speech";
import type { ExecutiveReportData } from "./types";

const report: ExecutiveReportData = {
  status: "closed",
  report_title: "Relatório Executivo",
  client: { display_name: "Cliente Teste" },
  executive_reading: "Leitura executiva do relatório.",
  brands_observed: [],
  decision_blocks: [],
  do_not_prioritize: [
    {
      title: "Tema secundário",
      decision: "Esta é a última frase presente no relatório.",
    },
  ],
  actions: [],
  email: {},
  current_version: 1,
};

describe("buildSpeechScript", () => {
  it("encerra na última evidência e recomendação sem ler do_not_prioritize nem ações", () => {
    const reportWithEvidence: ExecutiveReportData = {
      ...report,
      layout_version: "compact_v2",
      client: {
        display_name: "CLARA ILUMINACAO LTDA",
        trade_name: "Arquiluz",
        visit_date: "2026-10-06",
        location: "Salvador, BA",
        representative: "Anselmo",
        consultant: "Felipe",
        category: "Black",
        attainment: "82,1% · 1º Semestre 2026",
      },
      brands_observed: ["Newline", "Studio", "Stella"],
      evidence_recommendations: [
        {
          id: "ER01",
          order: 1,
          title: "Parceria comercial",
          perception: "Boa abertura da equipe.",
          evidence: {
            quote: "Gostamos muito do atendimento da Newline.",
            author: "Clarissa",
            role: "Gerente",
          },
          opportunity: "Aprofundar linha de fitas e fontes.",
        },
      ],
      do_not_prioritize: [
        {
          title: "Tema secundário",
          decision: "Esta frase NÃO deve estar no áudio.",
        },
      ],
      actions: [
        {
          id: "act-1",
          source_decision_id: null,
          area: "commercial",
          priority: "high",
          title: "Ação que NÃO deve estar no áudio",
          description: null,
          status: "suggested",
          owner: null,
          due_date: null,
          note: null,
          source_opportunity_ids: [],
          reject_reason: null,
          history: [],
          ordem: 0,
        },
      ],
    };

    const script = buildSpeechScript(reportWithEvidence).join("\n");

    // Cabeçalho e briefing enxugado
    expect(script).toContain("Relatório Executivo de Imersão.");
    expect(script).toContain("CLARA ILUMINACAO LTDA");
    expect(script).toContain("Nome fantasia: Arquiluz.");
    expect(script).toContain("Data: 06/10/2026.");
    expect(script).toContain("Local: Salvador, BA.");
    expect(script).toContain("Representante: Anselmo.");
    expect(script).toContain("Categoria comercial: Black.");

    // Campos removidos (consultor, atingimento, marcas)
    expect(script).not.toContain("Consultor");
    expect(script).not.toContain("Felipe");
    expect(script).not.toContain("Atingimento");
    expect(script).not.toContain("82,1%");
    expect(script).not.toContain("Marcas observadas");
    expect(script).not.toContain("Studio, Stella");

    // Evidências e recomendações
    expect(script).toContain("Evidências e recomendações.");
    expect(script).toContain("1. Parceria comercial.");
    expect(script).toContain("Percepção. Boa abertura da equipe.");
    expect(script).toContain('Evidência de Clarissa, Gerente. "Gostamos muito do atendimento da Newline."');
    expect(script).toContain("Oportunidade. Aprofundar linha de fitas e fontes.");

    // Seções posteriores removidas (não priorizar e plano de ação)
    expect(script).not.toContain("Onde não concentrar energia agora");
    expect(script).not.toContain("Esta frase NÃO deve estar no áudio");
    expect(script).not.toContain("Ações sugeridas");
    expect(script).not.toContain("Ação que NÃO deve estar no áudio");
    expect(script).not.toContain("Fim do relatório");

    // Encerramento com a frase padrão solicitada
    expect(script).toContain(
      "Este foi um resumo da imersão em campo. Acesse o relatório completo e áudio na plataforma na Imersão Comercial Newline."
    );
    expect(
      script
        .trim()
        .endsWith(
          "Este foi um resumo da imersão em campo. Acesse o relatório completo e áudio na plataforma na Imersão Comercial Newline."
        )
    ).toBe(true);
  });
});
