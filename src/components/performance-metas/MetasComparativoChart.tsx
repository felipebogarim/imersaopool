// Gráfico principal: duas barras por portfólio (performance atual × meta oficial).
// A meta padrão aparece só para gestor/admin, como linha de referência em 100%.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FAROL_HEX, FAROL_LABEL, statusFromRatio } from "@/lib/performance-farol";
import {
  fmtBRL,
  fmtPoints,
  type ComparativoPoint,
  type MetasVisibility,
} from "@/lib/performance-metas";

const META_COLOR = "hsl(var(--primary))";

export function MetasComparativoChart({
  data,
  vis,
}: {
  data: ComparativoPoint[];
  vis: MetasVisibility;
}) {
  const peak = Math.max(120, ...data.map((d) => Math.max(d.performancePct ?? 0, d.metaPct ?? 0)));
  const step = peak <= 150 ? 25 : peak <= 300 ? 50 : 100;
  const yMax = Math.ceil(peak / step) * step;
  const metaName = vis.verMetaPadrao ? "Meta oficial (% da padrão)" : "Meta oficial (% do total)";

  const chartData = data.map((d) => ({
    ...d,
    perf: d.performancePct ?? 0,
    meta: d.metaPct ?? 0,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Performance atual × meta oficial por portfólio</h2>
        <p className="text-[11px] text-muted-foreground">
          {vis.verMetaPadrao
            ? "Escala em % da meta padrão da categoria · linha tracejada = meta padrão"
            : "Performance em % de atingimento · meta em % do total do cliente"}
        </p>
      </div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={4} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval={0}
              tickLine={false}
              axisLine={false}
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
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              content={<ComparativoTooltip vis={vis} />}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {vis.verMetaPadrao && (
              <ReferenceLine
                y={100}
                stroke="currentColor"
                strokeDasharray="4 4"
                className="text-muted-foreground"
                label={{ value: "Meta padrão", position: "insideTopRight", fontSize: 10 }}
              />
            )}
            <Bar dataKey="perf" name="Performance atual" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {chartData.map((d) => {
                const st = statusFromRatio(
                  d.performancePct == null ? null : d.performancePct / 100,
                );
                return (
                  <Cell
                    key={d.familia}
                    fill={st ? `#${FAROL_HEX[st]}` : "transparent"}
                    stroke={st ? "rgba(0,0,0,0.15)" : "transparent"}
                  />
                );
              })}
            </Bar>
            <Bar
              dataKey="meta"
              name={metaName}
              fill={META_COLOR}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
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
  const st = statusFromRatio(d.performancePct == null ? null : d.performancePct / 100);
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md space-y-1.5">
      <p className="font-semibold">{d.label}</p>
      <div>
        <p className="text-muted-foreground">Performance atual</p>
        <p className="font-medium tabular-nums">
          {d.performancePct == null ? "Sem informação" : fmtPoints(d.performancePct)}
          {st ? ` · ${FAROL_LABEL[st]}` : ""}
        </p>
        {d.performanceValor != null && (
          <p className="text-muted-foreground tabular-nums">
            ≈ {fmtBRL(d.performanceValor)} (estimado sobre a meta padrão)
          </p>
        )}
      </div>
      <div>
        <p className="text-muted-foreground">Meta oficial</p>
        <p className="font-medium tabular-nums">
          {fmtPoints(d.metaPct)} {vis.verMetaPadrao ? "da meta padrão" : "do total"}
        </p>
        <p className="text-muted-foreground tabular-nums">{fmtBRL(d.metaValor)} / mês</p>
      </div>
      {vis.verMetaPadrao && (
        <p className="border-t border-border pt-1 text-muted-foreground tabular-nums">
          Meta padrão: {fmtBRL(d.referenciaValor)}
        </p>
      )}
    </div>
  );
}
