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
  it("encerra na última informação do relatório sem adicionar uma conclusão", () => {
    const script = buildSpeechScript(report).join("\n");

    expect(script.endsWith("Esta é a última frase presente no relatório.")).toBe(true);
    expect(script).not.toContain("Fim do relatório");
  });
});
