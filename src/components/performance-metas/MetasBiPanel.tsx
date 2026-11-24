// BI Metas: visão consolidada das metas vigentes da empresa (somente gestão).
// Filtros em uma linha (qualquer combinação de região, UF, representante, categoria,
// portfólio e origem) → KPIs → "por portfólio" + recorte livre → matriz recorte × portfólio.
// Clicar num item de um recorte liga/desliga o filtro daquela dimensão (drill-down).

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtBRL, fmtPct } from "@/lib/performance-metas";
import {
  DIMENSION_LABEL,
  aggregateMetasBi,
  applyMetasBiFilters,
  buildMetasBiFacts,
  currentMonthKey,
  dimensionOptions,
  monthKey,
  monthShortLabel,
  periodLabel,
  semesterMonths,
  yearMonths,
  matrixMetasBi,
  totalMetasBi,
  type MetasBiDimension,
  type MetasBiFilters,
  type MetasBiSort,
} from "@/lib/performance-metas-bi";
import { getMetasBi } from "@/lib/performance-metas.functions";
import { useMetasCarteira } from "./use-metas-carteira";
import {
  AtingCell,
  BreakdownTable,
  MetasMatrix,
  MultiFilter,
  diffClass,
  fmtSignedShort,
  type MatrixMetric,
} from "./MetasBiTables";

const FILTER_DIMS: MetasBiDimension[] = [
  "regiao",
  "uf",
  "representante",
  "categoria",
  "familia",
  "origem",
];
const BREAKDOWN_DIMS: MetasBiDimension[] = [
  "regiao",
  "uf",
  "representante",
  "categoria",
  "origem",
  "cliente",
];
const MATRIX_DIMS = ["regiao", "uf", "representante", "categoria", "origem"] as const;
type MatrixDim = (typeof MATRIX_DIMS)[number];

const CATEGORIA_ORDEM = ["Black", "Gold", "Silver"];

const SORT_LABEL: Record<MetasBiSort, string> = {
  metaAtual: "Maior meta",
  atingimento: "Maior atingimento",
  diferenca: "Maior diferença",
  label: "Nome",
};

export function MetasBiPanel() {
  const { rows, isLoading: loadingRows } = useMetasCarteira(null);
  const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const { data: bi, isLoading: loadingBi } = useQuery({
    queryKey: ["performance-metas", "bi", rowIds],
    enabled: rowIds.length > 0,
    queryFn: () => getMetasBi({ data: { rowIds } }),
  });

  const [filters, setFilters] = useState<MetasBiFilters>({});
  const [dim, setDim] = useState<MetasBiDimension>("regiao");
  const [sort, setSort] = useState<MetasBiSort>("metaAtual");
  const [matrixDim, setMatrixDim] = useState<MatrixDim>("representante");
  const [metric, setMetric] = useState<MatrixMetric>("meta");

  // Período: meses escolhidos, semestre ou ano inteiro (soma das metas mensais).
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
  const changeYear = (y: number) => {
    setYear(y);
    // Mantém os mesmos meses no novo ano.
    setMonths((ms) => ms.map((m) => monthKey(y, Number(m.slice(5, 7)))));
  };
  const monthOptions = useMemo(
    () => yearMonths(year).map((key) => ({ key, label: monthShortLabel(key) })),
    [year],
  );

  const allFacts = useMemo(
    () => buildMetasBiFacts(rows, bi?.available ? bi.rows : [], periodMonths),
    [rows, bi, periodMonths],
  );
  const facts = useMemo(() => applyMetasBiFilters(allFacts, filters), [allFacts, filters]);
  const total = useMemo(() => totalMetasBi(facts), [facts]);
  const porFamilia = useMemo(() => aggregateMetasBi(facts, "familia"), [facts]);
  const porDim = useMemo(() => aggregateMetasBi(facts, dim, sort), [facts, dim, sort]);
  const matrix = useMemo(() => matrixMetasBi(facts, matrixDim, sort), [facts, matrixDim, sort]);
  const porCategoria = useMemo(
    () =>
      aggregateMetasBi(facts, "categoria", "label").sort((a, b) => {
        const ia = CATEGORIA_ORDEM.indexOf(a.key);
        const ib = CATEGORIA_ORDEM.indexOf(b.key);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        return b.clientes - a.clientes;
      }),
    [facts],
  );
  const options = useMemo(
    () => Object.fromEntries(FILTER_DIMS.map((d) => [d, dimensionOptions(allFacts, d)])),
    [allFacts],
  ) as Record<MetasBiDimension, Array<{ key: string; label: string }>>;

  const setFilter = (d: MetasBiDimension, v: string[]) => setFilters((f) => ({ ...f, [d]: v }));
  const toggleFilter = (d: MetasBiDimension, key: string) => {
    const cur = filters[d] ?? [];
    setFilter(d, cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]);
  };
  const activeChips = FILTER_DIMS.flatMap((d) =>
    (filters[d] ?? []).map((k) => ({
      d,
      k,
      label: options[d]?.find((o) => o.key === k)?.label ?? k,
    })),
  );

  if (loadingRows || loadingBi) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" /> Carregando metas…
      </div>
    );
  }

  const diffPct = total.metaPadrao > 0 ? total.diferenca / total.metaPadrao : null;

  return (
    <div className="space-y-4">
      {bi && !bi.available && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          BI parcial: a migration 20261126130000_performance_goals_bi ainda não foi aplicada.
          Exibindo apenas metas padrão por categoria, sem metas personalizadas, região e base
          vendida.
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
            onChange={(v) => setFilter(d, v)}
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
            onChange={(v) => changeYear(Number(v))}
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
              options={monthOptions}
              value={months}
              onChange={(v) => setMonths([...v].sort())}
            />
          )}
        </div>
        {activeChips.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2 border-t border-border/50 pt-2">
            {activeChips.map((c) => (
              <button
                key={`${c.d}|${c.k}`}
                onClick={() => toggleFilter(c.d, c.k)}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/10"
              >
                <span className="text-muted-foreground">{DIMENSION_LABEL[c.d]}:</span> {c.label}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button
              onClick={() => setFilters({})}
              className="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          label="Meta atual"
          hint="Metas salvas mês a mês; padrão da categoria nos meses sem meta salva"
        >
          <p className="text-2xl font-semibold tabular-nums">{fmtBRL(total.metaAtual)}</p>
          <p className="text-[11px] text-muted-foreground">{periodLabel(periodMonths, year)}</p>
        </Kpi>
        <Kpi label="Meta original" hint="Meta padrão da categoria (Black/Gold/Silver), fixa">
          <p className="text-xl font-medium tabular-nums text-muted-foreground">
            {fmtBRL(total.metaPadrao)}
          </p>
        </Kpi>
        <Kpi label="Diferença vs. original">
          <p className={cn("text-xl font-semibold tabular-nums", diffClass(total.diferenca))}>
            {fmtSignedShort(total.diferenca)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {diffPct == null ? "—" : `${diffPct >= 0 ? "+" : ""}${fmtPct(diffPct)}`}
          </p>
        </Kpi>
        <Kpi label="Atingimento s/ meta atual" hint="Base vendida ÷ meta, nos portfólios com base">
          <AtingCell agg={total} className="px-2 py-1 text-xl" />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Base {fmtBRL(total.realizado)} de {fmtBRL(total.metaComBase)}
            {periodMonths.length > 1 && " · base mensal × meses"}
          </p>
        </Kpi>
        <Kpi label="Clientes">
          <p className="text-xl font-semibold tabular-nums">{total.clientes}</p>
          <p className="text-[11px] text-muted-foreground">
            {total.personalizados} com meta personalizada
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-border/50 pt-2 text-[11px]">
            {porCategoria.map((c) => (
              <div key={c.key} className="flex justify-between gap-2">
                <span className="truncate text-muted-foreground" title={c.label}>
                  {c.label}
                </span>
                <span className="font-medium tabular-nums">{c.clientes}</span>
              </div>
            ))}
          </div>
        </Kpi>
      </div>

      {/* Por portfólio + recorte livre */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Por portfólio">
          <BreakdownTable
            rows={porFamilia}
            dimension="familia"
            active={filters.familia ?? []}
            onToggle={(k) => toggleFilter("familia", k)}
          />
        </Card>
        <Card
          title="Por"
          controls={
            <>
              <InlineSelect
                value={dim}
                onChange={(v) => setDim(v as MetasBiDimension)}
                options={BREAKDOWN_DIMS.map((d) => [d, DIMENSION_LABEL[d]])}
              />
              <InlineSelect
                value={sort}
                onChange={(v) => setSort(v as MetasBiSort)}
                options={Object.entries(SORT_LABEL)}
                className="ml-auto"
              />
            </>
          }
        >
          <BreakdownTable
            rows={porDim}
            dimension={dim}
            active={filters[dim] ?? []}
            onToggle={(k) => toggleFilter(dim, k)}
            limit={10}
          />
        </Card>
      </div>

      {/* Matriz */}
      <Card
        title="Matriz"
        controls={
          <>
            <InlineSelect
              value={matrixDim}
              onChange={(v) => setMatrixDim(v as MatrixDim)}
              options={MATRIX_DIMS.map((d) => [d, `${DIMENSION_LABEL[d]} × portfólio`])}
            />
            <div className="ml-auto flex rounded-md border border-border p-0.5">
              {(
                [
                  ["meta", "Meta atual"],
                  ["atingimento", "Atingimento"],
                  ["diferenca", "Dif. original"],
                ] as Array<[MatrixMetric, string]>
              ).map(([m, l]) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={cn(
                    "rounded px-2 py-1 text-[11px]",
                    metric === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </>
        }
      >
        <MetasMatrix data={matrix} dimension={matrixDim} metric={metric} />
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Meta original = meta padrão da categoria (fixa). Meta atual = metas salvas pelo gestor mês a
        mês (atualiza ao salvar); sem meta salva no mês, vale a original. Em períodos de vários
        meses, as metas são somadas e a base vendida mensal é multiplicada pelo nº de meses.
        Atingimento = base vendida ÷ meta atual (* inclui média histórica ou estimativa onde não há
        venda realizada). Região: cadastro do cliente, senão a do representante.
      </p>
    </div>
  );
}

function Kpi({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm" title={hint}>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Card({
  title,
  controls,
  children,
}: {
  title: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {controls}
      </div>
      {children}
    </section>
  );
}

function InlineSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 w-auto gap-1 text-xs", className)}>
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
