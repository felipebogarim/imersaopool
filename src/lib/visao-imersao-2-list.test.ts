import { describe, expect, it } from "vitest";
import { EMPTY_LIST_FILTERS, matchesListFilters, reportListMeta } from "./visao-imersao-2-list";

const reps = [{ nome: "MATHEUS", representacao: "NOVARE REPRESENTAÇÕES", regiao: "PR / SC" }];
const clients = new Map([["c1", { id: "c1", categoria: "Gold", representatives: null }]]);
const report = (client: any, resolved?: string) => ({
  client_name: "ILUMINARE",
  structured_data: { resolved_client_id: resolved, data: { client } },
});

describe("reportListMeta", () => {
  it("casa o representante informado e traz região e categoria do cliente", () => {
    const m = reportListMeta(report({ representative: "NOVARE", location: "Curitiba, PR" }, "c1"), clients, reps);
    expect(m).toEqual({ representante: "MATHEUS", regiao: "PR / SC", categoria: "Gold" });
  });

  it("usa a localização do relatório quando não há representante cadastrado", () => {
    const m = reportListMeta(report({ location: "Curitiba, PR" }), clients, reps);
    expect(m).toEqual({ representante: "", regiao: "Curitiba, PR", categoria: "" });
  });
});

describe("matchesListFilters", () => {
  const meta = { representante: "MATHEUS", regiao: "PR / SC", categoria: "Gold" };
  const r = { client_name: "ILUMINARE", content_markdown: "Cliente com foco em projetos" };
  it("filtra por campos e busca sem acento/caixa", () => {
    expect(matchesListFilters(r, meta, { ...EMPTY_LIST_FILTERS, categoria: "Gold" })).toBe(true);
    expect(matchesListFilters(r, meta, { ...EMPTY_LIST_FILTERS, categoria: "Black" })).toBe(false);
    expect(matchesListFilters(r, meta, { ...EMPTY_LIST_FILTERS, busca: "ILUMINÁRE projetos" })).toBe(true);
    expect(matchesListFilters(r, meta, { ...EMPTY_LIST_FILTERS, busca: "iluminare inexistente" })).toBe(false);
    expect(matchesListFilters(r, meta, { ...EMPTY_LIST_FILTERS, busca: "iluminare PROJETOS" })).toBe(true);
  });

  it("filtra por período da data da visita (inclusivo)", () => {
    const d = { ...r, visit_date: "2026-10-22" };
    expect(matchesListFilters(d, meta, { ...EMPTY_LIST_FILTERS, dataDe: "2026-10-22", dataAte: "2026-10-22" })).toBe(true);
    expect(matchesListFilters(d, meta, { ...EMPTY_LIST_FILTERS, dataDe: "2026-10-23" })).toBe(false);
    expect(matchesListFilters(d, meta, { ...EMPTY_LIST_FILTERS, dataAte: "2026-10-21" })).toBe(false);
    expect(matchesListFilters(r, meta, { ...EMPTY_LIST_FILTERS, dataDe: "2026-01-01" })).toBe(false);
  });
});
