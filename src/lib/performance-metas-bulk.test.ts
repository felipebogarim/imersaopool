import { describe, expect, it } from "vitest";
import { CANONICAL_FAMILIES } from "@/lib/client-bi-familias";
import type { GoalsState } from "@/lib/performance-metas-persistence";
import {
  aiFillForMissing,
  bulkCategoria,
  bulkResumo,
  bulkRowStatus,
  comentarioRevisado,
  MARCA_MINIMO_MASSA,
  competenciasMassa,
  minimosParaFaltantes,
  statusRevisao,
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

describe("metas mínimas em massa", () => {
  const MIN = [
    { categoria: "Black", familia: "PERFIL", minimo: 3000 },
    { categoria: "Black", familia: "PRO LED", minimo: 3000 },
    { categoria: "Black", familia: "FITAS E FONTES", minimo: 6000 },
    { categoria: "Gold", familia: "PERFIL", minimo: 2000 },
  ];

  it("preenche só portfólios sem meta, com o mínimo da categoria cadastrada", () => {
    const metas = minimosParaFaltantes(
      { items: [{ familia: "PERFIL", meta_mensal: 9000 }], agendadas: [] },
      "BLACK",
      MIN,
    );
    expect(metas.map((m) => [m.familia, m.meta_mensal])).toEqual([
      ["PRO LED", 3000],
      ["FITAS E FONTES", 6000],
    ]);
    expect(
      metas.every((m) => m.origem === "ia" && m.comentario_gestor === MARCA_MINIMO_MASSA),
    ).toBe(true);
  });

  it("meta programada (agendada) também conta como definida; categoria desconhecida não grava", () => {
    expect(
      minimosParaFaltantes(
        {
          items: [],
          agendadas: [{ familia: "PERFIL", meta_mensal: 2500, vigente_desde: "2027-01-01" }],
        },
        "Gold",
        MIN,
      ),
    ).toEqual([]);
    expect(minimosParaFaltantes(null, "Consumidor Final", MIN)).toEqual([]);
  });

  it("mínimo em massa anterior é reaplicado (não conta como revisado)", () => {
    const metas = minimosParaFaltantes(
      {
        items: CANONICAL_FAMILIES.map((familia) => ({
          familia,
          meta_mensal: 1,
          origem: "ia" as const,
          comentario_gestor: MARCA_MINIMO_MASSA,
        })),
        agendadas: [],
      },
      "Black",
      MIN,
    );
    expect(metas.length).toBe(MIN.filter((m) => m.categoria === "Black").length);
  });

  it("grava na competência vigente agora (e no próximo semestre já programado)", () => {
    const hoje = new Date(2026, 10, 25);
    const jul = { id: "c", inicio: "2026-07-01", fim: "2026-12-01" };
    expect(competenciasMassa(jul, null, hoje)).toEqual(["2026-11-01"]);
    expect(competenciasMassa(null, null, hoje)).toEqual(["2026-11-01"]);
    const prox = { id: "p", inicio: "2027-01-01", fim: "2027-06-01" };
    expect(competenciasMassa(jul, prox, hoje)).toEqual(["2026-11-01", "2027-01-01"]);
  });

  it("status: massa = IA (não revisada); salvar no painel remove a marca", () => {
    const s = statusRevisao([
      { familia: "PERFIL", meta_mensal: 3000, origem: "ia", comentario_gestor: MARCA_MINIMO_MASSA },
      { familia: "PRO LED", meta_mensal: 4000, origem: "ia", comentario_gestor: "" },
      { familia: "DECOR STUDIO", meta_mensal: 1000, origem: "gestor", comentario_gestor: "ok" },
      { familia: "PRO LAMP", meta_mensal: null, origem: "gestor" },
    ]);
    expect(s).toEqual({ revisadas: 2, emMassa: 1 });
    expect(comentarioRevisado(MARCA_MINIMO_MASSA)).toBe("");
    expect(comentarioRevisado("ajuste")).toBe("ajuste");
  });

  it("vale a última versão de cada portfólio", () => {
    expect(
      statusRevisao([
        {
          familia: "PERFIL",
          meta_mensal: 3000,
          origem: "ia",
          comentario_gestor: MARCA_MINIMO_MASSA,
          vigente_desde: "2026-07-01",
        },
        {
          familia: "PERFIL",
          meta_mensal: 5000,
          origem: "gestor",
          comentario_gestor: "",
          vigente_desde: "2027-01-01",
        },
      ]),
    ).toEqual({ revisadas: 1, emMassa: 0 });
  });
});
