import { describe, expect, it } from "vitest";
import { CANONICAL_FAMILIES } from "@/lib/client-bi-familias";
import type { GoalsState } from "@/lib/performance-metas-persistence";
import {
  aiFillForMissing,
  bulkCategoria,
  bulkResumo,
  bulkRowStatus,
} from "./performance-metas-bulk";

const cycle = { id: "c1", inicio: "2026-11-01", fim: "2027-04-01" } as GoalsState["cycle"];

const state = (over: Partial<GoalsState>): GoalsState => ({
  cycle,
  items: [],
  rep_suggestions: [],
  ai_suggestions: [],
  ...over,
});

const ai = (familia: string, valor: number) => ({
  familia,
  valor,
  justificativa: "x",
  tag: "imersao" as const,
  origem: "modelo" as const,
});

describe("convite em massa — avaliação das metas", () => {
  it("completo só com ciclo e os 7 portfólios gravados", () => {
    const all = state({
      items: CANONICAL_FAMILIES.map((familia) => ({ familia, meta_mensal: 1000 })),
    });
    expect(bulkCategoria(bulkRowStatus("a", all))).toBe("completo");
    const semCiclo = { ...all, cycle: null };
    expect(bulkCategoria(bulkRowStatus("a", semCiclo))).toBe("parcial");
  });

  it("parcial lista o que falta e quais têm IA; meta nula conta como faltando", () => {
    const s = bulkRowStatus(
      "a",
      state({
        items: [
          { familia: "DECOR NEWLINE", meta_mensal: 3000 },
          { familia: "PRO LED", meta_mensal: null },
        ],
        ai_suggestions: [ai("PRO LED", 1500), { ...ai("PERFIL", 900), origem: "simulacao" }],
      }),
    );
    expect(bulkCategoria(s)).toBe("parcial");
    expect(s.faltando).toHaveLength(6);
    expect(s.faltandoComIa).toEqual(["PRO LED"]);
  });

  it("sem estado = pendente; erro prevalece; resumo agrupa", () => {
    const p = bulkRowStatus("p", null);
    expect(bulkCategoria(p)).toBe("pendente");
    const e = { ...p, rowId: "e", erro: "sem permissão" };
    expect(bulkResumo([p, e])).toEqual({ completo: [], parcial: [], pendente: ["p"], erro: ["e"] });
  });

  it("preenche só os faltantes com a sugestão IA (origem ia)", () => {
    const fill = aiFillForMissing(
      state({
        items: [{ familia: "DECOR NEWLINE", meta_mensal: 3000 }],
        ai_suggestions: [ai("DECOR NEWLINE", 9999), ai("PRO LED", 1500)],
      }),
    );
    expect(fill).toEqual([
      expect.objectContaining({ familia: "PRO LED", meta_mensal: 1500, origem: "ia" }),
    ]);
  });
});
