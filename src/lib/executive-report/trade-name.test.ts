import { describe, expect, it } from "vitest";
import { extractTradeName } from "./trade-name";

describe("extractTradeName", () => {
  it("prioriza nome fantasia explícito quando informado", () => {
    const res = extractTradeName({
      explicitTradeName: "Arquiluz Salvador",
      razaoSocial: "CLARA ILUMINACAO LTDA",
    });
    expect(res).toBe("Arquiluz Salvador");
  });

  it("extrai Arquiluz para Clara a partir da leitura executiva com citação a ARQLUZ", () => {
    const reading =
      "A ARQLUZ é maior faturamento da região e junto com Omni compõe o top 2 de lojas de alto padrão de Salvador.";
    const res = extractTradeName({
      razaoSocial: "CLARA ILUMINACAO LTDA",
      textSources: [reading],
    });
    expect(res).toBe("Arquiluz");
  });

  it("extrai Arquiluz a partir de citação nas transcrições estruturadas", () => {
    const structuredData = {
      data: {
        quotes: [
          {
            text: "Vamos tentar pensar em um plano de fita e fonte para Arqluz.",
            original_author: "Marilda",
            original_author_role: "sócia",
          },
        ],
      },
    };
    const res = extractTradeName({
      razaoSocial: "CLARA ILUMINACAO LTDA",
      structuredData,
    });
    expect(res).toBe("Arquiluz");
  });

  it("extrai Arquiluz mesmo quando apenas 'Clara' é informado como razão social", () => {
    const res = extractTradeName({
      razaoSocial: "Clara",
      textSources: ["Entrevista com os sócios da Arqluz."],
    });
    expect(res).toBe("Arquiluz");
  });

  it("usa fallback de dbTradeName quando presente e diferente da razão social", () => {
    const res = extractTradeName({
      razaoSocial: "ILUMINAR COMERCIO LTDA",
      dbTradeName: "Iluminar Gallery",
      textSources: [],
    });
    expect(res).toBe("Iluminar Gallery");
  });

  it("retorna null se não houver nome fantasia nem menção identificável", () => {
    const res = extractTradeName({
      razaoSocial: "LOJA TESTE LTDA",
      dbTradeName: "LOJA TESTE LTDA",
      textSources: ["Texto genérico sem menção a nomes"],
    });
    expect(res).toBeNull();
  });
});
