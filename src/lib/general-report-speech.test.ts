import { describe, expect, it } from "vitest";
import { buildGeneralSpeechScript } from "./general-report-speech";
import type { GeneralReportContent } from "./general-report-lib";

const r: GeneralReportContent = {
  title: "Relatório X",
  executive_summary: "Resumo.",
  chapters: [
    {
      title: "Números",
      blocks: [
        {
          type: "chart",
          kind: "bar",
          title: "Vendas por mês",
          x: "Mês",
          series: ["Valor"],
          data: [
            { Mês: "Jan", Valor: 10 },
            { Mês: "Fev", Valor: 50 },
            { Mês: "Mar", Valor: 30 },
            { Mês: "Abr", Valor: 5 },
          ],
        },
        {
          type: "table",
          title: "Riscos",
          columns: ["Risco", "Ação"],
          rows: [
            ["A", "B"],
            ["C", "D"],
          ],
        },
      ],
    },
  ],
};

describe("roteiro de áudio do Relatório Geral", () => {
  it("resume gráficos e quadros sem ler todos os dados", () => {
    const s = buildGeneralSpeechScript(r, { representative: "Ana" }).join("\n");
    expect(s).toContain("Gráfico: Vendas por mês.");
    expect(s).toContain("Em destaque: Fev, com 50; Mar, com 30; Jan, com 10");
    expect(s).not.toContain("Abr");
    expect(s).toContain("Quadro: Riscos, com 2 linhas sobre Risco, Ação.");
    expect(s).toContain("Capítulo 1. Números.");
  });
});
