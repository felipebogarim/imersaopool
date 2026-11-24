// Gráfico principal: uma barra por portfólio = atingimento sobre a meta oficial, cor do farol.
// Clicar numa barra (ou no rótulo) seleciona o portfólio do painel de edição.
// Metas aparecem só no tooltip; meta padrão apenas para gestor/admin.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { CanonicalFamily } from "@/lib/client-bi-familias";
import { FAROL_HEX, FAROL_LABEL, statusFromRatio } from "@/lib/performance-farol";
import {
  fmtBRL,
  fmtPoints,
  type ComparativoPoint,
  type MetasVisibility,
} from "@/lib/performance-metas";

const statusOf = (pct: number | null) => statusFromRatio(pct == null ? null : pct / 100);

export function MetasComparativoChart({
  data,
  vis,
  selected,
  onSelect,
}: {
  data: ComparativoPoint[];
  vis: MetasVisibility;
  selected: CanonicalFamily;
  onSelect: (familia: CanonicalFamily) => void;
}) {
  const peak = Math.max(120, ...data.map((d) => d.performancePct ?? 0));
  const step = peak <= 150 ? 25 : peak <= 300 ? 50 : 100;
  const yMax = Math.ceil(peak / step) * step;
  const chartData = data.map((d) => ({ ...d, perf: d.performancePct ?? 0 }));

  const selectByLabel = (label: unknown) => {
    const hit = data.find((d) => d.label === label);
    if (hit) onSelect(hit.familia);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Atingimento por portfólio sobre a meta oficial
          <span className="ml-1 font-normal text-muted-foreground">(recalculado ao editar)</span>
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Clique em um portfólio para editar a meta
        </p>
      </div>
      <div className="h-[290px] w-full overflow-x-auto sm:overflow-visible">
        <div className="h-full min-w-[520px] sm:min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barCategoryGap="6%"
              margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
              onClick={(e) => selectByLabel(e?.activeLabel)}
            >
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <ReferenceLine
                y={100}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />
              <XAxis
                dataKey="label"
                interval={0}
                tickLine={false}
                axisLine={false}
                height={32}
                tick={(props) => {
                  const { x, y, payload } = props as {
                    x: number;
                    y: number;
                    payload: { value: string };
                  };
                  const isSel = data.find((d) => d.label === payload.value)?.familia === selected;
                  return (
                    <text
                      x={x}
                      y={y + 14}
                      textAnchor="middle"
                      className={cn(
                        "text-[11px] select-none transition-colors",
                        isSel
                          ? "fill-foreground font-bold"
                          : "fill-muted-foreground font-medium hover:fill-foreground",
                      )}
                      style={{ cursor: "pointer" }}
                      onClick={() => selectByLabel(payload.value)}
                    >
                      {payload.value}
                    </text>
                  );
                }}
              />
              <YAxis
                domain={[0, yMax]}
                ticks={Array.from({ length: yMax / step + 1 }, (_, i) => i * step)}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
                content={<ComparativoTooltip vis={vis} />}
              />
              <Bar dataKey="perf" radius={[6, 6, 0, 0]} maxBarSize={180} style={{ cursor: "pointer" }}>
                {chartData.map((d) => {
                  const st = statusOf(d.performancePct);
                  const isSel = d.familia === selected;
                  return (
                    <Cell
                      key={d.familia}
                      fill={st ? `#${FAROL_HEX[st]}` : "transparent"}
                      fillOpacity={isSel ? 1 : 0.68}
                      stroke={isSel ? "hsl(var(--foreground))" : "transparent"}
                      strokeWidth={isSel ? 2 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ComparativoTooltip({
  active,
  payload,
  vis,
}: {
  active?: boolean;
  payload?: Array<{ payload: ComparativoPoint }>;
  vis: MetasVisibility;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const st = statusOf(d.performancePct);
  return (
    <div className="min-w-[200px] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-semibold">{d.label}</p>
      <Row label="Atingimento s/ meta oficial">
        {d.performancePct == null ? "Sem informação" : fmtPoints(d.performancePct)}
        {st ? <span className="text-muted-foreground"> · {FAROL_LABEL[st]}</span> : null}
      </Row>
      {d.fonte && d.fonte !== "realizado" && d.performancePct != null && (
        <p className="pb-0.5 text-[10px] text-amber-700 dark:text-amber-400">
          {d.fonte === "media"
            ? "Base: média histórica (não é venda realizada)"
            : "Estimado: sem venda realizada nem média histórica"}
        </p>
      )}
      {vis.verMetaPadrao && d.performanceOficialPct != null && (
        <Row label="Atingimento oficial (padrão)">{fmtPoints(d.performanceOficialPct)}</Row>
      )}
      <Row label="Meta oficial (% do total)">{fmtPoints(d.metaPct)}</Row>
      <Row label="Meta oficial (R$)">{fmtBRL(d.metaValor)}</Row>
      {vis.verMetaPadrao && (
        <div className="mt-1 border-t border-border pt-1 text-muted-foreground">
          <Row label="Meta padrão (% do total)">{fmtPoints(d.referenciaPct)}</Row>
          <Row label="Meta padrão (R$)">{fmtBRL(d.referenciaValor)}</Row>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{children}</span>
    </div>
  );
}
