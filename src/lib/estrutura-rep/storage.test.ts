import { describe, it, expect } from "vitest";
import {
  buildDefaultStructure,
  getLocalKey,
} from "./storage";

describe("estrutura-rep storage and defaults", () => {
  it("gera chave de storage adequada", () => {
    expect(getLocalKey("rep-123")).toBe("estrutura_rep_rep-123");
  });

  it("cria estrutura padrão rica inferindo estados de Centro-Oeste (MT, GO, DF)", () => {
    const rep = {
      id: "rep-anselmo",
      nome: "ANSELMO",
      representacao: "Anselmo Representações",
      regiao: "MT, GO e DF",
      outras_marcas: "Stella, Brilha, Pampa",
    };

    const structure = buildDefaultStructure(rep);

    expect(structure.representative_id).toBe("rep-anselmo");
    expect(structure.nome_representante).toBe("ANSELMO");
    expect(structure.empresa_representacao).toBe("Anselmo Representações");

    // Estados atendidos devem incluir MT, GO, DF sem áreas contínuas artificiais
    expect(structure.estados_atendidos).toContain("MT");
    expect(structure.estados_atendidos).toContain("GO");
    expect(structure.estados_atendidos).toContain("DF");

    // Marcas no portfólio
    expect(structure.marcas_representadas.length).toBeGreaterThanOrEqual(2);
    expect(structure.marcas_representadas[0].nome).toContain("Newline");
    expect(structure.marcas_representadas.some((m) => m.nome.includes("Stella"))).toBe(true);

    // Estrutura física e recursos
    expect(structure.modelo_escritorio).toBe("escritorio_fisico");
    expect(structure.recursos_operacionais.atendimento_comercial).toBe(true);
    expect(structure.recursos_operacionais.gestao_pedidos).toBe(true);
    expect(structure.recursos_operacionais.pos_venda).toBe(true);

    // Equipe e mini organograma
    expect(structure.equipe.length).toBeGreaterThanOrEqual(2);
    const titular = structure.equipe.find((m) => m.nivel === "titular");
    expect(titular).toBeDefined();
    expect(titular?.nome).toBe("ANSELMO");
  });

  it("trata representantes sem região explícita com fallback seguro", () => {
    const rep = {
      id: "rep-novo",
      nome: "Novo Representante",
      representacao: null,
      regiao: null,
      outras_marcas: null,
    };

    const structure = buildDefaultStructure(rep);
    expect(structure.estados_atendidos.length).toBeGreaterThan(0);
    expect(structure.marcas_representadas.length).toBeGreaterThanOrEqual(1);
    expect(structure.equipe.length).toBeGreaterThanOrEqual(1);
  });
});
