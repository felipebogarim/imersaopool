import { describe, expect, it } from "vitest";
import {
  applyAiSuggestion,
  buildComparativo,
  buildInitialDrafts,
  buildSavePayload,
  changedFamilies,
  mergeSaved,
  projectedAttainment,
  projectedTotalAttainment,
  copyRepSuggestion,
  displayPercents,
  metasVisibility,
  parseMetaInput,
  restoreDefault,
  setMetaOficial,
  simulateAiSuggestions,
  summarizeDrafts,
  viewerRoleFromRoles,
  type FamilyMetaDraft,
} from "./performance-metas";

// Valores sintéticos: nenhum dado financeiro real de cliente.
const withMetas = (values: Array<number | null>, referencia: number | null = 100) =>
  buildInitialDrafts("Gold").map(
    (d, i): FamilyMetaDraft => ({ ...d, referencia, metaOficial: values[i] ?? null }),
  );

const gestor = metasVisibility("gestor");
const rep = metasVisibility("representante");

describe("performance-metas (simulação local)", () => {
  it("rascunho inicial parte da referência da categoria nos sete portfólios", () => {
    const drafts = buildInitialDrafts("gold");
    expect(drafts).toHaveLength(7);
    expect(drafts.every((d) => d.metaOficial === d.referencia && d.referencia != null)).toBe(true);
    const s = summarizeDrafts(drafts);
    expect(s.diferencaAbs).toBe(0);
    expect(s.status.origem).toBe("padrao");
  });

  it("categoria desconhecida não presume referência", () => {
    const drafts = buildInitialDrafts("Bronze");
    expect(drafts.every((d) => d.referencia == null && d.metaOficial == null)).toBe(true);
    const s = summarizeDrafts(drafts);
    expect(s.total).toBe(0);
    expect(s.referenciaTotal).toBeNull();
    expect(s.diferencaPct).toBeNull();
    expect(s.composicao).toBeNull();
  });

  it("total é a soma dos portfólios e a diferença é relativa à referência", () => {
    const s = summarizeDrafts(withMetas([100, 100, 100, 100, 100, 100, 160]));
    expect(s.total).toBe(760);
    expect(s.referenciaTotal).toBe(700);
    expect(s.diferencaAbs).toBe(60);
    expect(s.diferencaPct).toBeCloseTo(60 / 700, 10);
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

  it("ações registram a origem e o status fica misto quando combinadas", () => {
    let d = simulateAiSuggestions(withMetas([100, 100, 100, 100, 100, 100, 100]));
    d = d.map((x) => ({ ...x, sugestaoRep: 120 }));
    d = applyAiSuggestion(d, "PERFIL");
    d = copyRepSuggestion(d, "PRO LED");
    d = setMetaOficial(d, "PRO LAMP", 80);
    const byFam = Object.fromEntries(d.map((x) => [x.familia, x]));
    expect(byFam["PERFIL"].origem).toBe("ia");
    expect(byFam["PERFIL"].metaOficial).toBe(byFam["PERFIL"].sugestaoIa?.valor);
    expect(byFam["PRO LED"]).toMatchObject({ origem: "representante", metaOficial: 120 });
    expect(byFam["PRO LAMP"]).toMatchObject({ origem: "gestor", metaOficial: 80 });
    const status = summarizeDrafts(d).status;
    expect(status.origem).toBe("misto");
    expect(status.contagem).toEqual({ padrao: 4, ia: 1, representante: 1, gestor: 1 });
  });

  it("aplicar IA ou copiar representante sem sugestão não altera a meta", () => {
    const d = withMetas([100, 100, 100, 100, 100, 100, 100]);
    expect(applyAiSuggestion(d)).toEqual(d);
    expect(copyRepSuggestion(d)).toEqual(d);
  });

  it("restaurar padrão devolve a referência e preserva as sugestões", () => {
    const edited = withMetas([5, 5, 5, 5, 5, 5, 5]).map((x) => ({
      ...x,
      sugestaoRep: 42,
      comentarioGestor: "x",
      origem: "gestor" as const,
    }));
    const one = restoreDefault(edited, "PERFIL");
    expect(one.find((x) => x.familia === "PERFIL")?.metaOficial).toBe(100);
    expect(one.find((x) => x.familia === "PRO LED")?.metaOficial).toBe(5);
    const all = restoreDefault(edited);
    expect(all.every((x) => x.metaOficial === 100 && x.origem === "padrao")).toBe(true);
    expect(all.every((x) => x.sugestaoRep === 42)).toBe(true);
  });

  it("sugestão IA é demonstrativa, marcada como simulada e com tag de origem", () => {
    const sim = simulateAiSuggestions(withMetas([1, 2, 3, 4, 5, 6, 7]));
    for (const d of sim) {
      expect(d.sugestaoIa?.simulada).toBe(true);
      expect(["imersao", "tendencia"]).toContain(d.sugestaoIa?.tag);
      expect((d.sugestaoIa?.valor ?? 0) % 50).toBe(0);
    }
    expect(simulateAiSuggestions(buildInitialDrafts(null)).every((d) => d.sugestaoIa == null)).toBe(
      true,
    );
  });

  it("comparativo: barra = performance; metas como participação no total", () => {
    const drafts = withMetas([150, 100, 100, 100, 100, 100, 100]);
    const pts = buildComparativo(drafts, { "DECOR NEWLINE": 0.6 }, gestor);
    // meta oficial 150 sobre padrão 100: realizado estimado 60 → 40% da nova meta
    expect(pts[0].performancePct).toBeCloseTo(40, 10);
    expect(pts[0].performanceOficialPct).toBeCloseTo(60, 10);
    expect(pts[0].metaPct).toBeCloseTo((150 / 750) * 100, 10);
    expect(pts[0].metaValor).toBe(150);
    expect(pts[0].referenciaPct).toBeCloseTo((100 / 700) * 100, 10);
    expect(pts[0].referenciaValor).toBe(100);
    expect(pts[1].performancePct).toBeNull();
  });

  it("comparativo do representante não expõe a meta padrão", () => {
    const drafts = withMetas([150, 100, 100, 100, 100, 100, 100]);
    const pts = buildComparativo(drafts, { "DECOR NEWLINE": 0.6 }, rep);
    expect(pts[0].referenciaValor).toBeNull();
    expect(pts[0].referenciaPct).toBeNull();
    expect(pts[0].performanceOficialPct).toBeNull();
    expect(pts[0].metaPct).toBeCloseTo((150 / 750) * 100, 10);
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
    expect(rep.verMetaPadrao).toBe(false);
    expect(rep.verSugestaoIa).toBe(false);
    expect(rep.editarMetaOficial).toBe(false);
    expect(rep.editarSugestaoRep).toBe(true);
    expect(gestor.verMetaPadrao && gestor.verSugestaoIa && gestor.editarMetaOficial).toBe(true);
  });
  it("atingimento é recalculado sobre a meta oficial a partir do realizado estimado", () => {
    const d = { referencia: 1000, metaOficial: 1000 };
    expect(projectedAttainment(d, 0.8)).toBeCloseTo(0.8, 10);
    expect(projectedAttainment({ ...d, metaOficial: 800 }, 0.8)).toBeCloseTo(1, 10);
    expect(projectedAttainment({ ...d, metaOficial: 1600 }, 0.8)).toBeCloseTo(0.5, 10);
    expect(projectedAttainment({ ...d, metaOficial: 0 }, 0.8)).toBeNull();
    expect(projectedAttainment(d, null)).toBeNull();
    expect(projectedAttainment({ ...d, referencia: null }, 0.8)).toBeNull();
    expect(projectedAttainment(d, 0)).toBe(0);
  });

  it("atingimento total projetado pondera pelo realizado estimado", () => {
    const drafts = withMetas([100, 200, 100, 100, 100, 100, 100]);
    // só dois portfólios com atingimento: (0.5×100 + 1×100) ÷ (100 + 200)
    const r = projectedTotalAttainment(drafts, { "DECOR NEWLINE": 0.5, "DECOR STUDIO": 1 });
    expect(r.ratio).toBeCloseTo(150 / 300, 10);
    expect(r.estimado).toBe(true);
    expect(projectedTotalAttainment(drafts, {}).ratio).toBeNull();
  });

  it("com valor vendido real do backend, o atingimento deixa de ser estimado", () => {
    const drafts = withMetas([200, 100, 100, 100, 100, 100, 100]);
    const base = { "DECOR NEWLINE": { valor: 150, estimado: false } };
    const pts = buildComparativo(drafts, { "DECOR NEWLINE": 0.6 }, gestor, base);
    expect(pts[0].performancePct).toBeCloseTo(75, 10); // 150 ÷ 200, ignora 0,6 × padrão
    expect(pts[0].estimado).toBe(false);
    expect(buildComparativo(drafts, { "DECOR NEWLINE": 0.6 }, gestor)[0].estimado).toBe(true);
    const tot = projectedTotalAttainment(drafts, { "DECOR NEWLINE": 0.6 }, base);
    expect(tot).toEqual({ ratio: 150 / 200, estimado: false });
  });

  it("detecta portfólios alterados e monta o payload por perfil", () => {
    const saved = simulateAiSuggestions(withMetas([100, 100, 100, 100, 100, 100, 100]));
    let cur = setMetaOficial(saved, "PERFIL", 130);
    cur = cur.map((x) => (x.familia === "PRO LED" ? { ...x, justificativaRep: "obra" } : x));
    expect(changedFamilies(saved, cur)).toEqual(["PRO LED", "PERFIL"]);
    expect(changedFamilies(saved, saved)).toEqual([]);

    const g = buildSavePayload(cur, "gestor", ["PERFIL"]);
    expect(g.perfil).toBe("gestor");
    if (g.perfil === "gestor") {
      expect(g.metas).toEqual([
        {
          familia: "PERFIL",
          meta_oficial: 130,
          comentario_gestor: "",
          origem: "gestor",
          referencia: 100,
        },
      ]);
      expect(g.sugestoes_ia).toHaveLength(1);
    }
    const r = buildSavePayload(cur, "representante", ["PRO LED"]);
    expect(r).toEqual({
      perfil: "representante",
      sugestoes: [{ familia: "PRO LED", valor: null, justificativa: "obra" }],
    });
    // o payload do representante nunca carrega meta padrão nem sugestão da IA
    expect(JSON.stringify(r)).not.toMatch(/referencia|sugestoes_ia/);
  });
  it("salvar separa os campos do gestor e do representante", () => {
    const saved = withMetas([100, 100, 100, 100, 100, 100, 100]);
    let cur = setMetaOficial(saved, "PERFIL", 130);
    cur = cur.map((x) => (x.familia === "PRO LED" ? { ...x, sugestaoRep: 90 } : x));
    expect(changedFamilies(saved, cur, "gestor")).toEqual(["PERFIL"]);
    expect(changedFamilies(saved, cur, "representante")).toEqual(["PRO LED"]);

    const afterRep = mergeSaved(saved, cur, "representante");
    expect(changedFamilies(afterRep, cur, "representante")).toEqual([]);
    expect(changedFamilies(afterRep, cur, "gestor")).toEqual(["PERFIL"]);
    const afterBoth = mergeSaved(afterRep, cur, "gestor");
    expect(changedFamilies(afterBoth, cur)).toEqual([]);
  });
});
