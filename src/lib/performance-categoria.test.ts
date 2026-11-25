import { describe, expect, it } from "vitest";
import {
  PISOS_CATEGORIA,
  categoriaCadastrada,
  categoriaPelaMedia,
  posicaoNaRegua,
  situacaoCategoria,
} from "./performance-categoria";
import { mediaMensalCompras, type MediaCliente } from "./performance-media-cliente";

const PISOS = { Silver: 3000, Gold: 6000, Black: 20000 };
const media = (total: number | null, estimado = false): MediaCliente => ({
  total,
  portfolios: [],
  estimado,
  semDado: [],
});

describe("classificação comercial independente de Metas Mínimas", () => {
  it("faixas fixas 3.000 / 6.000 / 20.000", () => {
    expect(PISOS_CATEGORIA).toEqual(PISOS);
  });
  it("usa a categoria cadastrada como vier no cadastro (caixa e espaços)", () => {
    expect(categoriaCadastrada("BLACK")).toBe("Black");
    expect(categoriaCadastrada(" Black ")).toBe("Black");
    expect(categoriaCadastrada("Cliente Gold")).toBe("Gold");
    expect(categoriaCadastrada("")).toBeNull();
    expect(categoriaCadastrada("Consumidor Final")).toBeNull();
  });
  it("situação sem pisos informados usa a classificação padrão", () => {
    expect(situacaoCategoria("BLACK", media(20000)).cadastrada).toBe("Black");
    expect(situacaoCategoria("BLACK", media(20000)).estado).not.toBe("risco_queda");
  });
});

describe("categoria pela média e régua por faixas", () => {
  it("enquadramento", () => {
    expect(categoriaPelaMedia(2999, PISOS)).toBeNull();
    expect(categoriaPelaMedia(3000, PISOS)).toBe("Silver");
    expect(categoriaPelaMedia(19999, PISOS)).toBe("Gold");
    expect(categoriaPelaMedia(20000, PISOS)).toBe("Black");
  });
  it("posição: cada faixa ocupa um terço", () => {
    expect(posicaoNaRegua(null, PISOS)).toBe(0);
    expect(posicaoNaRegua(1500, PISOS)).toBeCloseTo(16.65);
    expect(posicaoNaRegua(3000, PISOS)).toBeCloseTo(33.3);
    expect(posicaoNaRegua(6000, PISOS)).toBeCloseTo(66.6);
    expect(posicaoNaRegua(13000, PISOS)).toBeCloseTo(83.3);
    expect(posicaoNaRegua(25000, PISOS)).toBe(100);
  });
});

describe("situação", () => {
  it("Black com média ≥ 20.000 não tem risco de queda", () => {
    const s = situacaoCategoria("Black", media(20000), PISOS);
    expect(s.estado).not.toBe("risco_queda");
    expect(s.saldoManutencao).toBe(0);
    expect(situacaoCategoria("Black", media(26500), PISOS).estado).toBe("manutencao");
  });

  it("Gold com média > 20.000 → desempenho compatível com Black; categoria cadastrada preservada", () => {
    const s = situacaoCategoria("Gold", media(21000), PISOS);
    expect(s.estado).toBe("evolucao");
    expect(s.enquadrada).toBe("Black");
    expect(s.cadastrada).toBe("Gold");
    expect(s.pisoEnquadrada).toBe(20000);
  });

  it("Black abaixo de 20.000 → risco de queda com a distância mensal", () => {
    const s = situacaoCategoria("Black", media(17500), PISOS);
    expect(s.estado).toBe("risco_queda");
    expect(s.saldoManutencao).toBe(-2500);
    expect(s.enquadrada).toBe("Gold");
  });

  it("próximo de evoluir (≥ 85% do próximo piso) e pouca folga (< 10%)", () => {
    expect(situacaoCategoria("Gold", media(17500), PISOS).estado).toBe("proximo_evoluir");
    expect(situacaoCategoria("Gold", media(6300), PISOS).estado).toBe("atencao");
    expect(situacaoCategoria("Gold", media(9000), PISOS)).toMatchObject({
      estado: "manutencao",
      faltaProxima: 11000,
    });
  });

  it("sem base: não avalia (nunca trata como zero)", () => {
    const s = situacaoCategoria("Black", mediaMensalCompras({}), PISOS);
    expect(s.estado).toBe("sem_base");
    expect(s.saldoManutencao).toBeNull();
  });

  it("carrega a marca de estimado da média", () => {
    expect(situacaoCategoria("Black", media(25000, true), PISOS).estimado).toBe(true);
  });
});
