import { describe, expect, it } from "vitest";
import {
  formatExecutiveReportForWhatsapp,
  formatWhatsappPhone,
  buildWhatsappWebUrl,
  buildWhatsappUniversalUrl,
} from "./whatsapp";
import type { ExecutiveReportData } from "./types";

const mockReport: ExecutiveReportData = {
  id: "rep-123",
  status: "review",
  report_title: "Relatório Executivo",
  companyName: "Newline",
  client: {
    display_name: "Ilumilux Piscinas",
    visit_date: "2026-09-15",
    location: "Campinas - SP",
    representative: "João Silva",
    consultant: "Carlos Mendes",
    category: "Ouro",
    attainment: "95,5%",
  },
  executive_reading: "Parágrafo executivo geral.",
  brands_observed: ["Sodramar", "Sibrape"],
  layout_version: "compact_v2",
  executive_summary: "Resumo executivo da visita técnica.",
  executive_topics: [
    {
      title: "Expansão de Linha",
      bullets: ["Forte demanda por fita 24V", "Interesse em automação"],
    },
  ],
  evidence_recommendations: [
    {
      id: "ER01",
      title: "Posicionamento no showroom",
      perception: "Showroom precisa de renovação visual.",
      evidence: {
        quote: "Nossa bancada está precisando de fitas novas.",
        author: "Marcos",
        role: "Gerente",
      },
      opportunity: "Instalação do novo display modular.",
    },
  ],
  decision_blocks: [],
  do_not_prioritize: [
    {
      title: "Linha de refletores antigos",
      cause: "Baixa saída na praça",
      decision: "Focar 100% na nova linha",
    },
  ],
  actions: [
    {
      id: "ACT01",
      area: "commercial",
      priority: "high",
      title: "Enviar mostruário de fitas 24V",
      description: "Montar kit demonstrativo para o gerente da loja.",
      status: "validated",
      owner: "João Silva",
      due_date: "2026-10-30",
      history: [],
      ordem: 1,
    },
    {
      id: "ACT02",
      area: "marketing",
      priority: "medium",
      title: "Ação rejeitada",
      status: "rejected",
      history: [],
      ordem: 2,
    },
  ],
  email: {},
  current_version: 1,
};

describe("formatExecutiveReportForWhatsapp", () => {
  it("formata cabeçalho, briefing, leitura, evidências, ações e link", () => {
    const text = formatExecutiveReportForWhatsapp(mockReport, {
      appUrl: "https://poolflux.app",
      immersionReportId: "imm-999",
      introMessage: "Prezados, segue o relatório da imersão.",
    });

    // Cabeçalho e introdução
    expect(text).toContain("*RELATÓRIO EXECUTIVO DE IMERSÃO*");
    expect(text).toContain("*NEWLINE* · Ilumilux Piscinas");
    expect(text).toContain("Prezados, segue o relatório da imersão.");

    // Briefing
    expect(text).toContain("*BRIEFING EXECUTIVO*");
    expect(text).toContain("Campinas - SP");
    expect(text).toContain("João Silva");
    expect(text).toContain("Sodramar · Sibrape");

    // Leitura / Resumo
    expect(text).toContain("Resumo executivo da visita técnica.");
    expect(text).toContain("*Expansão de Linha*");
    expect(text).toContain("Forte demanda por fita 24V");

    // Evidências e Recomendações
    expect(text).toContain("*EVIDÊNCIAS & RECOMENDAÇÕES*");
    expect(text).toContain("Posicionamento no showroom");
    expect(text).toContain("Nossa bancada está precisando de fitas novas.");
    expect(text).toContain("(Marcos · Gerente)");

    // O que não priorizar
    expect(text).toContain("*O QUE NÃO PRIORIZAR*");
    expect(text).toContain("Linha de refletores antigos");

    // Ações (ignora rejeitadas)
    expect(text).toContain("*PLANO DE AÇÃO EXECUTIVO (1 ações)*");
    expect(text).toContain("Enviar mostruário de fitas 24V");
    expect(text).toContain("Comercial");
    expect(text).toContain("Alta");
    expect(text).not.toContain("Ação rejeitada");

    // Link
    expect(text).toContain("https://poolflux.app/visao-imersao-2/imm-999/executivo");
  });

  it("formata telefone brasileiro corretamente", () => {
    expect(formatWhatsappPhone("(11) 98765-4321")).toBe("5511987654321");
    expect(formatWhatsappPhone("11987654321")).toBe("5511987654321");
    expect(formatWhatsappPhone("+55 (11) 98765-4321")).toBe("5511987654321");
    expect(formatWhatsappPhone("")).toBe("");
  });

  it("gera URLs de WhatsApp Web e universal", () => {
    const webUrl = buildWhatsappWebUrl("Teste de mensagem", "11999998888");
    expect(webUrl).toBe(
      "https://web.whatsapp.com/send?phone=5511999998888&text=Teste%20de%20mensagem"
    );

    const webUrlNoPhone = buildWhatsappWebUrl("Olá mundo");
    expect(webUrlNoPhone).toBe("https://web.whatsapp.com/send?text=Ol%C3%A1%20mundo");

    const uniUrl = buildWhatsappUniversalUrl("Teste", "11999998888");
    expect(uniUrl).toBe("https://wa.me/5511999998888?text=Teste");
  });
});
