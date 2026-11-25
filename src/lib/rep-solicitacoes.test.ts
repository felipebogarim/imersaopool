import { describe, expect, it } from "vitest";
import { limparItens, solicitacaoEmAberto, validarSolicitacao } from "./rep-solicitacoes";

describe("solicitações de apoio", () => {
  it("limpa itens vazios e quantidades inválidas", () => {
    expect(
      limparItens([
        { item: " Banner ", quantidade: "2" },
        { item: "", quantidade: 3 },
        { item: "Catálogo", quantidade: 0 },
        { item: "Brinde", quantidade: "2.7" },
      ]),
    ).toEqual([
      { item: "Banner", quantidade: 2 },
      { item: "Brinde", quantidade: 2 },
    ]);
  });

  it("valida por tipo", () => {
    const base = { titulo: "Café com arquitetos", itens: [{ item: "Banner", quantidade: 1 }] };
    expect(validarSolicitacao({ ...base, tipo: "material_evento" })).toMatch(/data do evento/);
    expect(
      validarSolicitacao({ ...base, tipo: "material_evento", data_evento: "2026-12-10" }),
    ).toBeNull();
    expect(
      validarSolicitacao({ ...base, tipo: "acao_trade", itens: [], data_evento: "2026-12-10" }),
    ).toMatch(/tipo de ação/);
    expect(
      validarSolicitacao({
        ...base,
        tipo: "acao_trade",
        itens: [],
        data_evento: "2026-12-10",
        acao_trade_tipo: "Workshop técnico",
      }),
    ).toBeNull();
    expect(validarSolicitacao({ ...base, tipo: "amostras", itens: [] })).toMatch(
      /ao menos um item/,
    );
    expect(
      validarSolicitacao({
        ...base,
        tipo: "material_evento",
        data_evento: "2026-12-10",
        data_necessaria: "2026-12-12",
      }),
    ).toMatch(/até a data do evento/);
    expect(validarSolicitacao({ ...base, titulo: "ab", tipo: "amostras" })).toMatch(/título/);
  });

  it("em aberto = enviada ou em análise", () => {
    expect(solicitacaoEmAberto("pendente")).toBe(true);
    expect(solicitacaoEmAberto("em_analise")).toBe(true);
    expect(solicitacaoEmAberto("aprovada")).toBe(false);
  });
});
