import React from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { GeneralReportEmail } from "./email-templates/relatorio-geral";
import { parseImportJson } from "./general-report-import";
import {
  buildImportedSpeechScript,
  formatImportedForWhatsapp,
  importedToEmailContent,
} from "./general-report-import-share";

const parsed = parseImportJson(readFileSync("docs/relatorio-geral-import-exemplo.json", "utf8"));
if (!parsed.ok) throw new Error("exemplo inválido");
const report = parsed.data;

describe("relatório importado — áudio", () => {
  const script = buildImportedSpeechScript(report).join(" ");
  it("lê título, introdução e um resumo de cada gráfico/quadro", () => {
    expect(script).toContain("Relatório de Performance Comercial");
    expect(script).toContain("retração líquida de 15,0 por cento");
    expect(script).toContain("Resultado geral");
    expect(script).toContain("100.000 reais");
    expect(script).toContain("85.000 reais");
    expect(script).toContain("Média mensal por estado");
    expect(script).toContain("Concentração das perdas");
    expect(script).toContain("Maiores crescimentos");
  });
  it("não lê símbolos de moeda nem de formatação, e pula relato não inputado", () => {
    expect(script).not.toMatch(/R\$|\*|#/);
    expect(script).not.toContain("ainda não inputados");
  });
  it("os trechos cabem no limite do leitor", () => {
    for (const p of buildImportedSpeechScript(report)) expect(p.length).toBeLessThanOrEqual(4000);
  });
});

describe("relatório importado — WhatsApp", () => {
  it("leva título, período, temas com destaque e o link público", () => {
    const t = formatImportedForWhatsapp(report, {
      link: "https://poolflux.app/relatorio/abc",
      introMessage: "Segue.",
    });
    expect(t.startsWith("Segue.")).toBe(true);
    expect(t).toContain("*Relatório de Performance Comercial — Representante Exemplo*");
    expect(t).toContain("*A carteira registrou retração líquida de 15,0%.*");
    expect(t).toContain("https://poolflux.app/relatorio/abc");
  });
  it("sem link, não inventa endereço", () => {
    expect(formatImportedForWhatsapp(report)).not.toContain("http");
  });
});

describe("relatório importado — e-mail", () => {
  const content = importedToEmailContent(report);
  it("converte cada bloco em capítulo com os valores já formatados", () => {
    expect(content.title).toBe(report.title);
    expect(content.chapters.map((c) => c.title)).toEqual([
      "Resultado geral",
      "Média mensal por estado",
      "Concentração das perdas",
      "Top 10 crescimentos",
      "Top 6 crescimentos · Comparativo",
      "Motivos de crescimento · Top 6",
    ]);
    const json = JSON.stringify(content);
    expect(json).toContain("R$ 100.000,00");
    expect(json).toContain("−R$ 15.000,00");
    expect(json).toContain("Dados ainda não inputados");
  });
  it("renderiza com o link público e sem link quando não há", async () => {
    const withLink = await render(
      <GeneralReportEmail
        report={content}
        representative="X"
        date=""
        linkUrl="https://poolflux.app/relatorio/abc"
      />,
    );
    expect(withLink).toContain("https://poolflux.app/relatorio/abc");
    expect(withLink).toContain("Ver o relatório online");
    const without = await render(
      <GeneralReportEmail
        report={content}
        representative="X"
        date=""
        linkUrl=""
        appUrl="https://poolflux.app/x"
        reportId="1"
      />,
    );
    expect(without).not.toContain("/relatorio-geral/1");
    expect(without).not.toContain("Ver o relatório online");
  });
});
