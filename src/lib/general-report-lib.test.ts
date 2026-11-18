import { describe, expect, it } from "vitest";
import {
  detectKind,
  normalizeReport,
  mergeUserChanges,
  periodAnalysis,
  pickBlock,
  prepareSheet,
  resolveChart,
  type ParsedSheet,
} from "./general-report-lib";

const sheet: ParsedSheet = {
  name: "Vendas",
  headers: ["Mês", "Valor", "Loja"],
  rows: [
    ["Jan", 100, "A"],
    ["Jan", 50, "B"],
    ["Fev", "1.200,50", "A"],
  ],
  rowCount: 3,
  truncated: false,
};

describe("general-report-lib", () => {
  it("detecta o tipo pelo arquivo", () => {
    expect(detectKind("dados.XLSX")).toBe("sheet");
    expect(detectKind("foto.jpg")).toBe("image");
    expect(detectKind("reuniao.m4a")).toBe("audio");
    expect(detectKind("x.pptx")).toBe("presentation");
    expect(detectKind("x.bin", "video/mp4")).toBe("video");
  });

  it("agrega dados reais da planilha, aceitando número em formato brasileiro", () => {
    const c = resolveChart(
      { kind: "bar", fileId: "f", sheet: "Vendas", x: "Mês", ys: ["Valor"], agg: "sum" },
      sheet,
    )!;
    expect(c.data).toEqual([
      { Mês: "Fev", Valor: 1200.5 },
      { Mês: "Jan", Valor: 150 },
    ]);
  });

  it("rejeita coluna inexistente e conta registros", () => {
    expect(
      resolveChart({ kind: "bar", fileId: "f", sheet: "Vendas", x: "Nope", ys: ["Valor"] }, sheet),
    ).toBeNull();
    const c = resolveChart(
      { kind: "pie", fileId: "f", sheet: "Vendas", x: "Loja", ys: [], agg: "count" },
      sheet,
    )!;
    expect(c.data[0]).toEqual({ Loja: "A", Quantidade: 2 });
  });

  it("normaliza o relatório descartando blocos inválidos", () => {
    const r = normalizeReport(
      {
        title: "R",
        executive_summary: "ok",
        chapters: [
          {
            title: "Cap 1",
            blocks: [
              { type: "text", text: "olá" },
              { type: "chart", kind: "bar", fileId: "f", sheet: "Vendas", x: "Mês", ys: ["Valor"] },
              { type: "chart", kind: "bar", fileId: "inexistente", x: "Mês", ys: ["Valor"] },
              { type: "image", fileId: "img-que-nao-existe", caption: "x" },
              { type: "bullets", items: [] },
            ],
          },
          { title: "Vazio", blocks: [] },
        ],
      },
      { sheets: new Map([["f", [sheet]]]), imageIds: new Set() },
    );
    expect(r.chapters).toHaveLength(1);
    expect(r.chapters[0].blocks.map((b) => b.type)).toEqual(["text", "chart"]);
  });
});

describe("gráficos com filtro e coluna calculada", () => {
  const carteira: ParsedSheet = {
    name: "Export",
    headers: ["Cliente", "Média (R$)", "Média LY (R$)"],
    rows: [
      ["A", 100, 300],
      ["B", 500, 200],
      ["C", 250, 240],
      ["D", 80, 0],
    ],
    rowCount: 4,
    truncated: false,
  };

  it("mostra só quem faturou mais que no período anterior, ordenado pelo crescimento", () => {
    const c = resolveChart(
      {
        kind: "bar",
        fileId: "f",
        sheet: "Export",
        x: "Cliente",
        ys: ["Crescimento (R$)"],
        agg: "sum",
        computed: [{ name: "Crescimento (R$)", a: "Média (R$)", op: "-", b: "Média LY (R$)" }],
        where: [{ column: "Média (R$)", op: ">", value: { column: "Média LY (R$)" } }],
      },
      carteira,
    )!;
    expect(c.data).toEqual([
      { Cliente: "B", "Crescimento (R$)": 300 },
      { Cliente: "D", "Crescimento (R$)": 80 },
      { Cliente: "C", "Crescimento (R$)": 10 },
    ]);
    expect(c.spec?.where).toHaveLength(1);
  });

  it("rejeita filtro em coluna inexistente", () => {
    expect(prepareSheet(carteira, [], [{ column: "Nope", op: ">", value: 0 }])).toBeNull();
  });

  it("aproveita o bloco mesmo quando a IA devolve um relatório inteiro", () => {
    const b = pickBlock(
      { title: "x", chapters: [{ title: "c", blocks: [{ type: "text", text: "ok" }] }] },
      { sheets: new Map(), imageIds: new Set() },
    );
    expect(b).toEqual({ type: "text", text: "ok" });
  });

  it("aceita números em kpis e tabelas", () => {
    const b = pickBlock(
      { type: "kpis", items: [{ label: "Clientes em crescimento", value: 22 }] },
      { sheets: new Map(), imageIds: new Set() },
    );
    expect(b).toEqual({ type: "kpis", items: [{ label: "Clientes em crescimento", value: "22" }] });
  });
});

describe("periodAnalysis (atual × anterior)", () => {
  const carteira: ParsedSheet = {
    name: "Export",
    headers: ["Grupo Cliente", "UF", "Média (R$)", "Média LY (R$)", "% Var (R$)"],
    rows: [
      ["A&M", "DF", 34854, 55339, -0.37],
      ["AMX", "DF", 29006, 18679, 0.55],
      ["Lumi", "DF", 23529, 18512, 0.27],
      ["Rovaris", "MT", 20469, 43006, -0.52],
    ],
    rowCount: 4,
    truncated: false,
  };

  it("pareia a coluna atual com a LY e ignora colunas de %", () => {
    const text = periodAnalysis(carteira);
    expect(text).toContain('"Média (R$)" (atual) × "Média LY (R$)" (anterior)');
  });

  it("mostra a queda individual que o líquido do estado esconde", () => {
    const text = periodAnalysis(carteira);
    const df = text.split("\n").find((l) => l.includes("· DF:"))!;
    // líquido DF = 87.389 − 92.530 = −5.141; perdas brutas −20.485 (A&M); ganhos +15.344
    expect(df).toContain("líquida -5.141");
    expect(df).toContain("perdas brutas -20.485 (1)");
    expect(df).toContain("ganhos brutos +15.344 (2)");
    expect(df).toContain("A&M -20.485");
  });

  it("sem par de períodos não gera análise", () => {
    expect(periodAnalysis(sheet)).toBe("");
  });
});

describe("mergeUserChanges (regerar mantém o que o usuário fez)", () => {
  const prev = {
    title: "Título do usuário",
    executive_summary: "Resumo escrito à mão",
    intro_locked: true,
    chapters: [
      {
        title: "Panorama",
        blocks: [
          { type: "text" as const, text: "texto da IA" },
          { type: "text" as const, text: "meu texto", locked: "editado" as const },
        ],
      },
      {
        title: "Capítulo que sumiu",
        blocks: [
          {
            type: "callout" as const,
            tone: "destaque" as const,
            text: "meu bloco",
            locked: "criado" as const,
          },
        ],
      },
    ],
  };
  const fresh = {
    title: "Título novo da IA",
    executive_summary: "Resumo novo",
    chapters: [
      { title: "Panorama", blocks: [{ type: "text" as const, text: "novo texto da IA" }] },
    ],
  };

  it("mantém blocos editados e criados e descarta os blocos antigos da IA", () => {
    const m = mergeUserChanges(prev, fresh);
    const all = m.chapters.flatMap((c) => c.blocks.map((b: any) => b.text));
    expect(all).toContain("meu texto");
    expect(all).toContain("meu bloco");
    expect(all).toContain("novo texto da IA");
    expect(all).not.toContain("texto da IA");
  });

  it("bloco cujo capítulo sumiu volta no de mesma posição, ou num capítulo com o título antigo", () => {
    const m = mergeUserChanges(prev, fresh);
    expect(m.chapters.map((c) => c.title)).toEqual(["Panorama", "Capítulo que sumiu"]);
    expect(m.chapters[0].blocks.map((b: any) => b.text)).toEqual(["novo texto da IA", "meu texto"]);
    const m2 = mergeUserChanges(prev, {
      ...fresh,
      chapters: [
        ...fresh.chapters,
        { title: "Outro", blocks: [{ type: "text" as const, text: "x" }] },
      ],
    });
    expect(m2.chapters[1].blocks.map((b: any) => b.text)).toEqual(["meu bloco", "x"]);
  });

  it("introdução editada à mão é mantida", () => {
    const m = mergeUserChanges(prev, fresh);
    expect(m.title).toBe("Título do usuário");
    expect(m.executive_summary).toBe("Resumo escrito à mão");
    expect(mergeUserChanges({ ...prev, intro_locked: false }, fresh).title).toBe(
      "Título novo da IA",
    );
  });
});
