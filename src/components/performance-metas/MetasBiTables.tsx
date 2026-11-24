// Blocos visuais do BI Metas: filtro multisseleção, tabela de recorte com barra de
// participação e matriz dimensão × portfólio. Cores: barra de magnitude em um único tom
// (primary); atingimento usa o farol oficial sempre com o percentual escrito.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Minus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FAROL_CELL_CLASS, statusFromRatio } from "@/lib/performance-farol";
import { METAS_FAMILIES, METAS_FAMILY_LABEL, fmtBRL, fmtPct } from "@/lib/performance-metas";
import type { CanonicalFamily } from "@/lib/client-bi-familias";
import type { MetasBiAggregate, MetasBiDimension } from "@/lib/performance-metas-bi";

export const fmtSignedShort = (v: number) =>
  v === 0 ? "—" : `${v > 0 ? "+" : "−"}${fmtBRL(Math.abs(v))}`;

export function diffClass(v: number) {
  return v > 0
    ? "text-emerald-700 dark:text-emerald-400"
    : v < 0
      ? "text-red-700 dark:text-red-400"
      : "text-muted-foreground";
}

export function AtingCell({
  agg,
  className,
}: {
  agg: MetasBiAggregate | null;
  className?: string;
}) {
  const status = statusFromRatio(agg?.atingimento ?? null);
  return (
    <span
      className={cn(
        "inline-flex min-w-[58px] justify-center rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        status ? FAROL_CELL_CLASS[status] : "text-muted-foreground",
        className,
      )}
      title={
        agg?.fonte === "estimado"
          ? "Inclui base estimada (atingimento × meta)"
          : agg?.fonte === "media"
            ? "Inclui média histórica onde não há venda realizada"
            : undefined
      }
    >
      {fmtPct(agg?.atingimento ?? null)}
      {agg?.fonte && agg.fonte !== "realizado" && agg.atingimento != null ? "*" : ""}
    </span>
  );
}

// ------------------------------- Filtro --------------------------------------

export function MultiFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ key: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
  }, [options, q]);
  const toggle = (k: string) =>
    onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  // "Selecionar todos" age sobre as opções visíveis (respeita a busca).
  const shownSelected = shown.filter((o) => value.includes(o.key)).length;
  const allShown = shown.length > 0 && shownSelected === shown.length;
  const toggleAll = () => {
    const keys = new Set(shown.map((o) => o.key));
    onChange(
      allShown
        ? value.filter((k) => !keys.has(k))
        : [...value, ...shown.map((o) => o.key).filter((k) => !value.includes(k))],
    );
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn("h-8 gap-1 text-xs", value.length > 0 && "border-primary text-primary")}
        >
          {label}
          {value.length > 0 && (
            <span className="rounded bg-primary/10 px-1 tabular-nums">{value.length}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        {options.length > 8 && (
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="h-8 pl-7 text-xs"
            />
          </div>
        )}
        {shown.length > 0 && (
          <button
            onClick={toggleAll}
            className="mb-1 flex w-full items-center gap-2 rounded border-b border-border px-2 py-1.5 text-left text-xs font-medium hover:bg-muted"
          >
            <CheckBox state={allShown ? "on" : shownSelected > 0 ? "partial" : "off"} />
            <span className="truncate">
              {q.trim() ? `Selecionar todos os resultados (${shown.length})` : "Selecionar todos"}
            </span>
          </button>
        )}
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {shown.map((o) => (
            <button
              key={o.key}
              onClick={() => toggle(o.key)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
            >
              <CheckBox state={value.includes(o.key) ? "on" : "off"} />
              <span className="truncate">{o.label}</span>
            </button>
          ))}
          {shown.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nada encontrado.</p>
          )}
        </div>
        {value.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="mt-2 w-full border-t border-border pt-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Limpar seleção
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function CheckBox({ state }: { state: "on" | "off" | "partial" }) {
  return (
    <span
      className={cn(
        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
        state === "off" ? "border-border" : "border-primary bg-primary text-primary-foreground",
      )}
    >
      {state === "on" && <Check className="h-3 w-3" />}
      {state === "partial" && <Minus className="h-3 w-3" />}
    </span>
  );
}

// ---------------------------- Tabela de recorte ------------------------------

export function BreakdownTable({
  rows,
  total,
  dimension,
  active,
  onToggle,
  limit,
}: {
  rows: MetasBiAggregate[];
  total: number;
  dimension: MetasBiDimension;
  /** Chaves filtradas nesta dimensão (destacadas). */
  active: string[];
  onToggle: (key: string) => void;
  limit?: number;
}) {
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...rows.map((r) => r.metaAtual));
  const shown = limit && !all ? rows.slice(0, limit) : rows;
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-2 text-left font-medium">{labelFor(dimension)}</th>
            <th className="px-2 py-2 text-right font-medium">Clientes</th>
            <th className="px-2 py-2 text-left font-medium">Meta atual</th>
            <th className="px-2 py-2 text-right font-medium">Dif. padrão</th>
            <th className="py-2 pl-2 text-right font-medium">Ating.</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const on = active.includes(r.key);
            return (
              <tr
                key={r.key}
                className={cn(
                  "border-b border-border/50 last:border-0 hover:bg-muted/40",
                  on && "bg-primary/5",
                )}
              >
                <td className="max-w-[220px] py-2 pr-2">
                  {dimension === "cliente" ? (
                    <Link
                      to="/performance/metas/$rowId"
                      params={{ rowId: r.key }}
                      className="block truncate font-medium hover:text-primary hover:underline"
                      title={r.label}
                    >
                      {r.label}
                    </Link>
                  ) : (
                    <button
                      onClick={() => onToggle(r.key)}
                      className={cn(
                        "block max-w-full truncate text-left font-medium hover:text-primary",
                        on && "text-primary",
                      )}
                      title={on ? "Remover filtro" : `Filtrar por ${r.label}`}
                    >
                      {r.label}
                    </button>
                  )}
                </td>
                <td className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">
                  {r.clientes}
                  {r.personalizados > 0 && (
                    <span className="ml-1 text-[10px]" title="Com meta personalizada">
                      ({r.personalizados})
                    </span>
                  )}
                </td>
                <td className="min-w-[160px] px-2 py-2">
                  <div className="flex items-baseline justify-between gap-2 tabular-nums">
                    <span className="font-semibold">{fmtBRL(r.metaAtual)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {total > 0 ? fmtPct(r.metaAtual / total) : "—"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary/70"
                      style={{ width: `${(r.metaAtual / max) * 100}%` }}
                    />
                  </div>
                </td>
                <td
                  className={cn(
                    "px-2 py-2 text-right text-xs tabular-nums",
                    diffClass(r.diferenca),
                  )}
                >
                  {fmtSignedShort(r.diferenca)}
                </td>
                <td className="py-2 pl-2 text-right">
                  <AtingCell agg={r} />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                Sem dados para os filtros selecionados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {limit && rows.length > limit && (
        <button
          onClick={() => setAll((a) => !a)}
          className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {all ? "Mostrar menos" : `Mostrar todos (${rows.length})`}
        </button>
      )}
    </div>
  );
}

const labelFor = (d: MetasBiDimension) =>
  ({
    regiao: "Região",
    uf: "UF",
    representante: "Representante",
    familia: "Portfólio",
    categoria: "Categoria",
    origem: "Origem",
    cliente: "Cliente",
  })[d];

// ------------------------------- Matriz --------------------------------------

export type MatrixMetric = "meta" | "atingimento" | "diferenca";

export function MetasMatrix({
  data,
  dimension,
  metric,
}: {
  data: Array<{ row: MetasBiAggregate; cells: Record<CanonicalFamily, MetasBiAggregate | null> }>;
  dimension: MetasBiDimension;
  metric: MatrixMetric;
}) {
  const max = Math.max(
    1,
    ...data.flatMap((d) => METAS_FAMILIES.map((f) => d.cells[f]?.metaAtual ?? 0)),
  );
  const cell = (c: MetasBiAggregate | null) => {
    if (!c || (c.metaAtual === 0 && c.metaPadrao === 0))
      return <span className="text-muted-foreground">—</span>;
    if (metric === "atingimento") return <AtingCell agg={c} />;
    if (metric === "diferenca")
      return <span className={diffClass(c.diferenca)}>{fmtSignedShort(c.diferenca)}</span>;
    return fmtBRL(c.metaAtual);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-xs">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="sticky left-0 z-10 bg-card py-2 pr-3 text-left font-medium">
              {labelFor(dimension)}
            </th>
            {METAS_FAMILIES.map((f) => (
              <th key={f} className="px-2 py-2 text-right font-medium">
                {METAS_FAMILY_LABEL[f]}
              </th>
            ))}
            <th className="py-2 pl-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map(({ row, cells }) => (
            <tr key={row.key} className="border-b border-border/50 last:border-0">
              <td className="sticky left-0 z-10 max-w-[220px] truncate bg-card py-1.5 pr-3 font-medium">
                {row.label}
              </td>
              {METAS_FAMILIES.map((f) => {
                const c = cells[f];
                const shade =
                  metric === "meta" && c && c.metaAtual > 0
                    ? `color-mix(in oklab, var(--primary) ${Math.round(6 + (c.metaAtual / max) * 30)}%, transparent)`
                    : undefined;
                return (
                  <td
                    key={f}
                    className="px-2 py-1.5 text-right tabular-nums"
                    style={shade ? { backgroundColor: shade } : undefined}
                  >
                    {cell(c)}
                  </td>
                );
              })}
              <td className="py-1.5 pl-3 text-right font-semibold tabular-nums">{cell(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
