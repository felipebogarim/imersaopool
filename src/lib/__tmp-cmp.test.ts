import { expect, it } from "vitest";
import { parseVisaoRepMarkdown } from "@/lib/visao-rep2-markdown";
import { buildLeituraIntegrada } from "@/lib/visao-rep2-leitura";
const md = `# Visão Rep 2
## 00 — Visão executiva
**Sinais prioritários**

### Sinal 1
- titulo: Teste de comparação
- achado: Achado de teste.
- impacto_comercial: Impacto de teste.
- nivel_confianca: alto
- status_evidencia: corroborado_por_outras_entrevistas
- perspectivas_relacionadas: 01; 03
- classificacao_comparativa: confirma_o_grupo_com_leitura_especifica
- fontes_comparaveis: 5
- comparacao_grupo: Texto de comparação utilizado para validar o parser.
`;
it("parses", () => {
  const r: any = parseVisaoRepMarkdown(md);
  const v = r.visao ?? r.value ?? r;
  const s = v.executive_view.priority_signals[0];
  console.log(s);
  expect(s.comparison_classification).toBe("confirma_o_grupo_com_leitura_especifica");
  expect(s.comparable_sources).toBe(5);
  expect(s.group_comparison).toContain("validar o parser");
  const l = buildLeituraIntegrada(v);
  console.log(l.signals[0].comparisons);
  expect(l.signals[0].comparisons.length).toBe(1);
});
