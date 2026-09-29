import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductRow } from "./price-comparativos-data";

const state = vi.hoisted(() => ({ rows: [] as ProductRow[] }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query = {
        field: "",
        pattern: "",
        select: () => query,
        eq: () => query,
        ilike: (field: string, pattern: string) => {
          query.field = field;
          query.pattern = pattern.replaceAll("%", "").toLowerCase();
          return query;
        },
        limit: async () => ({
          data: state.rows.filter((row) =>
            String(row[query.field as keyof ProductRow] ?? "")
              .toLowerCase()
              .includes(query.pattern),
          ),
          error: null,
        }),
      };
      return query;
    },
  },
}));

import { searchCatalogProductRows } from "./price-comparativos-data";

function stella(sku: string): ProductRow {
  return {
    id: sku,
    marca: "STELLA",
    is_base: false,
    familia: "Fitas e Fontes",
    categoria: "Fitas LED",
    tipo: null,
    sku,
    referencia: null,
    nome: `Fita ${sku}`,
    descricao: `Produto Stella ${sku}`,
    imagem_url: null,
    status: "ativo",
    source_file: "catalogo.xlsx",
    source_page: null,
    source_date: null,
    updated_at: "2026-09-29T00:00:00Z",
  };
}

describe("busca direta no catálogo da Validação", () => {
  beforeEach(() => {
    state.rows = [stella("STL21834/27"), stella("STL21836/27"), stella("STL21837/27")];
  });

  it.each(["STL21834", "STL21836", "STL21837"])(
    "localiza %s por parte do código e remove duplicatas entre campos",
    async (code) => {
      const found = await searchCatalogProductRows(code);
      expect(found).toHaveLength(1);
      expect(found[0].sku).toBe(`${code}/27`);
    },
  );
});
