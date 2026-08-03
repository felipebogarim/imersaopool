// Acesso a dados do módulo Price › Comparativos.
// Usa o cliente do navegador: as políticas de acesso do banco garantem que
// apenas administradores gravem. A interface apenas esconde os botões.

import { supabase } from "@/integrations/supabase/client";
import type {
  ComparisonRule,
  Confidence,
  EquivalenceLevel,
  EquivalenceStatus,
  PriceAvailability,
  ProductLike,
  SpecValue,
} from "./price-comparativos-core";
import { attributesFor } from "./price-comparativos-core";
import type { ParseResult, ParsedProduct } from "./price-comparativos-parser";

export type ProductRow = {
  id: string;
  marca: string;
  is_base: boolean;
  familia: string;
  categoria: string;
  tipo: string | null;
  sku: string | null;
  referencia: string | null;
  nome: string;
  descricao: string | null;
  imagem_url: string | null;
  status: string;
  source_file: string | null;
  source_page: number | null;
  source_date: string | null;
  updated_at: string;
};

export type EquivalenceRow = {
  id: string;
  base_product_id: string;
  compared_product_id: string;
  technical_score: number | null;
  price_score: number | null;
  cost_benefit_score: number | null;
  equivalence_level: EquivalenceLevel;
  status: EquivalenceStatus;
  technical_differences_json: string[];
  technical_similarities_json: string[];
  warnings_json: string[];
  validation_notes: string | null;
  validated_at: string | null;
  validated_by: string | null;
  incompatibility_reason: string | null;
  manually_edited: boolean;
  calculation_version: string;
  updated_at: string;
};

const PRODUCT_FIELDS =
  "id, marca, is_base, familia, categoria, tipo, sku, referencia, nome, descricao, imagem_url, status, source_file, source_page, source_date, updated_at";

// ============ Leitura ============

export async function fetchRules(familia: string, categoria: string): Promise<ComparisonRule[]> {
  const { data, error } = await supabase
    .from("price_comparison_rules")
    .select(
      "attribute_key, attribute_name, weight, tolerance_direct, tolerance_approximate, is_critical, is_eliminatory, missing_data_penalty",
    )
    .eq("familia", familia)
    .eq("categoria", categoria);
  if (error) throw error;
  return (data ?? []) as ComparisonRule[];
}

export async function fetchProducts(params: {
  familia?: string;
  categoria?: string;
  marca?: string;
  busca?: string;
  onlyBase?: boolean;
  limit?: number;
}): Promise<ProductRow[]> {
  let q = supabase
    .from("price_products")
    .select(PRODUCT_FIELDS)
    .eq("is_deleted", false)
    .order("marca")
    .order("nome")
    .limit(params.limit ?? 300);
  if (params.familia) q = q.eq("familia", params.familia);
  if (params.categoria) q = q.eq("categoria", params.categoria);
  if (params.marca) q = q.eq("marca", params.marca);
  if (params.onlyBase) q = q.eq("is_base", true);
  if (params.busca && params.busca.trim()) {
    const t = `%${params.busca.trim()}%`;
    q = q.or(
      `nome.ilike.${t},descricao.ilike.${t},sku.ilike.${t},referencia.ilike.${t},marca.ilike.${t}`,
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProductRow[];
}

export async function fetchMarcas(): Promise<string[]> {
  const { data, error } = await supabase
    .from("price_products")
    .select("marca, is_base")
    .eq("is_deleted", false);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => r.marca as string))).sort();
}

async function fetchSpecs(productIds: string[]): Promise<Record<string, Record<string, SpecValue>>> {
  if (!productIds.length) return {};
  const out: Record<string, Record<string, SpecValue>> = {};
  for (let i = 0; i < productIds.length; i += 200) {
    const chunk = productIds.slice(i, i + 200);
    const { data, error } = await supabase
      .from("price_product_specs")
      .select(
        "product_id, attribute_key, original_value, normalized_value, value_numeric, value_text, original_unit, normalized_unit, confidence_level",
      )
      .in("product_id", chunk);
    if (error) throw error;
    for (const r of data ?? []) {
      const pid = r.product_id as string;
      out[pid] = out[pid] ?? {};
      out[pid][r.attribute_key as string] = {
        attribute_key: r.attribute_key as string,
        original_value: r.original_value,
        normalized_value: r.normalized_value,
        value_numeric: r.value_numeric == null ? null : Number(r.value_numeric),
        value_text: r.value_text,
        original_unit: r.original_unit,
        normalized_unit: r.normalized_unit,
        confidence_level: r.confidence_level as Confidence,
      };
    }
  }
  return out;
}

export type PriceRow = {
  product_id: string;
  price: number | null;
  price_with_tax: number | null;
  price_without_tax: number | null;
  price_unit: string | null;
  price_per_meter: number | null;
  price_per_watt: number | null;
  price_per_1000_lumens: number | null;
  price_availability: PriceAvailability;
  state: string | null;
  region: string | null;
  effective_date: string | null;
  source_file: string | null;
  source_page: number | null;
  confidence_level: Confidence;
};

async function fetchPrices(productIds: string[]): Promise<Record<string, PriceRow>> {
  if (!productIds.length) return {};
  const out: Record<string, PriceRow> = {};
  for (let i = 0; i < productIds.length; i += 200) {
    const chunk = productIds.slice(i, i + 200);
    const { data, error } = await supabase
      .from("price_product_prices")
      .select(
        "product_id, price, price_with_tax, price_without_tax, price_unit, price_per_meter, price_per_watt, price_per_1000_lumens, price_availability, state, region, effective_date, source_file, source_page, confidence_level, status",
      )
      .in("product_id", chunk)
      .eq("status", "atual");
    if (error) throw error;
    for (const r of data ?? []) {
      out[r.product_id as string] = {
        product_id: r.product_id as string,
        price: r.price == null ? null : Number(r.price),
        price_with_tax: r.price_with_tax == null ? null : Number(r.price_with_tax),
        price_without_tax: r.price_without_tax == null ? null : Number(r.price_without_tax),
        price_unit: r.price_unit,
        price_per_meter: r.price_per_meter == null ? null : Number(r.price_per_meter),
        price_per_watt: r.price_per_watt == null ? null : Number(r.price_per_watt),
        price_per_1000_lumens:
          r.price_per_1000_lumens == null ? null : Number(r.price_per_1000_lumens),
        price_availability: (r.price_availability ?? "informado") as PriceAvailability,
        state: r.state,
        region: r.region,
        effective_date: r.effective_date,
        source_file: r.source_file,
        source_page: r.source_page,
        confidence_level: r.confidence_level as Confidence,
      };
    }
  }
  return out;
}

export type LoadedProduct = ProductRow & { product: ProductLike; priceRow: PriceRow | null };

export async function loadProducts(rows: ProductRow[]): Promise<LoadedProduct[]> {
  const ids = rows.map((r) => r.id);
  const [specs, prices] = await Promise.all([fetchSpecs(ids), fetchPrices(ids)]);
  return rows.map((r) => {
    const priceRow = prices[r.id] ?? null;
    return {
      ...r,
      priceRow,
      product: {
        id: r.id,
        marca: r.marca,
        nome: r.nome,
        sku: r.sku,
        referencia: r.referencia,
        familia: r.familia,
        categoria: r.categoria,
        tipo: r.tipo,
        specs: specs[r.id] ?? {},
        preco: priceRow?.price ?? null,
        precoDisponibilidade: priceRow?.price_availability ?? "nao_informado",
        precoPorMetro: priceRow?.price_per_meter ?? null,
        precoPorWatt: priceRow?.price_per_watt ?? null,
        precoPor1000lm: priceRow?.price_per_1000_lumens ?? null,
      },
    };
  });
}

export async function fetchEquivalences(baseProductId: string): Promise<EquivalenceRow[]> {
  const { data, error } = await supabase
    .from("price_equivalences")
    .select("*")
    .eq("base_product_id", baseProductId)
    .eq("is_deleted", false);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    technical_score: r.technical_score == null ? null : Number(r.technical_score),
    price_score: r.price_score == null ? null : Number(r.price_score),
    cost_benefit_score: r.cost_benefit_score == null ? null : Number(r.cost_benefit_score),
    technical_differences_json: (r.technical_differences_json ?? []) as string[],
    technical_similarities_json: (r.technical_similarities_json ?? []) as string[],
    warnings_json: (r.warnings_json ?? []) as string[],
  })) as EquivalenceRow[];
}

export async function fetchAuditLogs(equivalenceId: string) {
  const { data, error } = await supabase
    .from("price_audit_logs")
    .select("id, action, field_name, previous_value, new_value, change_reason, created_at, changed_by")
    .eq("equivalence_id", equivalenceId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

// ============ Importação ============

export type ImportConflictMode = "atualizar" | "ignorar" | "revisao";

export type ImportReport = {
  arquivos: number;
  linhasLidas: number;
  linhasIgnoradas: number;
  produtosCriados: number;
  produtosAtualizados: number;
  precosImportados: number;
  duplicidades: number;
  equivalenciasGeradas: number;
  dadosIncompletos: number;
  erros: string[];
  marcaBase: string;
  marcas: string[];
  importFileId: string | null;
};

function specRows(product: ParsedProduct, productId: string, categoria: string) {
  const attrs = attributesFor(categoria);
  return attrs
    .map((a) => product.specs[a.key])
    .filter((s): s is SpecValue => !!s)
    .map((s) => ({
      product_id: productId,
      attribute_key: s.attribute_key,
      attribute_name: attrs.find((a) => a.key === s.attribute_key)?.name ?? s.attribute_key,
      original_value: s.original_value,
      normalized_value: s.normalized_value,
      value_numeric: s.value_numeric,
      value_text: s.value_text,
      original_unit: s.original_unit,
      normalized_unit: s.normalized_unit,
      source_type: "planilha",
      extraction_method: "excel",
      confidence_level: "excel" as Confidence,
    }));
}

/** Importa o resultado do parser criando produtos, especificações e preços. */
export async function importParseResult(
  parsed: ParseResult,
  opts: {
    fileName: string;
    familia: string;
    categoria: string;
    conflito: ImportConflictMode;
    onProgress?: (pct: number, msg: string) => void;
  },
): Promise<ImportReport> {
  const report: ImportReport = {
    arquivos: 1,
    linhasLidas: parsed.linhas.length,
    linhasIgnoradas: parsed.ignoradas,
    produtosCriados: 0,
    produtosAtualizados: 0,
    precosImportados: 0,
    duplicidades: 0,
    equivalenciasGeradas: 0,
    dadosIncompletos: 0,
    erros: [],
    marcaBase: parsed.marcaBase,
    marcas: parsed.marcasConcorrentes,
    importFileId: null,
  };

  const { data: fileRow, error: fileErr } = await supabase
    .from("price_import_files")
    .insert({
      file_name: opts.fileName,
      file_type: "xlsx",
      document_type: "Planilha comparativa",
      processing_status: "processando",
      extraction_method: "excel",
    })
    .select("id")
    .single();
  if (fileErr) throw fileErr;
  report.importFileId = fileRow.id as string;

  // Produtos já existentes (para detectar duplicidade sem criar em silêncio)
  const existentes = await fetchProducts({
    familia: opts.familia,
    categoria: opts.categoria,
    limit: 5000,
  });
  const chave = (marca: string, sku: string | null, ref: string | null) =>
    `${marca.toUpperCase()}|${(sku ?? "").toUpperCase()}|${(ref ?? "").toUpperCase()}`;
  const mapa = new Map(existentes.map((p) => [chave(p.marca, p.sku, p.referencia), p.id]));

  const total = parsed.linhas.length || 1;
  let idx = 0;

  for (const linha of parsed.linhas) {
    idx += 1;
    if (idx % 5 === 0) {
      opts.onProgress?.(Math.round((idx / total) * 100), `Processando linha ${idx} de ${total}`);
    }
    try {
      const todos = [linha.base, ...linha.concorrentes];
      const ids: Record<number, string> = {};

      for (let i = 0; i < todos.length; i++) {
        const p = todos[i];
        const k = chave(p.marca, p.sku, p.referencia);
        const existente = mapa.get(k);

        if (existente) {
          report.duplicidades += 1;
          if (opts.conflito === "ignorar") {
            ids[i] = existente;
            continue;
          }
          if (opts.conflito === "revisao") {
            ids[i] = existente;
            await supabase.from("price_import_rows").insert({
              import_file_id: report.importFileId,
              sheet_name: parsed.sheetName,
              row_number: p.linha,
              field_name: "produto",
              original_value: `${p.marca} ${p.referencia ?? p.sku ?? ""}`.trim(),
              normalized_value: "duplicidade",
              confidence_level: "excel",
              review_status: "pendente",
              linked_product_id: existente,
            });
            continue;
          }
        }

        let productId = existente ?? null;
        if (productId) {
          const { error } = await supabase
            .from("price_products")
            .update({
              nome: p.nome,
              descricao: p.descricao,
              source_file: opts.fileName,
              source_date: new Date().toISOString().slice(0, 10),
            })
            .eq("id", productId);
          if (error) throw error;
          report.produtosAtualizados += 1;
        } else {
          const { data, error } = await supabase
            .from("price_products")
            .insert({
              marca: p.marca,
              is_base: p.isBase,
              familia: opts.familia,
              categoria: opts.categoria,
              sku: p.sku,
              referencia: p.referencia,
              nome: p.nome,
              descricao: p.descricao,
              source_file: opts.fileName,
              source_date: new Date().toISOString().slice(0, 10),
            })
            .select("id")
            .single();
          if (error) throw error;
          productId = data.id as string;
          mapa.set(k, productId);
          report.produtosCriados += 1;
        }
        ids[i] = productId;

        const specs = specRows(p, productId, opts.categoria);
        if (specs.length) {
          const { error } = await supabase
            .from("price_product_specs")
            .upsert(specs, { onConflict: "product_id,attribute_key" });
          if (error) throw error;
        }
        if (Object.keys(p.specs).length < attributesFor(opts.categoria).length / 2) {
          report.dadosIncompletos += 1;
        }

        if (p.preco != null) {
          const bobina = p.specs["bobina"]?.value_numeric ?? null;
          const potencia = p.specs["potencia_m"]?.value_numeric ?? null;
          const fluxo = p.specs["fluxo_m"]?.value_numeric ?? null;
          const porMetro = bobina && bobina > 0 ? p.preco / bobina : null;
          await supabase
            .from("price_product_prices")
            .update({ status: "historico" })
            .eq("product_id", productId)
            .eq("status", "atual");
          const { error } = await supabase.from("price_product_prices").insert({
            product_id: productId,
            price: p.preco,
            price_unit: bobina ? "bobina" : "unidade",
            price_per_meter: porMetro,
            price_per_watt: porMetro && potencia ? porMetro / potencia : null,
            price_per_1000_lumens: porMetro && fluxo ? (porMetro / fluxo) * 1000 : null,
            price_availability: "informado",
            effective_date: new Date().toISOString().slice(0, 10),
            source_file: opts.fileName,
            confidence_level: "tabela_precos",
            status: "atual",
          });
          if (error) throw error;
          report.precosImportados += 1;
        } else if (p.precoOriginal) {
          await supabase.from("price_product_prices").insert({
            product_id: productId,
            price_availability: /consulta/i.test(p.precoOriginal)
              ? "sob_consulta"
              : "nao_informado",
            source_file: opts.fileName,
            confidence_level: "tabela_precos",
            status: "atual",
          });
        }
      }

      // Equivalências: base × cada concorrente da mesma linha
      const baseId = ids[0];
      if (baseId) {
        for (let i = 1; i < todos.length; i++) {
          const compId = ids[i];
          if (!compId) continue;
          const p = todos[i];
          const { error } = await supabase.from("price_equivalences").upsert(
            {
              base_product_id: baseId,
              compared_product_id: compId,
              status: "em_analise",
              equivalence_level: "insuficiente",
              validation_notes: p.equivalenciaTexto,
              warnings_json: p.diferencasTexto ? [p.diferencasTexto] : [],
              calculation_version: "v1",
            },
            { onConflict: "base_product_id,compared_product_id", ignoreDuplicates: true },
          );
          if (!error) report.equivalenciasGeradas += 1;
        }
      }
    } catch (e) {
      report.erros.push(`Linha ${linha.linha}: ${(e as Error).message}`);
    }
  }

  await supabase
    .from("price_import_files")
    .update({
      processing_status: report.erros.length ? "erro" : "processado",
      processed_at: new Date().toISOString(),
      report_json: JSON.parse(JSON.stringify(report)),
    })
    .eq("id", report.importFileId);

  opts.onProgress?.(100, "Concluído");
  return report;
}
