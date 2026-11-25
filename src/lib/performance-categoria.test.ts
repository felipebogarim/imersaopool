import { describe, expect, it } from "vitest";
import {
  PISOS_CATEGORIA,
  categoriaCadastrada,
  categoriaPelaMedia,
  faixasRegua,
  posicaoNaRegua,
  rotuloMesesRestantes,
  situacaoCategoria,
} from "./performance-categoria";
import { acumuladoNoAno, mediaMensalCompras, type MediaCliente } from "./performance-media-cliente";

const media = (total: number | null, estimado = false): MediaCliente => ({
  total,
  portfolios: [],
  estimado,
  semDado: [],
});
const OUT = "2026-10-31";
const sit = (cat: string, m: number, fim: string | null = OUT) =>
  situacaoCategoria(cat, media(m), acumuladoNoAno(m, fim));

describe("classificação comercial independente de Metas Mínimas", () => {
  it("pisos mensais 3.000 / 6.000 / 20.000", () => {
    expect(PISOS_CATEGORIA).toEqual({ Silver: 3000, Gold: 6000, Black: 20000 });
  });
  it("categoria cadastrada normalizada", () => {
    expect(categoriaCadastrada("BLACK")).toBe("Black");
    expect(categoriaCadastrada(" Black ")).toBe("Black");
    expect(categoriaCadastrada("Cliente Gold")).toBe("Gold");
    expect(categoriaCadastrada("Consumidor Final")).toBeNull();
  });
  it("enquadramento pela média", () => {
    expect(categoriaPelaMedia(2999, PISOS_CATEGORIA)).toBeNull();
    expect(categoriaPelaMedia(6000, PISOS_CATEGORIA)).toBe("Gold");
    expect(categoriaPelaMedia(20000, PISOS_CATEGORIA)).toBe("Black");
  });
});

describe("régua por faixas alinhadas aos pisos", () => {
  it("cada faixa começa no piso da categoria", () => {
    expect(faixasRegua().map((f) => [f.categoria, f.de, f.inicio])).toEqual([
      [null, 0, 0],
      ["Silver", 3000, 25],
      ["Gold", 6000, 50],
      ["Black", 20000, 75],
    ]);
  });
  it("marcador proporcional dentro da faixa", () => {
    expect(posicaoNaRegua(null)).toBe(0);
    expect(posicaoNaRegua(3000)).toBe(25);
    expect(posicaoNaRegua(4500)).toBeCloseTo(37.5);
    expect(posicaoNaRegua(6000)).toBe(50);
    expect(posicaoNaRegua(13000)).toBeCloseTo(62.5);
    expect(posicaoNaRegua(20000)).toBe(75);
    expect(posicaoNaRegua(25000)).toBeCloseTo(87.5);
    expect(posicaoNaRegua(40000)).toBe(100);
  });
});

describe("fechamento anual (jan–out/2026)", () => {
  it.each([
    ["Luz LED", "Black", 9100, 149000, 74500],
    ["B. Castro", "Gold", 6500, 7000, 3500],
    ["Ilumine Home", "Gold", 3750, 34500, 17250],
    ["Solaro", "Gold", 7050, 1500, 750],
    ["Cattozatto", "Black", 22000, 20000, 10000],
    ["A&M", "Black", 29650, 0, 0],
  ])("%s", (_n, cat, m, total, mensal) => {
    const s = sit(cat, m);
    expect(s.manter?.totalNecessario).toBeCloseTo(total);
    expect(s.manter?.mediaNecessaria).toBeCloseTo(mensal);
    expect(s.rotuloRestantes).toBe("nov/dez");
  });

  it("cenários", () => {
    expect(sit("Black", 9100).estado).toBe("risco_queda");
    expect(sit("Gold", 3750).estado).toBe("risco_queda");
    expect(sit("Black", 22000).estado).toBe("mantida_ritmo");
    expect(sit("Gold", 6500).estado).toBe("mantida_ritmo");
    // acumulado estimado: não afirma garantia como fato
    expect(sit("Black", 29650).estado).toBe("garantida_estimada");
    const real = situacaoCategoria("Black", media(29650), {
      valor: 296500,
      meses: 10,
      ano: 2026,
      estimado: false,
    });
    expect(real.estado).toBe("garantida");
  });

  it("Black com média ≥ piso não tem risco de queda, mas vê o necessário até dezembro", () => {
    const s = sit("Black", 20000);
    expect(s.estado).toBe("mantida_ritmo");
    expect(s.manter?.totalNecessario).toBe(40000);
    expect(s.evoluir).toBeNull();
  });

  it("Silver/Gold: manutenção e evolução; oportunidade quando o ritmo alcança a superior", () => {
    const s = sit("Silver", 7000);
    expect(s.manter?.categoria).toBe("Silver");
    expect(s.evoluir?.categoria).toBe("Gold");
    expect(s.evoluir?.totalNecessario).toBe(2000);
    expect(s.oportunidadeEvolucao).toBe(true);
    expect(sit("Gold", 7050).oportunidadeEvolucao).toBe(false);
  });

  it("dezembro: sem meses restantes, sem divisão por zero", () => {
    const s = sit("Gold", 5000, "2026-12-31");
    expect(s.mesesRestantes).toBe(0);
    expect(s.manter?.totalNecessario).toBe(12000);
    expect(s.manter?.mediaNecessaria).toBeNull();
    expect(rotuloMesesRestantes(12)).toBe("");
    expect(rotuloMesesRestantes(7)).toBe("ago–dez");
  });

  it("sem base: não avalia; sem mês de referência: só a média mensal", () => {
    expect(situacaoCategoria("Black", mediaMensalCompras({})).estado).toBe("sem_base");
    const s = sit("Black", 25000, null);
    expect(s.estado).toBe("mantida_ritmo");
    expect(s.manter).toBeNull();
  });
});
