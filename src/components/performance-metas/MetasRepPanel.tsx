// Metas por Rep: metas e performance geral de portfólio por representante (somente gestão).
// Usa os mesmos fatos do BI Metas (useMetasCarteira + getMetasBi), então os totais batem.
// Filtros → KPIs → ranking de representantes (expande o portfólio do rep) → matriz rep × portfólio.

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { METAS_FAMILIES, METAS_FAMILY_LABEL, fmtBRL, fmtPct } from "@/lib/performance-metas";
import { FAROL_HEX, statusFromRatio } from "@/lib/performance-farol";
import {
  DIMENSION_LABEL,
  LIMIAR_PORTFOLIO_ABAIXO,
  applyMetasBiFilters,
  buildMetasBiFacts,
  currentMonthKey,
  dimensionOptions,
  matrixMetasBi,
  monthKey,
  monthShortLabel,
  periodLabel,
  resumoPortfolioRep,
  semesterMonths,
  totalMetasBi,
  yearMonths,
  type MetasBiAggregate,
  type MetasBiDimension,
  type MetasBiFilters,
  type MetasBiSort,
} from "@/lib/performance-metas-bi";
import { getMetasBi } from "@/lib/performance-metas.functions";
import { useMetasCarteira } from "./use-metas-carteira";
import { AtingCell, MetasMatrix, MultiFilter, type MatrixMetric } from "./MetasBiTables";

const FILTER_DIMS: MetasBiDimension[] = ["representante", "regiao", "uf", "categoria"];

const SORT_LABEL: Record<MetasBiSort, string> = {
  metaAtual: "Maior meta",
  atingimento: "Maior atingimento",
  diferenca: "Maior diferença",
  label: "Nome",
};

const pctLimiar = Math.round(LIMIAR_PORTFOLIO_ABAIXO * 100);

export function MetasRepPanel() {
  const { rows, isLoading: loadingRows } = useMetasCarteira(null);
  const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const { data: bi, isLoading: loadingBi } = useQuery({
    queryKey: ["performance-metas", "bi", rowIds],
    enabled: rowIds.length > 0,
    queryFn: () => getMetasBi({ data: { rowIds } }),
  });

  const [filters, setFilters] = useState<MetasBiFilters>({});
  const [sort, setSort] = useState<MetasBiSort>("atingimento");
  const [metric, setMetric] = useState<MatrixMetric>("atingimento");
  const [aberto, setAberto] = useState<string | null>(null);

  const thisYear = new Date().getFullYear();
  const [mode, setMode] = useState<"mes" | "semestre" | "ano">("mes");
  const [year, setYear] = useState(thisYear);
  const [months, setMonths] = useState<string[]>(() => [currentMonthKey()]);
  const [semester, setSemester] = useState<1 | 2>(() => (new Date().getMonth() < 6 ? 1 : 2));
  const periodMonths = useMemo(
    () =>
      mode === "ano"
        ? yearMonths(year)
        : mode === "semestre"
          ? semesterMonths(year, semester)
          : months,
    [mode, year, months, semester],
  );

  const allFacts = useMemo(
    () => buildMetasBiFacts(rows, bi?.available ? bi.rows : [], periodMonths),
    [rows, bi, periodMonths],
  );
  const facts = useMemo(() => applyMetasBiFilters(allFacts, filters), [allFacts, filters]);
  const total = useMemo(() => totalMetasBi(facts), [facts]);
  const matrix = useMemo(() => matrixMetasBi(facts, "representante", sort), [facts, sort]);
  const linhas = useMemo(
    () => matrix.map((m) => ({ ...m, resumo: resumoPortfolioRep(m.cells) })),
    [matrix],
  );
  const options = useMemo(
    () => Object.fromEntries(FILTER_DIMS.map((d) => [d, dimensionOptions(allFacts, d)])),
    [allFacts],
  ) as Record<MetasBiDimension, Array<{ key: string; label: string }>>;

  if (loadingRows || loadingBi) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" /> Carregando metas…
      </div>
    );
  }

  const comAting = linhas.filter((l) => l.row.atingimento != null);
  const repsNaMeta = comAting.filter((l) => (l.row.atingimento ?? 0) >= 0.9).length;
  const portfoliosAbaixo = linhas.reduce((s, l) => s + l.resumo.abaixo, 0);
  const maxAting = Math.max(1.2, ...comAting.map((l) => l.row.atingimento ?? 0));

  return (
    <div className="space-y-4">
      {bi && !bi.available && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Visão parcial: metas personalizadas e base vendida indisponíveis (migration do BI Metas
          pendente). Exibindo apenas metas padrão por categoria.
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        {FILTER_DIMS.map((d) => (
          <MultiFilter
            key={d}
            label={DIMENSION_LABEL[d]}
            options={options[d] ?? []}
            value={filters[d] ?? []}
            onChange={(v) => setFilters((f) => ({ ...f, [d]: v }))}
          />
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5">
            {(
              [
                ["mes", "Mês"],
                ["semestre", "Semestre"],
                ["ano", "Ano"],
              ] as const
            ).map(([m, l]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs",
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <InlineSelect
            value={String(year)}
            onChange={(v) => {
              const y = Number(v);
              setYear(y);
              setMonths((ms) => ms.map((m) => monthKey(y, Number(m.slice(5, 7)))));
            }}
            options={[thisYear - 1, thisYear, thisYear + 1].map((y) => [String(y), String(y)])}
          />
          {mode === "semestre" && (
            <InlineSelect
              value={String(semester)}
              onChange={(v) => setSemester(v === "2" ? 2 : 1)}
              options={[
                ["1", "1º semestre"],
                ["2", "2º semestre"],
              ]}
            />
          )}
          {mode === "mes" && (
            <MultiFilter
              label={months.length === 1 ? monthShortLabel(months[0]) : "Meses"}
              options={yearMonths(year).map((key) => ({ key, label: monthShortLabel(key) }))}
              value={months}
              onChange={(v) => setMonths(v.length ? [...v].sort() : [currentMonthKey()])}
            />
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          label="Representantes"
          valor={String(linhas.length)}
          sub={`${total.clientes} clientes`}
        />
        <Kpi
          label="Meta do período"
          valor={fmtBRL(total.metaAtual)}
          sub={periodLabel(periodMonths, year)}
        />
        <Kpi
          label="Base vendida"
          valor={fmtBRL(total.realizado)}
          sub="portfólios com meta e base"
        />
        <Kpi
          label="Atingimento geral"
          valor={<AtingCell agg={total} className="text-base" />}
          sub="base vendida ÷ meta"
        />
        <Kpi
          label="Reps ≥ 90% da meta"
          valor={`${repsNaMeta} de ${comAting.length}`}
          sub={`${portfoliosAbaixo} portfólios abaixo de ${pctLimiar}%`}
        />
      </div>

      {/* Ranking por representante */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Metas e performance por representante</h3>
            <p className="text-xs text-muted-foreground">
              Clique no representante para ver a performance de cada portfólio.
            </p>
          </div>
          <InlineSelect
            value={sort}
            onChange={(v) => setSort(v as MetasBiSort)}
            options={(Object.keys(SORT_LABEL) as MetasBiSort[]).map((k) => [k, SORT_LABEL[k]])}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 text-left font-medium">Representante</th>
                <th className="px-2 py-2 text-right font-medium">Clientes</th>
                <th className="px-2 py-2 text-right font-medium">Meta</th>
                <th className="px-2 py-2 text-right font-medium">Base vendida</th>
                <th className="w-[220px] px-2 py-2 text-left font-medium">Atingimento</th>
                <th className="px-2 py-2 text-left font-medium">Melhor portfólio</th>
                <th className="px-2 py-2 text-left font-medium">Pior portfólio</th>
                <th className="py-2 pl-2 text-right font-medium">Abaixo de {pctLimiar}%</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ row, cells, resumo }) => {
                const exp = aberto === row.key;
                return (
                  <Fragment key={row.key}>
                    <tr
                      className="cursor-pointer border-b border-border/50 hover:bg-muted/40"
                      onClick={() => setAberto(exp ? null : row.key)}
                    >
                      <td className="max-w-[240px] py-2 pr-3 font-medium">
                        <span className="flex items-center gap-1">
                          {exp ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate">{row.label}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.clientes}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmtBRL(row.metaAtual)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {row.metaComBase > 0 ? fmtBRL(row.realizado) : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <AtingBar agg={row} max={maxAting} />
                      </td>
                      <td className="px-2 py-2">
                        <PortfolioChip agg={resumo.melhor} />
                      </td>
                      <td className="px-2 py-2">
                        <PortfolioChip agg={resumo.pior} />
                      </td>
                      <td className="py-2 pl-2 text-right tabular-nums">
                        {resumo.avaliados ? `${resumo.abaixo} de ${resumo.avaliados}` : "—"}
                      </td>
                    </tr>
                    {exp && (
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td colSpan={8} className="px-3 py-3">
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {METAS_FAMILIES.map((f) => {
                              const c = cells[f];
                              return (
                                <div
                                  key={f}
                                  className="rounded-lg border border-border bg-card px-3 py-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate font-medium">
                                      {METAS_FAMILY_LABEL[f]}
                                    </span>
                                    <AtingCell agg={c} />
                                  </div>
                                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                                    <span>Meta {fmtBRL(c?.metaAtual ?? 0)}</span>
                                    <span>
                                      Base {c && c.metaComBase > 0 ? fmtBRL(c.realizado) : "—"}
                                    </span>
                                  </div>
                                  <AtingBar agg={c} max={maxAting} compacto />
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-muted-foreground">
                    Nenhum representante no recorte selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          * Inclui média histórica ou base estimada onde não há venda realizada. Atingimento = base
          vendida ÷ meta dos portfólios com base disponível.
        </p>
      </section>

      {/* Matriz rep × portfólio */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Performance de portfólio por representante</h3>
          <div className="flex rounded-md border border-border p-0.5">
            {(
              [
                ["atingimento", "Atingimento"],
                ["meta", "Meta"],
                ["diferenca", "Diferença vs padrão"],
              ] as const
            ).map(([m, l]) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs",
                  metric === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <MetasMatrix data={matrix} dimension="representante" metric={metric} />
      </section>
    </div>
  );
}

function Kpi({ label, valor, sub }: { label: string; valor: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{valor}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function AtingBar({
  agg,
  max,
  compacto = false,
}: {
  agg: MetasBiAggregate | null;
  max: number;
  compacto?: boolean;
}) {
  const a = agg?.atingimento ?? null;
  const st = statusFromRatio(a);
  const larg = a == null ? 0 : Math.min(100, (a / max) * 100);
  const marco = (1 / max) * 100;
  return (
    <div className={cn("flex items-center gap-2", compacto && "mt-1.5")}>
      <div className="relative h-2 flex-1 rounded-full bg-muted">
        {a != null && (
          <div
            className="h-2 rounded-full"
            style={{ width: `${larg}%`, backgroundColor: st ? `#${FAROL_HEX[st]}` : undefined }}
          />
        )}
        {/* marca dos 100% da meta */}
        <div
          className="absolute -top-0.5 h-3 w-px bg-foreground/40"
          style={{ left: `${marco}%` }}
          aria-hidden
        />
      </div>
      {!compacto && <AtingCell agg={agg} />}
    </div>
  );
}

function PortfolioChip({ agg }: { agg: MetasBiAggregate | null }) {
  if (!agg) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="max-w-[120px] truncate">{agg.label}</span>
      <span className="tabular-nums text-muted-foreground">{fmtPct(agg.atingimento, 0)}</span>
    </span>
  );
}

function InlineSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto gap-1 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([k, l]) => (
          <SelectItem key={k} value={k} className="text-xs">
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
