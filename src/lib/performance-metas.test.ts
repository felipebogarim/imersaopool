import { describe, expect, it } from "vitest";
import {
  buildInitialDrafts,
  displayPercents,
  metasVisibility,
  parseMetaInput,
  restoreDefaultDrafts,
  simulateAiSuggestions,
  summarizeDrafts,
  viewerRoleFromRoles,
  type FamilyMetaDraft,
} from "./performance-metas";

// Valores sintéticos: nenhum dado financeiro real de cliente.
const withMetas = (values: Array<number | null>, referencia: number | null = 100) =>
  buildInitialDrafts("Gold").map(
    (d, i): FamilyMetaDraft => ({ ...d, referencia, metaGestor: values[i] ?? null }),
  );

describe("performance-metas (simulação local)", () => {
  it("rascunho inicial parte da referência da categoria nas sete famílias", () => {
    const drafts = buildInitialDrafts("gold");
    expect(drafts).toHaveLength(7);
    expect(drafts.every((d) => d.metaGestor === d.referencia && d.referencia != null)).toBe(true);
    expect(summarizeDrafts(drafts).variacaoAbs).toBe(0);
  });

  it("categoria desconhecida não presume referência", () => {
    const drafts = buildInitialDrafts("Bronze");
    expect(drafts.every((d) => d.referencia == null && d.metaGestor == null)).toBe(true);
    const s = summarizeDrafts(drafts);
    expect(s.total).toBe(0);
    expect(s.referenciaTotal).toBeNull();
    expect(s.variacaoPct).toBeNull();
    expect(s.composicao).toBeNull();
  });

  it("total é a soma das famílias e a variação é relativa à referência", () => {
    const s = summarizeDrafts(withMetas([100, 100, 100, 100, 100, 100, 160]));
    expect(s.total).toBe(760);
    expect(s.referenciaTotal).toBe(700);
    expect(s.variacaoAbs).toBe(60);
    expect(s.variacaoPct).toBeCloseTo(60 / 700, 10);
  });

  it("composição soma 100% quando o total é positivo", () => {
    const s = summarizeDrafts(withMetas([1, 1, 1, 0, 0, 0, 0]));
    const soma = Object.values(s.composicao ?? {}).reduce((a, b) => a + b, 0);
    expect(soma).toBeCloseTo(1, 12);
    const pct = displayPercents(s.composicao);
    expect(Object.values(pct ?? {}).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    expect(pct?.["DECOR NEWLINE"]).toBe(33.4);
  });

  it("sem meta positiva não há composição", () => {
    expect(summarizeDrafts(withMetas([0, 0, 0, 0, 0, 0, 0])).composicao).toBeNull();
    expect(displayPercents(null)).toBeNull();
  });

  it("restaurar padrão devolve a referência e preserva a sugestão do representante", () => {
    const edited = withMetas([5, 5, 5, 5, 5, 5, 5]).map((d) => ({
      ...d,
      sugestaoRep: 42,
      justificativaGestor: "x",
    }));
    const restored = restoreDefaultDrafts(edited);
    expect(restored.every((d) => d.metaGestor === 100 && d.justificativaGestor === "")).toBe(true);
    expect(restored.every((d) => d.sugestaoRep === 42)).toBe(true);
  });

  it("sugestão IA é demonstrativa e identificada como simulação", () => {
    const sim = simulateAiSuggestions(withMetas([1, 2, 3, 4, 5, 6, 7]));
    for (const d of sim) {
      expect(d.sugestaoIa?.origem).toBe("simulacao_local");
      expect(d.sugestaoIa?.valor).toBe(d.referencia);
    }
    expect(simulateAiSuggestions(buildInitialDrafts(null)).every((d) => d.sugestaoIa == null)).toBe(
      true,
    );
  });

  it("entrada numérica aceita formato brasileiro e rejeita negativos", () => {
    expect(parseMetaInput("1.500,50")).toBe(1500.5);
    expect(parseMetaInput("R$ 2.000")).toBe(2000);
    expect(parseMetaInput("1500.5")).toBe(1500.5);
    expect(parseMetaInput("")).toBeNull();
    expect(parseMetaInput("-10")).toBeNull();
    expect(parseMetaInput("abc")).toBeNull();
  });

  it("representante não vê meta padrão nem sugestão da IA", () => {
    expect(viewerRoleFromRoles(["agente"])).toBe("representante");
    expect(viewerRoleFromRoles(["gestor"])).toBe("gestor");
    expect(viewerRoleFromRoles(["admin"])).toBe("gestor");
    const rep = metasVisibility("representante");
    expect(rep.verMetaPadrao).toBe(false);
    expect(rep.verSugestaoIa).toBe(false);
    expect(rep.editarMetaOficial).toBe(false);
    expect(rep.editarSugestaoRep).toBe(true);
    const gestor = metasVisibility("gestor");
    expect(gestor.verMetaPadrao && gestor.verSugestaoIa && gestor.editarMetaOficial).toBe(true);
  });
});
