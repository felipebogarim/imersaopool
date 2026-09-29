// Um lado da comparação (produto base ou concorrente), em coluna:
// marca → tabela → produto (autocomplete) → preço automático (somente leitura) → resumo técnico.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductCombobox, productCode } from "./ProductCombobox";
import type { LoadedProduct } from "@/lib/price-comparativos-data";
import { PRICE_NOT_COMPARABLE_LABEL, formatBRL } from "@/lib/price-comparativos-core";
import { getFamilyConfig } from "@/lib/price-mapa/family-config";
import { top6For } from "@/lib/price-comparison-groups-attributes";
import {
  fetchBrandPriceTables,
  fetchProductPriceRows,
  pickPriceRow,
  tablesFromPriceRows,
  tablesForComparisonSide,
  resolveTableKey,
  type PriceTableOption,
  type ProductPriceRow,
} from "@/lib/price-comparison-lookup";

export type SideSelection = {
  brand: string;
  product: LoadedProduct | null;
  /** Tabela escolhida pelo usuário (a efetiva pode ser a única disponível). */
  table: string | null;
};

export const EMPTY_SIDE: SideSelection = { brand: "", product: null, table: null };

export type ResolvedSide = {
  /** Tabelas de preço cadastradas para a marca. */
  tables: PriceTableOption[];
  table: string | null;
  priceRow: ProductPriceRow | null;
  /** Preço comparável (R$/m quando aplicável); null quando não há preço cadastrado — nunca 0. */
  price: number | null;
  /** Preço original do registro (ex.: bobina), como metadado. */
  originalPrice: number | null;
  originalUnit: string | null;
  comparableUnit: string | null;
  loading: boolean;
};

/**
 * Deriva tabela e preço a partir de `price_product_prices`; recalcula ao mudar marca, tabela
 * ou produto. `fixedTable` (lado base) força a tabela definida nos filtros do estudo.
 */
export function useResolvedSide(
  sel: SideSelection,
  familia: string,
  fixedTable?: string | null,
): ResolvedSide {
  const productId = sel.product?.id ?? null;
  const useBrandTables = fixedTable !== undefined;
  const tablesQ = useQuery({
    queryKey: ["price-comparison-brand-tables", sel.brand, familia],
    queryFn: () => fetchBrandPriceTables(sel.brand, familia),
    enabled: !!sel.brand && useBrandTables,
  });
  const rowsQ = useQuery({
    queryKey: ["price-comparison-product-prices", productId],
    queryFn: () => fetchProductPriceRows(productId as string),
    enabled: !!productId,
  });
  return useMemo(() => {
    const rows = rowsQ.data ?? [];
    const productTables = tablesFromPriceRows(rows);
    const tables = tablesForComparisonSide({
      productSelected: productId != null,
      productTables,
      brandTables: tablesQ.data ?? [],
      useBrandTables,
    });
    const table = resolveTableKey(tables, sel.table ?? fixedTable);
    const picked = pickPriceRow(rows, table, getFamilyConfig(familia).unidade);
    return {
      tables,
      table,
      priceRow: picked.row,
      price: picked.price,
      originalPrice: picked.originalPrice,
      originalUnit: picked.originalUnit,
      comparableUnit: picked.comparableUnit,
      loading: !!productId && (rowsQ.isLoading || (useBrandTables && tablesQ.isLoading)),
    };
  }, [
    tablesQ.data,
    tablesQ.isLoading,
    rowsQ.data,
    rowsQ.isLoading,
    productId,
    useBrandTables,
    fixedTable,
    sel.table,
    familia,
  ]);
}

function monthYear(d: string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR", {
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

const NOT_IDENTIFIED = "Não identificado";

function specText(product: LoadedProduct, key: string, unit?: string): string {
  const v = product.product.specs[key];
  const t = v?.value_numeric ?? v?.value_text ?? v?.normalized_value ?? v?.original_value;
  if (t == null || t === "") return NOT_IDENTIFIED;
  return unit && v?.value_numeric != null ? `${t} ${unit}` : String(t);
}

export function ComparisonSidePicker({
  title,
  familia,
  categoria,
  brandOptions,
  brandLocked,
  fixedTable,
  value,
  resolved,
  onChange,
}: {
  title: string;
  familia: string;
  categoria: string | null;
  brandOptions: string[];
  /** Base: marca vem do estudo e não muda aqui. */
  brandLocked?: boolean;
  /** Base: tabela definida nos filtros do estudo (não é escolhida neste bloco). */
  fixedTable?: string | null;
  value: SideSelection;
  resolved: ResolvedSide;
  onChange: (next: SideSelection) => void;
}) {
  const product = value.product;
  const meta = resolved.tables.find((t) => t.key === resolved.table);
  const unit = resolved.comparableUnit;
  const perMeterBasis = resolved.originalPrice != null && resolved.originalPrice !== resolved.price;
  const dateText = monthYear(resolved.priceRow?.effective_date ?? meta?.date);
  const priceText = !product
    ? "—"
    : resolved.loading
      ? "Buscando…"
      : resolved.price != null
        ? formatBRL(resolved.price)
        : PRICE_NOT_COMPARABLE_LABEL;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>

      <div className="space-y-1">
        <Label className="text-xs">Marca</Label>
        <Select
          value={value.brand || undefined}
          onValueChange={(v) => onChange({ brand: v, product: null, table: null })}
          disabled={brandLocked}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Selecione a marca" />
          </SelectTrigger>
          <SelectContent>
            {brandOptions.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Tabela</Label>
        {fixedTable !== undefined ? (
          <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm">
            {resolved.table ?? fixedTable ?? "Selecione a tabela base no estudo"}
          </div>
        ) : (
          <Select
            value={resolved.table ?? undefined}
            onValueChange={(v) => onChange({ ...value, table: v })}
            disabled={!value.brand || !product || resolved.tables.length === 0}
          >
            <SelectTrigger className="h-9">
              <SelectValue
                placeholder={
                  !value.brand
                    ? "Escolha a marca"
                    : !product
                      ? "Selecione um produto primeiro"
                      : resolved.tables.length === 0
                        ? "Sem preço/tabela cadastrados"
                        : "Selecione a tabela"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {resolved.tables.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                  {monthYear(t.date) ? ` — ${monthYear(t.date)}` : ""}
                  {t.categoria ? ` · ${t.categoria}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Produto / código</Label>
        <ProductCombobox
          value={product}
          onSelect={(p) => onChange({ ...value, product: p, table: null })}
          familia={familia}
          categoria={categoria}
          marca={value.brand}
          placeholder={value.brand ? "Buscar por código ou descrição" : "Escolha a marca primeiro"}
        />
        {product && (
          <p className="text-xs text-muted-foreground">
            {product.marca} · <span className="font-mono">{productCode(product)}</span> —{" "}
            {product.descricao ?? product.nome}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Preço comparável</Label>
        <div
          className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm"
          aria-readonly="true"
        >
          <span className={resolved.price == null ? "text-muted-foreground" : "font-medium"}>
            {priceText}
          </span>
          {resolved.price != null && unit && (
            <span className="ml-0.5 text-xs text-muted-foreground">/{unit}</span>
          )}
        </div>
        {perMeterBasis && resolved.originalPrice != null && (
          <p className="text-[11px] text-muted-foreground">
            Preço original ({resolved.originalUnit ?? "unidade"}):{" "}
            {formatBRL(resolved.originalPrice)}
          </p>
        )}
        {product && resolved.table && (
          <p className="text-[11px] text-muted-foreground">
            Tabela {resolved.table}
            {dateText ? ` — ${dateText}` : ""}
          </p>
        )}
      </div>

      {product && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-2 text-xs">
          {top6For(familia).map((attr) => {
            const text = specText(product, attr.key, attr.unidade);
            return (
              <div key={attr.key} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{attr.label}</dt>
                <dd className={text === NOT_IDENTIFIED ? "text-muted-foreground" : "font-medium"}>
                  {text}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
