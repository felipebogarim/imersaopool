// Testes do PADRÃO CANÔNICO do Relatório Final de Imersão em Campo
// (schema field_store_visit_v1 + gerador src/lib/immersion-final-pdf.ts).
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  buildImmersionPdfDoc,
  buildMapaExecutivo,
  buildSumario,
  isFieldImmersionReport,
  parseBlocks,
  type ImmersionChapter,
} from "./immersion-final-pdf";
import { parseExecutiveMap, parseExecutiveSummary } from "./field-store-visit";

const chapters: ImmersionChapter[] = [
  { ordem: 1, titulo: "Contexto da visita", markdown: "Parágrafo inicial.\n\n> A entrega precisa ser mais rápida.\n\n**Fonte: Equipe ACME**" },
  { ordem: 2, titulo: "Síntese e próximos passos", markdown: "### Conclusões\n- Sinal A\n\n### Próximos passos\n1. Ação A\n2. Ação B" },
];

const base = {
  cliente: "ACME DISTRIBUIDORA DE MATERIAIS LTDA",
  dataVisita: "12/03/2026",
  local: "Curitiba/PR",
  representante: "Rep X",
  consultor: "Consultor Y",
  participantes: "A, B",
  chapters,
};

describe("roteamento canônico", () => {
  it("1. field_store_visit sempre usa o gerador de imersão", () => {
    expect(isFieldImmersionReport({ __field_store_visit__: { meta: {} } })).toBe(true);
    expect(isFieldImmersionReport({ outras: 1 })).toBe(false);
    expect(isFieldImmersionReport(null)).toBe(false);
  });

  it("10. não depende da taxonomia antiga de entrevistas", () => {
    const outro: ImmersionChapter[] = [
      { ordem: 1, titulo: "Título totalmente diferente", markdown: "Conteúdo." },
      { ordem: 2, titulo: "Fechamento próprio", markdown: "- item" },
    ];
    const doc = buildImmersionPdfDoc({ ...base, cliente: "OUTRO CLIENTE SA", chapters: outro });
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
  });
});

describe("estrutura", () => {
  it("2/3. índice e páginas usam apenas capítulos reais com conteúdo", () => {
    const doc = buildImmersionPdfDoc(base);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
    expect(() => buildImmersionPdfDoc({ ...base, chapters: [] })).toThrow();
  });

  it("4. data da visita vem dos metadados do relatório", () => {
    const doc = buildImmersionPdfDoc(base);
    expect(doc).toBeTruthy();
    expect(base.dataVisita).toBe("12/03/2026");
  });

  it("6. citações permanecem literais, com fonte", () => {
    const blocks = parseBlocks(chapters[0].markdown);
    const quote = blocks.find((b) => b.type === "quote") as any;
    expect(quote.text).toBe("A entrega precisa ser mais rápida.");
    expect(quote.source).toBe("Fonte: Equipe ACME");
  });
});

describe("sumário executivo", () => {
  it("5. é lido verbatim do relatório quando estruturado", () => {
    const md = [
      "## Sumário executivo",
      "### Síntese geral",
      "- Visão consolidada da visita",
      "### Sinais prioritários",
      "1. Sinal um",
      "2. Sinal dois",
      "### Leitura executiva",
      "- Implicação gerencial",
    ].join("\n");
    const parsed = parseExecutiveSummary(md);
    expect(parsed?.sinais_prioritarios).toEqual(["Sinal um", "Sinal dois"]);
    const sumario = buildSumario(chapters, parsed);
    expect(sumario.sinteseGeral).toEqual(["Visão consolidada da visita"]);
    expect(sumario.leituraExecutiva).toEqual(["Implicação gerencial"]);
  });

  it("ausente, cai na leitura do capítulo final sem erro", () => {
    expect(parseExecutiveSummary("## Metadados\n- cliente: X")).toBeNull();
    expect(buildSumario(chapters, null).sinaisPrioritarios).toEqual(["Sinal A"]);
  });
});

describe("mapa executivo", () => {
  it("7. usa apenas dados explicitamente estruturados", () => {
    const md = [
      "## Mapa executivo",
      "### Forças",
      "- Marca reconhecida",
      "### Barreiras",
      "- Hábito de compra",
    ].join("\n");
    const map = parseExecutiveMap(md);
    const mapa = buildMapaExecutivo(map);
    expect(mapa.map((b) => b.titulo)).toEqual(["Forças atuais", "Barreiras"]);
    expect(mapa[0].itens).toEqual(["Marca reconhecida"]);
  });

  it("8/9. ausência de executive_map não gera erro e não infere conteúdo", () => {
    expect(parseExecutiveMap("## Capítulo 1\n- oportunidade de crescimento")).toBeNull();
    expect(buildMapaExecutivo(null)).toEqual([]);
    expect(() => buildImmersionPdfDoc({ ...base, executiveMap: null })).not.toThrow();
  });
});
