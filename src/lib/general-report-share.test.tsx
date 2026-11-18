import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { formatGeneralReportForWhatsapp } from "./general-report-whatsapp";
import { GeneralReportEmail } from "./email-templates/relatorio-geral";
import { normalizeBlock, type GeneralReportContent } from "./general-report-lib";

const report: GeneralReportContent = {
  title: "Relatório X",
  executive_summary: "Resumo.",
  chapters: [
    {
      title: "Números",
      summary: "Visão geral",
      blocks: [
        { type: "kpis", items: [{ label: "Vendas", value: "R$ 10 mil" }] },
        {
          type: "chart",
          kind: "bar",
          title: "Por mês",
          x: "Mês",
          series: ["Valor"],
          data: [{ Mês: "Jan", Valor: 10 }],
          insight: "Janeiro lidera",
        },
        { type: "callout", tone: "atencao", text: "Cuidado" },
      ],
    },
  ],
};

describe("compartilhamento do Relatório Geral", () => {
  it("formata o texto do WhatsApp com resumo por capítulo e link", () => {
    const t = formatGeneralReportForWhatsapp(report, {
      representative: "Ana",
      dateLabel: "18/11/2026",
      link: "https://x/relatorio-geral/1",
    });
    expect(t).toContain("*Relatório X*");
    expect(t).toContain("• Vendas: *R$ 10 mil*");
    expect(t).toContain("Janeiro lidera");
    expect(t).toContain("https://x/relatorio-geral/1");
  });

  it("renderiza o e-mail com capítulos, barras e destaque", async () => {
    const html = await render(<GeneralReportEmail report={report} representative="Ana" />);
    expect(html).toContain("Números".toUpperCase());
    expect(html).toContain("Por mês");
    expect(html).toContain("Cuidado");
  });

  it("normalizeBlock descarta bloco inválido", () => {
    expect(
      normalizeBlock({ type: "text", text: "" }, { sheets: new Map(), imageIds: new Set() }),
    ).toBeNull();
    expect(
      normalizeBlock({ type: "text", text: "ok" }, { sheets: new Map(), imageIds: new Set() }),
    ).toEqual({
      type: "text",
      text: "ok",
    });
  });
});
