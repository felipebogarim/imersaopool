import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { normalizeText, parseNumeric } from "@/lib/price-comparativos-core";

// Importação de preços de uma tabela oficial (price_tables). Todo preço criado/atualizado aqui
// recebe price_table_id = id da tabela aberta: única associação confiável preço → tabela.
// Chave lógica do preço: product_id + price_table_id (reimportar atualiza, nunca duplica).

export type TablePriceRow = {
  linha: number;
  codigo: string;
  price: number | null;
  pricePerMeter: number | null;
  priceUnit: string | null;
  descricao: string | null;
};

export type TablePriceParse = { rows: TablePriceRow[]; avisos: string[] };

const HEADERS = {
  codigo: ["codigo", "cod", "sku", "referencia", "ref", "codigo produto", "codigo do produto"],
  price: ["preco", "valor", "preco tabela", "preco unitario", "preco r$", "r$", "price"],
  perMeter: ["preco por metro", "preco metro", "preco/m", "r$/m", "valor por metro", "preco m"],
  unit: ["unidade", "un", "und", "unid", "unidade preco"],
  descricao: ["descricao", "produto", "nome", "descricao do produto"],
};

const norm = (v: unknown) => normalizeText(v).toLowerCase();

function findCol(header: string[], names: string[]): number {
  return header.findIndex((h) => names.includes(h));
}

/** Lê uma planilha (xlsx/csv) com cabeçalho: código + preço (obrigatórios), preço/m, unidade, descrição. */
export function parseTablePriceSheet(sheet: unknown[][]): TablePriceParse {
  const avisos: string[] = [];
  let headerIdx = -1;
  let cols = { codigo: -1, price: -1, perMeter: -1, unit: -1, descricao: -1 };
  for (let i = 0; i < Math.min(sheet.length, 15); i++) {
    const header = (sheet[i] ?? []).map(norm);
    const found = {
      codigo: findCol(header, HEADERS.codigo),
      price: findCol(header, HEADERS.price),
      perMeter: findCol(header, HEADERS.perMeter),
      unit: findCol(header, HEADERS.unit),
      descricao: findCol(header, HEADERS.descricao),
    };
    if (found.codigo >= 0 && (found.price >= 0 || found.perMeter >= 0)) {
      headerIdx = i;
      cols = found;
      break;
    }
  }
  if (headerIdx < 0) {
    return {
      rows: [],
      avisos: ["Cabeçalho não reconhecido: a planilha precisa das colunas Código e Preço."],
    };
  }
  const rows: TablePriceRow[] = [];
  for (let i = headerIdx + 1; i < sheet.length; i++) {
    const r = sheet[i] ?? [];
    const codigo = String(r[cols.codigo] ?? "").trim();
    if (!codigo) continue;
    const text = (idx: number) =>
      idx >= 0 && r[idx] != null ? String(r[idx]).trim() || null : null;
    rows.push({
      linha: i + 1,
      codigo,
      price: cols.price >= 0 ? parseNumeric(r[cols.price]) : null,
      pricePerMeter: cols.perMeter >= 0 ? parseNumeric(r[cols.perMeter]) : null,
      priceUnit: text(cols.unit),
      descricao: text(cols.descricao),
    });
  }
  return { rows, avisos };
}

export function parseTablePriceFile(buffer: ArrayBuffer): TablePriceParse {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows: [], avisos: ["Planilha vazia."] };
  return parseTablePriceSheet(
    XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null }),
  );
}

export type ImportProduct = { id: string; sku: string | null; referencia: string | null };
export type ExistingTablePrice = { id: string; product_id: string };

export type TablePriceAction =
  | { kind: "create"; row: TablePriceRow; productId: string; priceId?: undefined }
  | { kind: "update"; row: TablePriceRow; productId: string; priceId: string }
  | { kind: "create-product"; row: TablePriceRow }
  | { kind: "not-found"; row: TablePriceRow }
  | { kind: "error"; row: TablePriceRow; message: string };

/** Planejamento puro: decide o que fazer com cada linha sem tocar no banco. */
export function planTablePriceImport(
  rows: TablePriceRow[],
  products: ImportProduct[],
  existing: ExistingTablePrice[],
  createMissing: boolean,
): TablePriceAction[] {
  const byCode = new Map<string, ImportProduct>();
  for (const p of products) {
    for (const c of [p.sku, p.referencia]) if (c) byCode.set(norm(c), p);
  }
  const priceByProduct = new Map(existing.map((e) => [e.product_id, e.id]));
  const seen = new Set<string>();
  return rows.map((row): TablePriceAction => {
    if (row.price == null && row.pricePerMeter == null) {
      return { kind: "error", row, message: "Preço ausente ou inválido" };
    }
    const key = norm(row.codigo);
    if (seen.has(key)) return { kind: "error", row, message: "Código duplicado na planilha" };
    seen.add(key);
    const product = byCode.get(key);
    if (!product)
      return createMissing ? { kind: "create-product", row } : { kind: "not-found", row };
    const priceId = priceByProduct.get(product.id);
    return priceId
      ? { kind: "update", row, productId: product.id, priceId }
      : { kind: "create", row, productId: product.id };
  });
}

export type TableForImport = {
  id: string;
  titulo: string;
  competitor_id: string;
  competitorName: string;
  data_referencia: string;
  file_name: string | null;
};

export type TablePriceImportReport = {
  linhasLidas: number;
  precosCriados: number;
  precosAtualizados: number;
  produtosCriados: number;
  naoEncontrados: string[];
  erros: string[];
};

const CHUNK = 200;

async function fetchBrandProducts(competitorName: string): Promise<ImportProduct[]> {
  const out: ImportProduct[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("price_products")
      .select("id, sku, referencia")
      .eq("is_deleted", false)
      .ilike("marca", competitorName)
      .range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function fetchTablePrices(
  tableId: string,
  productIds: string[],
): Promise<ExistingTablePrice[]> {
  const out: ExistingTablePrice[] = [];
  for (let i = 0; i < productIds.length; i += CHUNK) {
    const { data, error } = await supabase
      .from("price_product_prices")
      .select("id, product_id")
      .eq("price_table_id", tableId)
      .in("product_id", productIds.slice(i, i + CHUNK));
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

export async function importTablePrices(
  table: TableForImport,
  rows: TablePriceRow[],
  opts: {
    createMissing: boolean;
    familia?: string;
    categoria?: string;
    fileName?: string | null;
  },
): Promise<TablePriceImportReport> {
  const report: TablePriceImportReport = {
    linhasLidas: rows.length,
    precosCriados: 0,
    precosAtualizados: 0,
    produtosCriados: 0,
    naoEncontrados: [],
    erros: [],
  };
  const products = await fetchBrandProducts(table.competitorName);
  const existing = await fetchTablePrices(
    table.id,
    products.map((p) => p.id),
  );
  const plan = planTablePriceImport(rows, products, existing, opts.createMissing);
  const sourceFile = table.file_name ?? opts.fileName ?? null;
  const priceFields = (row: TablePriceRow) => ({
    price: row.price,
    price_per_meter: row.pricePerMeter,
    price_unit: row.priceUnit,
    price_availability: "informado",
    price_list_name: table.titulo,
    price_table_id: table.id,
    effective_date: table.data_referencia,
    source_file: sourceFile,
    confidence_level: "tabela_precos" as const,
    status: "atual",
  });

  for (const action of plan) {
    const where = `Linha ${action.row.linha} (${action.row.codigo})`;
    try {
      if (action.kind === "error") {
        report.erros.push(`${where}: ${action.message}`);
      } else if (action.kind === "not-found") {
        report.naoEncontrados.push(action.row.codigo);
      } else if (action.kind === "update") {
        const { error } = await supabase
          .from("price_product_prices")
          .update(priceFields(action.row))
          .eq("id", action.priceId)
          .eq("price_table_id", table.id);
        if (error) throw error;
        report.precosAtualizados += 1;
      } else {
        let productId = action.kind === "create" ? action.productId : "";
        if (action.kind === "create-product") {
          const { data, error } = await supabase
            .from("price_products")
            .insert({
              marca: table.competitorName,
              competitor_id: table.competitor_id,
              is_base: false,
              familia: opts.familia ?? "Fitas e Fontes",
              categoria: opts.categoria ?? "Fitas LED",
              sku: action.row.codigo,
              nome: action.row.descricao ?? action.row.codigo,
              descricao: action.row.descricao,
              source_file: sourceFile,
              source_date: table.data_referencia,
            })
            .select("id")
            .single();
          if (error) throw error;
          productId = data.id as string;
          report.produtosCriados += 1;
        }
        const { error } = await supabase
          .from("price_product_prices")
          .insert({ product_id: productId, ...priceFields(action.row) });
        if (error) throw error;
        report.precosCriados += 1;
      }
    } catch (e) {
      report.erros.push(`${where}: ${(e as { message?: string })?.message ?? String(e)}`);
    }
  }
  return report;
}
