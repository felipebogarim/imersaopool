import { describe, expect, it } from "vitest";
import { abaixoDoMinimo, minimoPara } from "./performance-metas-minimos";

const minimos = [
  { categoria: "Black", familia: "PERFIL", minimo: 5000 },
  { categoria: "Gold", familia: "PERFIL", minimo: 2000 },
];

describe("mínimos por categoria", () => {
  it("busca o mínimo sem diferenciar maiúsculas", () => {
    expect(minimoPara(minimos, "black", "PERFIL")).toBe(5000);
    expect(minimoPara(minimos, " Gold ", "PERFIL")).toBe(2000);
    expect(minimoPara(minimos, "Silver", "PERFIL")).toBeNull();
    expect(minimoPara(minimos, null, "PERFIL")).toBeNull();
    expect(minimoPara(undefined, "Black", "PERFIL")).toBeNull();
  });

  it("lista portfólios abaixo do mínimo; vazio e igual ao mínimo passam", () => {
    const drafts = [
      { familia: "PERFIL", metaOficial: 4000 },
      { familia: "PRO LED", metaOficial: 10 },
    ];
    expect(abaixoDoMinimo(drafts, minimos, "Black")).toEqual([
      { familia: "PERFIL", meta: 4000, minimo: 5000 },
    ]);
    expect(abaixoDoMinimo([{ familia: "PERFIL", metaOficial: 5000 }], minimos, "Black")).toEqual(
      [],
    );
    expect(abaixoDoMinimo([{ familia: "PERFIL", metaOficial: null }], minimos, "Black")).toEqual(
      [],
    );
  });
});
