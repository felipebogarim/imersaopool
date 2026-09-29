import { supabase } from "@/integrations/supabase/client";
import { priceTableKey } from "@/lib/price-comparison-lookup";

// Uma tabela cadastrada em "Tabelas" (`price_tables`) se liga aos preços do catálogo só por
// identidade textual: `price_list_name` = título, ou (legado) `source_file` = nome do arquivo.
// Ao substituir o arquivo, religamos essas linhas ao novo título/arquivo e propagamos o novo nome
// aos estudos de comparação que guardam o nome da tabela.

export type ReplacedTable = {
  competitorName: string | null;
  oldTitle: string;
  oldFileName: string | null;
  newTitle: string;
  newFileName: string;
};

export type RelinkReport = {
  priceRows: number;
  groups: number;
  items: number;
  /** Nomes de tabela antigos encontrados (título e chaves legadas "arquivo — data"). */
  oldKeys: string[];
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function isTableRowOf(
  r: { price_list_name: string | null; source_file: string | null },
  oldTitle: string,
  oldFileName: string | null,
): boolean {
  if (norm(r.price_list_name)) return norm(r.price_list_name) === norm(oldTitle);
  return !!oldFileName && norm(r.source_file) === norm(oldFileName);
}

export async function relinkReplacedTable(t: ReplacedTable): Promise<RelinkReport> {
  const report: RelinkReport = { priceRows: 0, groups: 0, items: 0, oldKeys: [t.oldTitle] };
  if (!t.competitorName) return report;

  const { data: products } = await supabase
    .from("price_products")
    .select("id")
    .ilike("marca", t.competitorName);
  const productIds = (products ?? []).map((p) => p.id as string);
  if (productIds.length === 0) return report;

  const rows: {
    id: string;
    price_list_name: string | null;
    source_file: string | null;
    effective_date: string | null;
  }[] = [];
  for (let i = 0; i < productIds.length; i += 200) {
    const { data } = await supabase
      .from("price_product_prices")
      .select("id, price_list_name, source_file, effective_date")
      .in("product_id", productIds.slice(i, i + 200));
    rows.push(...(data ?? []));
  }
  const mine = rows.filter((r) => isTableRowOf(r, t.oldTitle, t.oldFileName));
  const keys = new Set([t.oldTitle, ...mine.map((r) => priceTableKey(r))]);
  report.oldKeys = [...keys];

  const today = new Date().toISOString().slice(0, 10);
  const ids = mine.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("price_product_prices")
      .update({
        price_list_name: t.newTitle,
        source_file: t.newFileName,
        effective_date: today,
      })
      .in("id", ids.slice(i, i + 200))
      .select("id");
    if (error) throw error;
    report.priceRows += data?.length ?? 0;
  }

  // Estudos de comparação que referenciam a tabela antiga pelo nome. Best-effort: o módulo pode
  // não estar migrado ainda, e escrita segue a RLS de cada tabela.
  const db = supabase as any;
  for (const key of report.oldKeys) {
    if (key === t.newTitle) continue;
    const g = await db
      .from("price_comparison_groups")
      .update({ base_price_table: t.newTitle })
      .eq("base_price_table", key)
      .select("id");
    report.groups += g.data?.length ?? 0;
    for (const col of ["competitor_a_price_table", "competitor_b_price_table"]) {
      const it = await db
        .from("price_comparison_group_items")
        .update({ [col]: t.newTitle })
        .eq(col, key)
        .select("id");
      report.items += it.data?.length ?? 0;
    }
  }
  return report;
}
