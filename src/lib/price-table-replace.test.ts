import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { isTableRowOf } from "./price-table-replace";

describe("isTableRowOf", () => {
  it("liga por price_list_name sem diferenciar caixa", () => {
    expect(isTableRowOf({ price_list_name: " Tabela A ", source_file: null }, "tabela a", null)).toBe(
      true,
    );
  });
  it("não liga quando o nome da lista é de outra tabela, mesmo com o mesmo arquivo", () => {
    expect(isTableRowOf({ price_list_name: "Outra", source_file: "a.xlsx" }, "Tabela A", "a.xlsx")).toBe(
      false,
    );
  });
  it("legado sem price_list_name liga pelo arquivo", () => {
    expect(isTableRowOf({ price_list_name: null, source_file: "A.xlsx" }, "T", "a.xlsx")).toBe(true);
    expect(isTableRowOf({ price_list_name: null, source_file: "b.xlsx" }, "T", "a.xlsx")).toBe(false);
  });
});
