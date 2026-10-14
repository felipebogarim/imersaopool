import { describe, it, expect } from "vitest";
import { normalizeText, processRepClients } from "./rep-clients";

describe("rep-clients", () => {
  it("normaliza textos removendo acentos e caixa alta", () => {
    expect(normalizeText("João da Silva")).toBe("joao da silva");
    expect(normalizeText("  BRÍLIA ILUMINAÇÃO  ")).toBe("brilia iluminacao");
    expect(normalizeText(null)).toBe("");
  });

  it("prioriza clientes vinculados à carteira do representante", () => {
    const rawClients = [
      {
        id: "c1",
        nome_fantasia: "Loja Alpha",
        cidade: "Salvador",
        estado: "BA",
        representative_id: "rep-99",
      },
      {
        id: "c2",
        nome_fantasia: "Ilustre Design",
        cidade: "Feira de Santana",
        estado: "BA",
        representative_id: "rep-123",
      },
      {
        id: "c3",
        nome_fantasia: "Zeta Iluminação",
        cidade: "Vitória da Conquista",
        estado: "BA",
        nome_representante_erp: "Carlos Rep",
      },
    ];

    const result = processRepClients(rawClients, "rep-123", "Carlos Rep");

    // c2 e c3 são da carteira
    expect(result[0].isRepClient).toBe(true);
    expect(result[1].isRepClient).toBe(true);
    expect(result[2].isRepClient).toBe(false);
    expect(result[2].nome_fantasia).toBe("Loja Alpha");
  });

  it("preenche fallback para razao_social se nome_fantasia for nulo", () => {
    const rawClients = [
      {
        id: "c1",
        nome_fantasia: null,
        razao_social: "Comércio de Materiais Elétricos Ltda",
        cidade: "Cuiabá",
        estado: "MT",
      },
    ];

    const result = processRepClients(rawClients);
    expect(result[0].nome_fantasia).toBe("Comércio de Materiais Elétricos Ltda");
  });

  it("mescla e prioriza clientes passados pela estrutura sem duplicidade", () => {
    const rawClients = [
      {
        id: "c1",
        nome_fantasia: "Ilustre Iluminação",
        cidade: "Salvador",
        estado: "BA",
      },
      {
        id: "c2",
        nome_fantasia: "Cliente Geral",
        cidade: "São Paulo",
        estado: "SP",
      },
    ];

    const extraClients = [
      { nome: "Ilustre Iluminação", cidade: "Salvador", estado: "BA" },
      { nome: "Luz & Arte Conceito", cidade: "Feira de Santana", estado: "BA" },
    ];

    const result = processRepClients(rawClients, "rep-1", "Felipe", extraClients);

    expect(result).toHaveLength(3);
    // Ilustre Iluminação e Luz & Arte Conceito estão na carteira
    expect(result[0].isRepClient).toBe(true);
    expect(result[1].isRepClient).toBe(true);
    // Cliente Geral não é da carteira e fica no final
    expect(result[2].nome_fantasia).toBe("Cliente Geral");
    expect(result[2].isRepClient).toBe(false);
  });
});
