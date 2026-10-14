import { describe, it, expect, beforeEach } from "vitest";
import {
  getSharedBrandLibrary,
  saveBrandToLibrary,
  normalizeBrandKey,
  DEFAULT_BRAND_CATALOG,
} from "./brand-library";
import type { RepStructure } from "./types";

describe("brand-library", () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = {
      getItem: (k: string) => mockStore[k] || null,
      setItem: (k: string, v: string) => {
        mockStore[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStore[k];
      },
      clear: () => {
        mockStore = {};
      },
    };
  });

  it("normaliza nomes de marcas corretamente", () => {
    expect(normalizeBrandKey("Newline Iluminação")).toBe("newlineiluminacao");
    expect(normalizeBrandKey("  BRÍLIA  ")).toBe("brilia");
    expect(normalizeBrandKey("Mister-Led")).toBe("misterled");
  });

  it("retorna catálogo padrão inicial se nada estiver salvo", () => {
    const lib = getSharedBrandLibrary();
    expect(lib.length).toBeGreaterThanOrEqual(DEFAULT_BRAND_CATALOG.length);
    expect(lib.some((b) => b.nome.toLowerCase().includes("newline"))).toBe(true);
    expect(lib.some((b) => b.nome.toLowerCase().includes("brilia"))).toBe(true);
    expect(lib.some((b) => b.nome.toLowerCase().includes("mister led"))).toBe(true);
  });

  it("salva e recupera uma nova marca na biblioteca compartilhada", () => {
    saveBrandToLibrary(
      {
        id: "brand-test-1",
        nome: "Lustres Imperial",
        logo_url: "data:image/svg+xml;utf8,test",
        segmento: "Iluminação Decorativa Clássica",
        modelo_negocio: "fabricante",
        canais: ["varejo"],
        abrangencia: "Integral",
      },
      "Felipe Bogarim"
    );

    const lib = getSharedBrandLibrary();
    const found = lib.find((b) => b.nome === "Lustres Imperial");
    expect(found).toBeDefined();
    expect(found?.logo_url).toBe("data:image/svg+xml;utf8,test");
    expect(found?.origem).toContain("Felipe Bogarim");
  });

  it("agrega marcas cadastradas em outros representantes passados em allStructures", () => {
    const mockStructures: Record<string, RepStructure> = {
      "rep-1": {
        representative_id: "rep-1",
        nome_representante: "Representante A",
        modelo_atuacao: "individual",
        estados_atendidos: ["SP"],
        detalhes_municipais: {},
        modelo_escritorio: "escritorio_fisico",
        recursos_operacionais: {
          estrutura_administrativa: true,
          atendimento_comercial: true,
          suporte_clientes: true,
          apoio_tecnico: true,
          gestao_pedidos: true,
          pos_venda: true,
        },
        equipe: [],
        marcas_representadas: [
          {
            id: "m-1",
            nome: "Marca do Rep A",
            logo_url: "data:image/svg+xml;utf8,logoA",
            segmento: "Perfilados",
            modelo_negocio: "fabricante",
            canais: ["projetos"],
          },
        ],
      },
    };

    const lib = getSharedBrandLibrary(mockStructures);
    const found = lib.find((b) => b.nome === "Marca do Rep A");
    expect(found).toBeDefined();
    expect(found?.logo_url).toBe("data:image/svg+xml;utf8,logoA");
    expect(found?.origem).toContain("Representante A");
  });
});
