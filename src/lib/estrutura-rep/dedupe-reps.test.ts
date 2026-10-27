import { describe, expect, it } from "vitest";
import { dedupeRepresentatives } from "./dedupe-reps";

const r = (id: string, nome: string, representacao?: string) => ({ id, nome, representacao });

describe("dedupeRepresentatives", () => {
  it("unifica cadastro solto com o cadastro completo da mesma representação", () => {
    const out = dedupeRepresentatives([
      r("1", "MATHEUS", "NOVARE REPRESENTAÇÕES"),
      r("2", "NOVARE"),
      r("3", "D.K"),
      r("4", "DENILSON", "D.K. REPRESENTACOES S/C LTDA - ME"),
      r("5", "L M REP"),
      r("6", "MARIO", "L & M REPRESENTAÇÕES"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["1", "4", "6"]);
  });

  it("unifica cadastros com a mesma representação", () => {
    const out = dedupeRepresentatives([r("1", "A", "Apta Ltda"), r("2", "B", "APTA LTDA")]);
    expect(out).toHaveLength(1);
  });

  it("prefere o cadastro que já tem estrutura salva", () => {
    const out = dedupeRepresentatives(
      [r("1", "FELIPE", "KAFE LUZ E INOVACAO LTDA"), r("2", "KAFE LUZ")],
      new Set(["2"]),
    );
    expect(out.map((x) => x.id)).toEqual(["2"]);
  });

  it("mantém cadastros sem relação", () => {
    const out = dedupeRepresentatives([r("1", "ISABELA"), r("2", "MAFALDA")]);
    expect(out).toHaveLength(2);
  });
});
