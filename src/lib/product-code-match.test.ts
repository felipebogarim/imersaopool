import { describe, expect, it } from "vitest";
import { findExactCodeMatch } from "@/lib/product-code-match";

const results = [
  { id: "p1", sku: "STL21834/27", referencia: null },
  { id: "p2", sku: "STL21836/27", referencia: null },
  { id: "p3", sku: "STL21837/27", referencia: null },
  { id: "p4", sku: "STL21837/270", referencia: "REF-9" },
];

describe("findExactCodeMatch", () => {
  it.each(["STL21834/27", "STL21836/27", "STL21837/27"])("casa %s pelo id do produto", (code) => {
    expect(findExactCodeMatch(results, code)?.sku).toBe(code);
  });

  it("ignora caixa e espaços", () => {
    expect(findExactCodeMatch(results, "  stl21837/27 ")?.id).toBe("p3");
  });

  it("casa por referência", () => {
    expect(findExactCodeMatch(results, "ref-9")?.id).toBe("p4");
  });

  it("não seleciona com código parcial, vazio ou ambíguo", () => {
    expect(findExactCodeMatch(results, "STL21837")).toBeNull();
    expect(findExactCodeMatch(results, "")).toBeNull();
    expect(
      findExactCodeMatch(
        [...results, { id: "p5", sku: "STL21837/27", referencia: null }],
        "STL21837/27",
      ),
    ).toBeNull();
  });
});
