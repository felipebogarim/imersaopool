import { describe, it, expect } from "vitest";
import { mergeTop10, normalizeText, processRepClients } from "./rep-clients";

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

  it("retorna lista ordenada do top 10 com fetchTopPerformanceClients e fallback de frequencia", async () => {
    const { fetchTopPerformanceClients } = await import("./rep-clients");
    const mockFrequencia = [
      { posicao: 1, cliente_nome: "Cliente Um", cidade: "Salvador", uf: "BA", frequencia_dias: 30 },
      {
        posicao: 2,
        cliente_nome: "Cliente Dois",
        cidade: "Feira de Santana",
        uf: "BA",
        frequencia_dias: 40,
      },
    ];

    const result = await fetchTopPerformanceClients(
      "rep-test",
      "Representante Teste",
      mockFrequencia,
    );
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].posicao).toBe(1);
    expect(result[0].cliente_nome).toBe("Cliente Um");
    expect(result[1].posicao).toBe(2);
    expect(result[1].cliente_nome).toBe("Cliente Dois");
  });
});

describe("mergeTop10", () => {
  const perf = Array.from({ length: 10 }, (_, i) => ({
    posicao: i + 1,
    cliente_nome: `Cliente ${i + 1}`,
  }));

  it("completa o Top 10 com a performance quando só há um cliente salvo", () => {
    const saved = [{ id: "s1", posicao: 1, cliente_nome: "cliente 3", frequencia_dias: 7 }];
    const out = mergeTop10(saved, perf, 60);
    expect(out).toHaveLength(10);
    const c3 = out.find((i) => i.cliente_nome === "cliente 3")!;
    expect(c3.id).toBe("s1");
    expect(c3.frequencia_dias).toBe(7);
    expect(c3.posicao).toBe(3);
    expect(out.find((i) => i.cliente_nome === "Cliente 1")!.frequencia_dias).toBe(60);
  });

  it("preserva cliente manual fora do ranking e mantém no máximo 10", () => {
    const saved = [{ id: "m", posicao: 1, cliente_nome: "Manual", frequencia_dias: 15 }];
    const out = mergeTop10(saved, perf, 60);
    expect(out).toHaveLength(10);
    expect(out.some((i) => i.id === "m")).toBe(true);
    expect(new Set(out.map((i) => i.posicao)).size).toBe(10);
  });
});
