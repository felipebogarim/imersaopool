import { describe, expect, it } from "vitest";
import {
  formatExecutiveReportForWhatsapp,
  formatWhatsappPhone,
  buildWhatsappWebUrl,
  buildWhatsappDesktopUrl,
  buildWhatsappApiUrl,
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

    // Briefing (direto, sem emojis, sem consultor, atingimento ou marcas)
    expect(text).toContain("• *Data:* 15/09/2026");
    expect(text).toContain("• *Local:* Campinas - SP");
    expect(text).toContain("• *Representante:* João Silva");
    expect(text).toContain("• *Categoria comercial:* Ouro");
    expect(text).not.toContain("*Consultor:*");
    expect(text).not.toContain("*Atingimento geral:*");
    expect(text).not.toContain("*Marcas observadas:*");

    // Garante ausência de emojis
    expect(text).not.toMatch(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);

    // Leitura / Resumo
    expect(text).toContain("Resumo executivo da visita técnica.");
    expect(text).toContain("*Expansão de Linha*");
    expect(text).toContain("Forte demanda por fita 24V");

    // Evidências e Recomendações (o relatório se encerra neste capítulo)
    expect(text).toContain("*EVIDÊNCIAS & RECOMENDAÇÕES*");
    expect(text).toContain("Posicionamento no showroom");
    expect(text).toContain("Nossa bancada está precisando de fitas novas.");
    expect(text).toContain("(Marcos · Gerente)");

    // Capítulos posteriores removidos do WhatsApp
    expect(text).not.toContain("*O QUE NÃO PRIORIZAR*");
    expect(text).not.toContain("Linha de refletores antigos");
    expect(text).not.toContain("*PLANO DE AÇÃO EXECUTIVO");
    expect(text).not.toContain("Enviar mostruário de fitas 24V");

    // Link do gráfico ao final
    expect(text).toContain("https://poolflux.app/grafico/imm-999");
  });

  it("formata telefone brasileiro corretamente", () => {
    expect(formatWhatsappPhone("(11) 98765-4321")).toBe("5511987654321");
    expect(formatWhatsappPhone("11987654321")).toBe("5511987654321");
    expect(formatWhatsappPhone("+55 (11) 98765-4321")).toBe("5511987654321");
    expect(formatWhatsappPhone("")).toBe("");
  });

  it("gera URLs de WhatsApp Web, Desktop (Mac) e universal", () => {
    const webUrl = buildWhatsappWebUrl("Teste de mensagem", "11999998888");
    expect(webUrl).toBe(
      "https://web.whatsapp.com/send?phone=5511999998888&text=Teste%20de%20mensagem"
    );

    const webUrlNoPhone = buildWhatsappWebUrl("Olá mundo");
    expect(webUrlNoPhone).toBe("https://web.whatsapp.com/send?text=Ol%C3%A1%20mundo");

    const desktopUrl = buildWhatsappDesktopUrl("Relatório Mac", "11999998888");
    expect(desktopUrl).toBe(
      "whatsapp://send?phone=5511999998888&text=Relat%C3%B3rio%20Mac"
    );

    const desktopUrlNoPhone = buildWhatsappDesktopUrl("Relatório Mac");
    expect(desktopUrlNoPhone).toBe("whatsapp://send?text=Relat%C3%B3rio%20Mac");

    const apiUrl = buildWhatsappApiUrl("Teste", "11999998888");
    expect(apiUrl).toBe("https://api.whatsapp.com/send?phone=5511999998888&text=Teste");

    const uniUrl = buildWhatsappUniversalUrl("Teste", "11999998888");
    expect(uniUrl).toBe("https://wa.me/5511999998888?text=Teste");
  });

  it("formata relatório estilo Clara sem consultor, atingimento, marcas e encerra em evidências", () => {
    const claraReport: ExecutiveReportData = {
      ...mockReport,
      companyName: "Newline",
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
      brands_observed: ["Newline", "Studio", "Stella", "Brilia", "Interlight", "Cia da Luz", "Alpertone"],
      do_not_prioritize: [
        {
          title: "Projetos de iluminação residencial simples",
          cause: "Foco exclusivo em alto padrão",
          decision: "Não alocar recursos",
        },
      ],
      actions: [
        {
          id: "ACT01",
          area: "commercial",
          priority: "high",
          title: "Reunião de alinhamento",
          status: "validated",
          history: [],
          ordem: 1,
        },
      ],
    };

    const text = formatExecutiveReportForWhatsapp(claraReport, {
      immersionReportId: "0ab3e2a1-f172-43a5-a633-9c347c09f06f",
    });

    expect(text).toContain("*NEWLINE* · CLARA ILUMINACAO LTDA");
    expect(text).toContain("• *Nome fantasia:* Arquiluz");
    expect(text).toContain("• *Data:* 06/10/2026");
    expect(text).toContain("• *Local:* Salvador, BA");
    expect(text).toContain("• *Representante:* Anselmo");
    expect(text).toContain("• *Categoria comercial:* Black");

    // Campos excluídos
    expect(text).not.toContain("Consultor:");
    expect(text).not.toContain("Felipe");
    expect(text).not.toContain("Atingimento geral:");
    expect(text).not.toContain("82,1%");
    expect(text).not.toContain("Marcas observadas:");
    expect(text).not.toContain("Studio · Stella");

    // Encerramento em EVIDÊNCIAS & RECOMENDAÇÕES (sem O QUE NÃO PRIORIZAR nem plano de ação)
    expect(text).toContain("*EVIDÊNCIAS & RECOMENDAÇÕES*");
    expect(text).not.toContain("*O QUE NÃO PRIORIZAR*");
    expect(text).not.toContain("Projetos de iluminação residencial simples");
    expect(text).not.toContain("*PLANO DE AÇÃO EXECUTIVO");
    expect(text).not.toContain("Reunião de alinhamento");

    // Link do gráfico
    expect(text).toContain(
      "https://poolflux.app/grafico/0ab3e2a1-f172-43a5-a633-9c347c09f06f"
    );
  });
});
