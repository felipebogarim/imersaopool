import { describe, expect, it } from "vitest";
import type { ComparisonRule } from "@/lib/price-comparativos-core";
import type { LoadedProduct } from "@/lib/price-comparativos-data";
import {
  ORIGIN_LABEL,
  RELATION_STATUS_LABEL,
  buildSuggestions,
  legacyStatusFor,
  mainSpecs,
} from "@/lib/price-equivalences-official";

function spec(key: string, value: string, numeric: number | null = null) {
  return {
    attribute_key: key,
    original_value: value,
    normalized_value: value,
    value_numeric: numeric,
    value_text: numeric == null ? value : null,
  };
}

function product(
  id: string,
  marca: string,
  sku: string,
  specs: Record<string, ReturnType<typeof spec>>,
) {
  return {
    id,
    marca,
    is_base: ["Studio", "Newline", "Standard"].includes(marca),
    familia: "Fitas e Fontes",
    categoria: "Fitas LED",
    tipo: null,
    sku,
    referencia: null,
    nome: `${marca} ${sku}`,
    product: {
      id,
      marca,
      nome: sku,
      sku,
      referencia: null,
      familia: "Fitas e Fontes",
      categoria: "Fitas LED",
      tipo: null,
      specs,
    },
  } as unknown as LoadedProduct;
}

const rules: ComparisonRule[] = [
  {
    attribute_key: "potencia_m",
    attribute_name: "Potência/m",
    weight: 50,
    tolerance_direct: 5,
    tolerance_approximate: 15,
    is_critical: false,
    is_eliminatory: false,
    missing_data_penalty: 0,
  },
  {
    attribute_key: "tensao",
    attribute_name: "Tensão",
    weight: 50,
    tolerance_direct: 0,
    tolerance_approximate: 0,
    is_critical: false,
    is_eliminatory: false,
    missing_data_penalty: 0,
  },
] as ComparisonRule[];

const names = { potencia_m: "Potência/m", tensao: "Tensão" };

describe("price-equivalences-official", () => {
  it("mapeia o status novo para o enum legado", () => {
    expect(legacyStatusFor("validada")).toBe("validado");
    expect(legacyStatusFor("rejeitada")).toBe("incompativel");
    expect(legacyStatusFor("sugestao_sistema")).toBe("em_analise");
    expect(legacyStatusFor("em_revisao")).toBe("em_analise");
  });

  it("expõe rótulos pt-BR para origens e status", () => {
    expect(ORIGIN_LABEL.comparables_validation).toBe("Validação de Comparáveis");
    expect(ORIGIN_LABEL.admin_manual).toBe("Validação manual do administrador");
    expect(RELATION_STATUS_LABEL.sem_equivalencia).toBe("Sem equivalência");
  });

  it("lista só características com valor, na ordem canônica", () => {
    const p = product("b", "Studio", "FT2307", {
      potencia_m: spec("potencia_m", "14,4", 14.4),
      tensao: spec("tensao", "24", 24),
    });
    expect(mainSpecs(p).map((s) => s.label)).toEqual(["Tensão", "Potência/m"]);
  });

  it("sugere por proximidade, ignora marca base e produtos incompatíveis", () => {
    const base = product("b", "Studio", "FT2307", {
      potencia_m: spec("potencia_m", "14,4", 14.4),
      tensao: spec("tensao", "24", 24),
    });
    const close = product("c1", "Stella", "STL21837/27", {
      potencia_m: spec("potencia_m", "14,4", 14.4),
      tensao: spec("tensao", "24", 24),
    });
    const sameGroup = product("g", "Newline", "NL1", {
      potencia_m: spec("potencia_m", "14,4", 14.4),
      tensao: spec("tensao", "24", 24),
    });
    const far = product("c2", "Stella", "STL21834/27", {
      potencia_m: spec("potencia_m", "40", 40),
      tensao: spec("tensao", "12", 12),
    });
    const out = buildSuggestions(base, [base, close, sameGroup, far], rules, names);
    expect(out.map((s) => s.product.id)).toEqual(["c1"]);
    expect(out[0].score).toBeGreaterThanOrEqual(90);
  });

  it("não sugere sem regras de comparação", () => {
    const base = product("b", "Studio", "FT2307", {});
    expect(buildSuggestions(base, [product("c", "Stella", "X", {})], [], names)).toEqual([]);
  });
});
