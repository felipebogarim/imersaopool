import { describe, expect, it } from "vitest";
import { buildHome2Sections, isHome2User } from "./home2";

describe("home2", () => {
  it("reconhece apenas o Marcos", () => {
    expect(isHome2User("Marcos@newline.ind.br")).toBe(true);
    expect(isHome2User("sergio@newline.ind.br")).toBe(false);
    expect(isHome2User(null)).toBe(false);
  });

  it("lista só os setores e itens liberados, sem home e admin", () => {
    const allowed = new Set(["home", "performance.reps", "mapa-acoes", "admin.usuarios"]);
    const out = buildHome2Sections((k) => allowed.has(k));
    expect(out.map((s) => s.key)).toEqual(["performance", "mapa-acoes"]);
    expect(out[0].links.map((l) => l.key)).toEqual(["performance.reps"]);
    expect(out[1].links[0].to).toBe("/mapa-acoes");
  });

  it("não devolve setores sem acesso", () => {
    expect(buildHome2Sections(() => false)).toEqual([]);
  });
});
