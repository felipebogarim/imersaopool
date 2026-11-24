// Portal do representante → BI Metas da própria carteira.
// Usa somente fatos sanitizados pelo servidor: meta oficial, atingimento e dimensões permitidas.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtBRL } from "@/lib/performance-metas";
import {
  DIMENSION_LABEL,
  aggregateMetasBi,
  applyMetasBiFilters,
  buildRepMetasBiFacts,
  dimensionOptions,
  matrixMetasBi,
  totalMetasBi,
  type MetasBiDimension,
  type MetasBiFilters,
  type MetasBiSort,
} from "@/lib/performance-metas-bi";
import { repGetMetasBi } from "@/lib/performance-metas.functions";
import {
  AtingCell,
  BreakdownTable,
  MetasMatrix,
  MultiFilter,
  type MatrixMetric,
} from "./MetasBiTables";

const FILTER_DIMS: MetasBiDimension[] = ["cliente", "categoria", "familia"];
const BREAKDOWN_DIMS = ["cliente", "categoria"] as const;
type BreakdownDim = (typeof BREAKDOWN_DIMS)[number];
const SORT_OPTIONS: Array<[MetasBiSort, string]> = [
  ["metaAtual", "Maior meta"],
  ["atingimento", "Maior atingimento"],
  ["label", "Nome"],
];

export function RepMetasBiPanel() {
  const getFn = useServerFn(repGetMetasBi);
  const { data, isLoading, error } = useQuery({
    queryKey: ["rep-metas-bi"],
    queryFn: () => getFn(),
  });
  const [filters, setFilters] = useState<MetasBiFilters>({});
  const [dim, setDim] = useState<BreakdownDim>("cliente");
  const [sort, setSort] = useState<MetasBiSort>("metaAtual");
  const [matrixDim, setMatrixDim] = useState<BreakdownDim>("cliente");
  const [metric, setMetric] = useState<MatrixMetric>("meta");

  const allFacts = useMemo(() => buildRepMetasBiFacts(data?.facts ?? []), [data?.facts]);
  const facts = useMemo(() => applyMetasBiFilters(allFacts, filters), [allFacts, filters]);
  const total = useMemo(() => totalMetasBi(facts), [facts]);
  const porFamilia = useMemo(() => aggregateMetasBi(facts, "familia"), [facts]);
  const porDim = useMemo(() => aggregateMetasBi(facts, dim, sort), [facts, dim, sort]);
  const matrix = useMemo(() => matrixMetasBi(facts, matrixDim, sort), [facts, matrixDim, sort]);
  const options = useMemo(
    () => Object.fromEntries(FILTER_DIMS.map((d) => [d, dimensionOptions(allFacts, d)])),
    [allFacts],
  ) as Record<MetasBiDimension, Array<{ key: string; label: string }>>;
  const setFilter = (d: MetasBiDimension, value: string[]) =>
    setFilters((current) => ({ ...current, [d]: value }));
  const toggleFilter = (d: MetasBiDimension, key: string) => {
    const current = filters[d] ?? [];
    setFilter(d, current.includes(key) ? current.filter((v) => v !== key) : [...current, key]);
  };
  const active = FILTER_DIMS.flatMap((d) =>
    (filters[d] ?? []).map((key) => ({
      d,
      key,
      label: options[d]?.find((o) => o.key === key)?.label ?? key,
    })),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" /> Consolidando metas da carteira…
      </div>
    );
  }
  if (error) {
    return (
      <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        {error instanceof Error ? error.message : "Não foi possível carregar a BI de metas."}
      </p>
    );
  }

  const portfoliosComMeta = new Set(
    facts.filter((f) => (f.metaAtual ?? 0) > 0).map((f) => f.familia),
  ).size;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">BI Metas da minha carteira</h2>
        <p className="text-sm text-muted-foreground">
          Visão consolidada das metas oficiais e do atingimento dos seus clientes.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background p-3 shadow-sm">
        {FILTER_DIMS.map((d) => (
          <MultiFilter
            key={d}
            label={DIMENSION_LABEL[d]}
            options={options[d] ?? []}
            value={filters[d] ?? []}
            onChange={(value) => setFilter(d, value)}
          />
        ))}
        {active.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2 border-t pt-2">
            {active.map((item) => (
              <button
                key={`${item.d}|${item.key}`}
                onClick={() => toggleFilter(item.d, item.key)}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] text-primary"
              >
                <span className="text-muted-foreground">{DIMENSION_LABEL[item.d]}:</span>
                {item.label} <X className="h-3 w-3" />
              </button>
            ))}
            <button
              onClick={() => setFilters({})}
              className="ml-auto text-[11px] text-muted-foreground hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Meta oficial consolidada">
          <p className="text-2xl font-semibold tabular-nums">{fmtBRL(total.metaAtual)}</p>
          <p className="text-[11px] text-muted-foreground">Ciclo vigente</p>
        </Kpi>
        <Kpi label="Atingimento sobre a meta oficial">
          <AtingCell agg={total} className="px-2 py-1 text-xl" />
          <p className="mt-1 text-[11px] text-muted-foreground">Ponderado pelas metas oficiais</p>
        </Kpi>
        <Kpi label="Clientes com metas">
          <p className="text-2xl font-semibold tabular-nums">{total.clientes}</p>
          <p className="text-[11px] text-muted-foreground">
            de {data?.totalClientes ?? 0} cliente(s) na carteira
          </p>
        </Kpi>
        <Kpi label="Portfólios com meta">
          <p className="text-2xl font-semibold tabular-nums">{portfoliosComMeta}</p>
          <p className="text-[11px] text-muted-foreground">Nos filtros selecionados</p>
        </Kpi>
      </div>

      {allFacts.length === 0 ? (
        <p className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
          Ainda não há metas oficiais configuradas para os clientes da carteira.
        </p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Por portfólio">
              <BreakdownTable
                rows={porFamilia}
                dimension="familia"
                active={filters.familia ?? []}
                onToggle={(key) => toggleFilter("familia", key)}
                showComparison={false}
                clientRoute="portal"
              />
            </Card>
            <Card
              title="Por"
              controls={
                <>
                  <InlineSelect
                    value={dim}
                    onChange={(value) => setDim(value as BreakdownDim)}
                    options={BREAKDOWN_DIMS.map((d) => [d, DIMENSION_LABEL[d]])}
                  />
                  <InlineSelect
                    value={sort}
                    onChange={(value) => setSort(value as MetasBiSort)}
                    options={SORT_OPTIONS}
                    className="ml-auto"
                  />
                </>
              }
            >
              <BreakdownTable
                rows={porDim}
                dimension={dim}
                active={filters[dim] ?? []}
                onToggle={(key) => toggleFilter(dim, key)}
                limit={10}
                showComparison={false}
                clientRoute="portal"
              />
            </Card>
          </div>

          <Card
            title="Matriz"
            controls={
              <>
                <InlineSelect
                  value={matrixDim}
                  onChange={(value) => setMatrixDim(value as BreakdownDim)}
                  options={BREAKDOWN_DIMS.map((d) => [d, `${DIMENSION_LABEL[d]} × portfólio`])}
                />
                <div className="ml-auto flex rounded-md border p-0.5">
                  {(
                    [
                      ["meta", "Meta oficial"],
                      ["atingimento", "Atingimento"],
                    ] as Array<[MatrixMetric, string]>
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setMetric(value)}
                      className={cn(
                        "rounded px-2 py-1 text-[11px]",
                        metric === value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            }
          >
            <MetasMatrix data={matrix} dimension={matrixDim} metric={metric} />
          </Card>
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        Esta visão usa somente a meta oficial, o atingimento e as dimensões da sua carteira. Meta
        padrão, comentários do gestor, sugestões internas da IA e valores financeiros brutos não são
        enviados ao portal.
      </p>
    </div>
  );
}

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
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
    <section className="rounded-xl border bg-background p-4 shadow-sm">
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
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 w-auto gap-1 text-xs", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([key, label]) => (
          <SelectItem key={key} value={key} className="text-xs">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
