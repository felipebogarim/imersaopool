import { describe, expect, it } from "vitest";
import { parseVisaoRepMarkdown, toVisaoRepMarkdown } from "./visao-rep2-markdown";
import { isExecutiveBriefV1, normalizeVisaoRep2, validateVisaoRep2 } from "./visao-rep2-schema";

const BRIEF_V3 = `# VISÃO REP 2 — BRIEFING EXECUTIVO

## Metadados

- schema_version: 3.0
- view_model: executive_brief_v1
- representante: Fabio Bristotti
- regiao: Campinas e região
- data_relatorio: 2026-07-30

## Síntese presidencial

Fabio Bristotti percebe a Newline em um momento competitivo de produto e preço,
mas a marca ainda é descartada antes da cotação em parte dos lojistas.

## Temas estratégicos

### Tema 1 — Preço competitivo, percepção ainda premium

- id: preco
- seletor: Preço e percepção
- contexto: A condição favorável de preço ainda não foi assimilada pelos vendedores.
- representa: A marca precisa entrar na primeira comparação.
- decisao: Definir plano de comunicação de competitividade.
- evidencia: O lojista recorreu à Pix acreditando em proposta inferior.
- comparacao: Leitura convergente com outras entrevistas.
- confianca: Alta
- concorrentes: Pix
- perspectivas: 1, 5

**Onde aparece**

- Pix é associada a mini embutidos de menor preço.
- A Newline estava mais barata no caso relatado.

### Tema 2 — Profundidade de portfólio nas famílias técnicas

- id: portfolio
- seletor: Portfólio
- contexto: Famílias técnicas sem profundidade de tonalidades e fachos.
- decisao: Avaliar ampliação de variantes.
- confianca: Média

### Tema 3 — Esforço de venda e velocidade de resposta

- id: esforco
- seletor: Esforço de venda
- contexto: Consultar estoque e obter respostas internas aumenta o esforço.
- validacao: Medir tempo médio de resposta.

### Tema 4 — Presença e amostra como alavanca de conversão

- id: presenca
- seletor: Presença
- contexto: Amostra e presença têm impacto direto na conversão.
- clientes: LedLuz, Bonalluce

## 04 — Perspectivas da entrevista

### Perspectiva 01 — Percepção de marca e preço

- achado_executivo: A marca é percebida como premium antes da cotação.
`;

const LEGACY_V2 = `# VISÃO REP — RELATÓRIO FINAL

## Metadados

- schema_version: visao_rep.v2
- representante: Representante Antigo

## 00 — Visão executiva

**Tese central**

Tese central do relatório antigo.

**Sinais prioritários**

### Sinal 1

- titulo: Sinal antigo
- achado: Achado do sinal antigo.

## 04 — Perspectivas da entrevista

### Perspectiva 01 — Percepção de marca e preço

- achado_executivo: Achado antigo.
`;

describe("Visão Rep 2 — schema 3.0 / executive_brief_v1", () => {
  const v = normalizeVisaoRep2(parseVisaoRepMarkdown(BRIEF_V3));

  it("reconhece o schema 3.0 e o view_model", () => {
    expect(v.metadata.schema_version).toBe("3.0");
    expect(v.metadata.view_model).toBe("executive_brief_v1");
    expect(isExecutiveBriefV1(v)).toBe(true);
  });

  it("reconhece a síntese presidencial", () => {
    expect(v.executive_brief?.presidential_synthesis).toContain("momento competitivo");
  });

  it("reconhece os quatro temas estratégicos", () => {
    expect(v.executive_brief?.themes).toHaveLength(4);
    expect(v.executive_brief?.themes[0].title).toBe("Preço competitivo, percepção ainda premium");
    expect(v.executive_brief?.themes[0].where_appears).toHaveLength(2);
    expect(v.executive_brief?.themes[0].entities.concorrentes).toEqual(["Pix"]);
    expect(v.executive_brief?.themes[3].entities.clientes).toEqual(["LedLuz", "Bonalluce"]);
  });

  it("não acusa tese central nem sinais prioritários como ausentes", () => {
    const r = validateVisaoRep2(v);
    expect(r.missingRequired).toEqual([]);
    expect([...r.missingRequired, ...r.missingOptional].join(" ")).not.toContain("tese central");
    expect([...r.missingRequired, ...r.missingOptional].join(" ")).not.toContain("sinais prioritários");
    expect(r.recognized).toContain("Síntese presidencial");
    expect(r.recognized).toContain("Temas estratégicos › 4 tema(s)");
  });

  it("mapeia internamente para os campos antigos sem duplicar na exportação", () => {
    expect(v.executive_view.central_thesis).toBe(v.executive_brief?.presidential_synthesis);
    expect(v.executive_view.priority_signals.map(s => s.title)).toEqual([
      "Preço competitivo, percepção ainda premium",
      "Profundidade de portfólio nas famílias técnicas",
      "Esforço de venda e velocidade de resposta",
      "Presença e amostra como alavanca de conversão",
    ]);
    const md = toVisaoRepMarkdown(v);
    expect(md).toContain("## Síntese presidencial");
    expect(md).not.toContain("**Tese central**");
    expect(md).not.toContain("### Sinal 1");
    // round-trip preserva o modelo
    const back = normalizeVisaoRep2(parseVisaoRepMarkdown(md));
    expect(back.executive_brief?.themes).toHaveLength(4);
  });
});

describe("Visão Rep 2 — relatórios anteriores ao 3.0", () => {
  const v = normalizeVisaoRep2(parseVisaoRepMarkdown(LEGACY_V2));

  it("mantém a validação antiga", () => {
    expect(isExecutiveBriefV1(v)).toBe(false);
    const r = validateVisaoRep2(v);
    expect(r.missingRequired).toEqual([]);
    expect(r.recognized).toContain("Visão executiva › tese central");
    expect(v.executive_brief).toBeNull();
  });

  it("acusa ausência real de tese central", () => {
    const semTese = normalizeVisaoRep2(parseVisaoRepMarkdown(LEGACY_V2.replace("Tese central do relatório antigo.", "")));
    expect(validateVisaoRep2(semTese).missingRequired).toContain("Visão executiva › tese central");
  });
});
