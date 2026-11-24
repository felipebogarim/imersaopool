// BI Metas: visão consolidada das metas vigentes da empresa (somente gestão).
// Filtros em uma linha (qualquer combinação de região, UF, representante, categoria,
// portfólio e origem) → KPIs → "por portfólio" + recorte livre → matriz recorte × portfólio.
// Clicar num item de um recorte liga/desliga o filtro daquela dimensão (drill-down).

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Maximize2, Minimize2, SlidersHorizontal, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { fmtBRL, fmtPct } from "@/lib/performance-metas";
import {
  FAROL_CELL_CLASS,
  FAROL_HEX,
  FAROL_LABEL,
  statusFromRatio,
  type FarolStatus,
} from "@/lib/performance-farol";
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
  type MetasBiAggregate,
  type MetasBiDimension,
  type MetasBiFact,
  type MetasBiFilters,
  type MetasBiSort,
} from "@/lib/performance-metas-bi";
import { getMetasBi } from "@/lib/performance-metas.functions";
import { useMetasCarteira } from "./use-metas-carteira";
import { BreakdownTable, MetasMatrix, MultiFilter, type MatrixMetric } from "./MetasBiTables";

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

  const [visao9mm, setVisao9mm] = useState(false);

  const allFactsRaw = useMemo(
    () => buildMetasBiFacts(rows, bi?.available ? bi.rows : [], periodMonths),
    [rows, bi, periodMonths],
  );

  const allFacts = useMemo(() => {
    if (!visao9mm) return allFactsRaw;
    const totalCompanyMeta = allFactsRaw.reduce((sum, f) => sum + (f.metaAtual ?? 0), 0);
    const targetMeta = 9_000_000 * periodMonths.length;
    const ratio = totalCompanyMeta > 0 ? targetMeta / totalCompanyMeta : 1;
    return allFactsRaw.map((f) => ({
      ...f,
      metaAtual: f.metaAtual != null ? Math.round(f.metaAtual * ratio) : null,
      metaPadrao: f.metaPadrao != null ? Math.round(f.metaPadrao * ratio) : null,
    }));
  }, [allFactsRaw, visao9mm, periodMonths.length]);
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

      {/* Topo: Gauge Meta Atual + Gráficos por Categoria e Top 10 Reps */}
      <div className="grid gap-3 lg:grid-cols-5 items-stretch">
        <div className="lg:col-span-1 flex flex-col h-full">
          <MetaAtualGaugeCard
            metaAtual={total.metaAtual}
            realizado={total.realizado}
            metaComBase={total.metaComBase}
            atingimento={total.atingimento}
            periodo={periodLabel(periodMonths, year)}
            hint="Metas salvas mês a mês; padrão da categoria nos meses sem meta salva"
            visao9mm={visao9mm}
            onToggleVisao9mm={setVisao9mm}
          />
        </div>
        <div className="lg:col-span-2 flex flex-col h-full">
          <CategoriaMetasChart porCategoria={porCategoria} />
        </div>
        <div className="lg:col-span-2 flex flex-col h-full">
          <TopRepsMetasChart facts={facts} />
        </div>
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

const GAUGE_GRADIENTS: Record<FarolStatus, [string, string]> = {
  excelente: ["#10b981", "#06b6d4"],
  otimo: ["#84cc16", "#10b981"],
  proximo: ["#f59e0b", "#eab308"],
  pode_melhorar: ["#f97316", "#f59e0b"],
  abaixo_meta: ["#f43f5e", "#ef4444"],
  sem_compra: ["#94a3b8", "#64748b"],
};

const GAUGE_STATUS_TEXT: Record<FarolStatus, string> = {
  excelente: "fill-emerald-600 dark:fill-emerald-400",
  otimo: "fill-lime-600 dark:fill-lime-400",
  proximo: "fill-amber-600 dark:fill-amber-400",
  pode_melhorar: "fill-orange-600 dark:fill-orange-400",
  abaixo_meta: "fill-red-600 dark:fill-red-400",
  sem_compra: "fill-muted-foreground",
};

function MetaAtualGaugeCard({
  metaAtual,
  realizado,
  metaComBase,
  atingimento,
  periodo,
  hint,
  visao9mm,
  onToggleVisao9mm,
}: {
  metaAtual: number;
  realizado: number;
  metaComBase: number;
  atingimento: number | null;
  periodo: string;
  hint?: string;
  visao9mm?: boolean;
  onToggleVisao9mm?: (v: boolean) => void;
}) {
  const status = statusFromRatio(atingimento);
  const colors = GAUGE_GRADIENTS[status ?? "sem_compra"];
  const statusTextColor = GAUGE_STATUS_TEXT[status ?? "sem_compra"];

  // Escala do arco: 0 a 120% (1.20)
  const ratio = atingimento ?? 0;
  const clamped = Math.min(1.2, Math.max(0, ratio));
  const t = clamped / 1.2;
  const arcRadius = 64;
  const cx = 100;
  const cy = 90;
  const arcLength = Math.PI * arcRadius; // ~201.06
  const offset = arcLength * (1 - t);

  // Ponto da agulha / indicador luminoso na ponta do progresso
  const tipX = cx - arcRadius * Math.cos(t * Math.PI);
  const tipY = cy - arcRadius * Math.sin(t * Math.PI);

  return (
    <div
      className="flex h-full flex-1 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm"
      title={hint}
    >
      <div>
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Meta atual
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleVisao9mm?.(!visao9mm)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-all cursor-pointer",
                visao9mm
                  ? "bg-amber-500 text-white font-semibold shadow-xs hover:bg-amber-600"
                  : "border border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              title="Simular todo o cenário do BI com meta total de 9 milhões por mês proporcional aos portfólios"
            >
              <SlidersHorizontal className="h-2.5 w-2.5" />
              Visão 9MM/mês
            </button>
            <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
              {periodo}
            </span>
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-base font-bold tracking-tight text-foreground tabular-nums">
            {fmtBRL(metaAtual)}
          </p>
          {visao9mm && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
              Cenário 9MM
            </span>
          )}
        </div>
      </div>

      <div className="my-2 flex flex-col items-center">
        <svg viewBox="0 0 200 110" className="w-full max-w-[210px] overflow-visible">
          <defs>
            <linearGradient id="metaAtualGaugeGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors[0]} />
              <stop offset="100%" stopColor={colors[1]} />
            </linearGradient>
            <filter id="gaugeTipGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="2"
                floodColor={colors[1]}
                floodOpacity="0.45"
              />
            </filter>
          </defs>

          {/* Arco de fundo (trilha) mais encorpado */}
          <path
            d="M 36 90 A 64 64 0 0 1 164 90"
            fill="none"
            strokeWidth={14}
            strokeLinecap="round"
            className="stroke-muted/30"
          />

          {/* Arco preenchido de progresso encorpado */}
          {t > 0 && (
            <path
              d="M 36 90 A 64 64 0 0 1 164 90"
              fill="none"
              stroke="url(#metaAtualGaugeGrad)"
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${arcLength}`}
              strokeDashoffset={offset}
              className="transition-all duration-500 ease-out"
            />
          )}

          {/* Marcador de 100% (meta atingida) */}
          <line
            x1={147.6}
            y1={62.5}
            x2={165.0}
            y2={52.5}
            stroke="currentColor"
            strokeWidth={1.5}
            className="text-muted-foreground/50"
          />
          <text
            x={168}
            y={50}
            className="text-[8px] font-semibold fill-muted-foreground/80 select-none"
          >
            100%
          </text>

          {/* Indicador luminoso na ponta do arco */}
          {t > 0 && (
            <g filter="url(#gaugeTipGlow)">
              <circle
                cx={tipX}
                cy={tipY}
                r={5.5}
                fill="#ffffff"
                stroke={colors[1]}
                strokeWidth={3}
              />
            </g>
          )}

          {/* Leitura central do percentual (sem sobreposição com o arco) */}
          <text
            x={100}
            y={68}
            textAnchor="middle"
            className="text-2xl font-bold fill-foreground tabular-nums select-none"
          >
            {atingimento != null ? fmtPct(atingimento) : "—"}
          </text>

          {/* Status do farol */}
          <text
            x={100}
            y={83}
            textAnchor="middle"
            className={cn(
              "text-[9px] font-bold uppercase tracking-wider select-none",
              statusTextColor,
            )}
          >
            {status ? FAROL_LABEL[status] : "Sem base"}
          </text>

          {/* Marcas de escala */}
          <text
            x={34}
            y={106}
            textAnchor="middle"
            className="text-[9px] font-medium fill-muted-foreground/60 select-none"
          >
            0%
          </text>
          <text
            x={166}
            y={106}
            textAnchor="middle"
            className="text-[9px] font-medium fill-muted-foreground/60 select-none"
          >
            120%
          </text>
        </svg>
      </div>

      <div className="border-t border-border/50 pt-2 text-[11px] text-muted-foreground flex items-center justify-between">
        <span className="truncate">Base: {fmtBRL(realizado)}</span>
        {metaComBase > 0 && (
          <span className="shrink-0 text-[10px] text-muted-foreground/80">
            de {fmtBRL(metaComBase)}
          </span>
        )}
      </div>
    </div>
  );
}

function fmtCompactBRL(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return fmtBRL(v);
}

function CategoriaMetasChart({ porCategoria }: { porCategoria: MetasBiAggregate[] }) {
  const [expanded, setExpanded] = useState(false);

  const categoriesData = useMemo(() => {
    // Estritamente Silver, Black e Gold
    const targetCats = ["Black", "Gold", "Silver"];
    const map = new Map(porCategoria.map((c) => [c.key.trim().toLowerCase(), c]));
    return targetCats.map((cat) => {
      const found = map.get(cat.toLowerCase());
      const meta = found?.metaAtual ?? 0;
      const real = found?.realizado ?? 0;
      const ating = found?.atingimento ?? (meta > 0 ? real / meta : null);
      const status = statusFromRatio(ating);
      return {
        key: cat,
        label: cat,
        metaAtual: meta,
        realizado: real,
        atingimento: ating,
        status,
        clientes: found?.clientes ?? 0,
        diferenca: found?.diferenca ?? 0,
      };
    });
  }, [porCategoria]);

  const maxVal = Math.max(...categoriesData.map((d) => Math.max(d.metaAtual, d.realizado)), 1);

  return (
    <>
      <div className="flex h-full flex-1 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Meta e atingimento por categoria
            </p>
            <p className="text-[11px] text-muted-foreground">Silver, Black e Gold</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(true)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="Expandir visualização"
          >
            <Maximize2 className="mr-1 h-3.5 w-3.5" /> Expandir
          </Button>
        </div>

        {/* Barras Horizontais Compactas */}
        <div className="my-2 space-y-2.5">
          {categoriesData.map((c) => {
            const metaPct = Math.min(100, (c.metaAtual / maxVal) * 100);
            const realPct = Math.min(100, (c.realizado / maxVal) * 100);
            const statusClass = c.status
              ? FAROL_CELL_CLASS[c.status]
              : "bg-muted text-muted-foreground";

            return (
              <div key={c.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        c.key === "Black"
                          ? "bg-neutral-800 dark:bg-neutral-200"
                          : c.key === "Gold"
                            ? "bg-amber-500"
                            : "bg-slate-400",
                      )}
                    />
                    <span>{c.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      Meta: {fmtCompactBRL(c.metaAtual)} · Real: {fmtCompactBRL(c.realizado)}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                        statusClass,
                      )}
                    >
                      {c.atingimento != null ? fmtPct(c.atingimento) : "—"}
                    </span>
                  </div>
                </div>

                {/* Barras horizontais comparativas */}
                <div className="space-y-0.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                    <div
                      className="h-full rounded-full bg-slate-400/80 transition-all duration-300"
                      style={{ width: `${metaPct}%` }}
                      title={`Meta: ${fmtBRL(c.metaAtual)}`}
                    />
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        c.status === "excelente"
                          ? "bg-emerald-500"
                          : c.status === "otimo"
                            ? "bg-lime-500"
                            : c.status === "proximo"
                              ? "bg-amber-500"
                              : "bg-red-500",
                      )}
                      style={{ width: `${realPct}%` }}
                      title={`Realizado: ${fmtBRL(c.realizado)}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé compacto */}
        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-3 rounded-full bg-slate-400/80" /> Meta
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-3 rounded-full bg-primary" /> Realizado
            </span>
          </div>
          <span>3 categorias</span>
        </div>
      </div>

      {/* Modal Expandido */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <div>
              <DialogTitle className="text-base font-semibold">
                Meta e Atingimento por Categoria (Silver, Black e Gold)
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comparativo de metas e faturamento realizado em barras horizontais
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(false)}
              className="h-8 gap-1.5"
            >
              <Minimize2 className="h-4 w-4" /> Retrair
            </Button>
          </DialogHeader>

          {/* Gráfico Recharts Expandido */}
          <div className="h-[260px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={categoriesData}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis
                  type="number"
                  tickFormatter={fmtCompactBRL}
                  tickLine={false}
                  axisLine={false}
                  className="text-xs text-muted-foreground"
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  className="text-xs font-semibold"
                  width={60}
                />
                <Tooltip
                  formatter={(val: unknown, name: unknown) => [
                    fmtBRL(Number(val)),
                    name === "metaAtual" ? "Meta Atual" : "Faturamento Realizado",
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                  }}
                />
                <Bar
                  dataKey="metaAtual"
                  name="Meta Atual"
                  fill="#94a3b8"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                />
                <Bar
                  dataKey="realizado"
                  name="Faturamento Realizado"
                  fill="#0ea5e9"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela analítica no modal expandido */}
          <div className="mt-4 rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-2.5 text-left">Categoria</th>
                  <th className="px-4 py-2.5 text-right">Clientes</th>
                  <th className="px-4 py-2.5 text-right">Meta Atual</th>
                  <th className="px-4 py-2.5 text-right">Realizado</th>
                  <th className="px-4 py-2.5 text-right">Atingimento</th>
                  <th className="px-4 py-2.5 text-center">Farol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {categoriesData.map((c) => (
                  <tr key={c.key} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{c.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {c.clientes}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {fmtBRL(c.metaAtual)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                      {fmtBRL(c.realizado)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {c.atingimento != null ? fmtPct(c.atingimento) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-semibold",
                          c.status ? FAROL_CELL_CLASS[c.status] : "bg-muted text-muted-foreground",
                        )}
                      >
                        {c.status ? FAROL_LABEL[c.status] : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TopRepsMetasChart({ facts }: { facts: readonly MetasBiFact[] }) {
  const [expanded, setExpanded] = useState(false);

  const topReps = useMemo(() => {
    const all = aggregateMetasBi(facts, "representante");
    return all
      .filter((r) => r.key !== "__sem_rep__" && r.label !== "Sem representante")
      .sort((a, b) => b.realizado - a.realizado || b.metaAtual - a.metaAtual)
      .slice(0, 10);
  }, [facts]);

  const maxReal = Math.max(...topReps.map((r) => Math.max(r.metaAtual, r.realizado)), 1);

  return (
    <>
      <div className="flex h-full flex-1 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Meta por Top 10 Representantes
            </p>
            <p className="text-[11px] text-muted-foreground">Maiores faturamentos</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(true)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="Expandir ranking completo"
          >
            <Maximize2 className="mr-1 h-3.5 w-3.5" /> Expandir
          </Button>
        </div>

        {/* Lista compacta com barras horizontais dos top reps */}
        <div className="my-1.5 space-y-1.5 overflow-y-auto max-h-[160px] pr-1">
          {topReps.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhum dado disponível.
            </p>
          ) : (
            topReps.map((r, i) => {
              const realPct = Math.min(100, (r.realizado / maxReal) * 100);
              const metaPct = Math.min(100, (r.metaAtual / maxReal) * 100);
              const barColor = `#${FAROL_HEX[statusFromRatio(r.atingimento) ?? "sem_compra"]}`;

              return (
                <div key={r.key} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="truncate max-w-[130px] font-medium" title={r.label}>
                      {i + 1}. {r.label}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] tabular-nums">
                      <span className="font-semibold text-foreground">
                        {fmtCompactBRL(r.realizado)}
                      </span>
                      <span className="text-muted-foreground">/ {fmtCompactBRL(r.metaAtual)}</span>
                      {r.atingimento != null && (
                        <span className="text-[9px] text-muted-foreground">
                          ({fmtPct(r.atingimento)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-slate-400/50"
                      style={{ width: `${metaPct}%` }}
                    />
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
                      style={{ width: `${realPct}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé compacto */}
        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
          <span className="truncate">
            Top 10: {fmtBRL(topReps.reduce((acc, r) => acc + r.realizado, 0))}
          </span>
          <span className="shrink-0">{topReps.length} representantes</span>
        </div>
      </div>

      {/* Modal Expandido */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <div>
              <DialogTitle className="text-base font-semibold">
                Ranking Top 10 Representantes em Faturamento vs Meta
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Os 10 maiores representantes por faturamento no período selecionado
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(false)}
              className="h-8 gap-1.5"
            >
              <Minimize2 className="h-4 w-4" /> Retrair
            </Button>
          </DialogHeader>

          {/* Gráfico Recharts Horizontal */}
          <div className="h-[360px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={topReps.map((r, idx) => ({
                  ...r,
                  rankName: `#${idx + 1} ${r.label}`,
                }))}
                margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
              >
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis
                  type="number"
                  tickFormatter={fmtCompactBRL}
                  tickLine={false}
                  axisLine={false}
                  className="text-xs text-muted-foreground"
                />
                <YAxis
                  type="category"
                  dataKey="rankName"
                  tickLine={false}
                  axisLine={false}
                  className="text-xs font-medium"
                  width={120}
                />
                <Tooltip
                  formatter={(val: unknown, name: unknown) => [
                    fmtBRL(Number(val)),
                    name === "metaAtual" ? "Meta Atual" : "Faturamento Realizado",
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                  }}
                />
                <Bar
                  dataKey="metaAtual"
                  name="Meta Atual"
                  fill="#94a3b8"
                  radius={[0, 4, 4, 0]}
                  barSize={12}
                />
                <Bar
                  dataKey="realizado"
                  name="Faturamento Realizado"
                  radius={[0, 4, 4, 0]}
                  barSize={12}
                >
                  {topReps.map((r) => (
                    <Cell
                      key={r.key}
                      fill={`#${FAROL_HEX[statusFromRatio(r.atingimento) ?? "sem_compra"]}`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela analítica no modal expandido */}
          <div className="mt-4 rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2.5 text-center w-12">#</th>
                  <th className="px-4 py-2.5 text-left">Representante</th>
                  <th className="px-4 py-2.5 text-right">Clientes</th>
                  <th className="px-4 py-2.5 text-right">Faturamento Realizado</th>
                  <th className="px-4 py-2.5 text-right">Meta Atual</th>
                  <th className="px-4 py-2.5 text-right">Atingimento</th>
                  <th className="px-4 py-2.5 text-center">Farol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {topReps.map((r, idx) => {
                  const status = statusFromRatio(r.atingimento);
                  return (
                    <tr key={r.key} className="hover:bg-muted/20">
                      <td className="px-3 py-2.5 text-center font-bold text-muted-foreground">
                        {idx + 1}º
                      </td>
                      <td className="px-4 py-2.5 font-medium">{r.label}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {r.clientes}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                        {fmtBRL(r.realizado)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                        {fmtBRL(r.metaAtual)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {r.atingimento != null ? fmtPct(r.atingimento) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-semibold",
                            status ? FAROL_CELL_CLASS[status] : "bg-muted text-muted-foreground",
                          )}
                        >
                          {status ? FAROL_LABEL[status] : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
