import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { SectorDelay } from "@/lib/internal-tickets/dashboard-metrics";

const chartConfig: ChartConfig = {
  value: { label: "Horas até a resolução", color: "hsl(0 72% 55%)" },
};

export function SlowestSectorsChart({
  rows,
  sectorName,
}: {
  rows: SectorDelay[];
  sectorName: (id: string) => string;
}) {
  const data = rows
    .filter((r) => r.avgResolutionMinutes != null)
    .map((r) => ({
      label: sectorName(r.sectorId),
      value: Math.round((r.avgResolutionMinutes ?? 0) / 60),
    }));

  return (
    <div className="rounded-xl border bg-card p-3">
      <h3 className="text-sm font-semibold">Setores com maior demora</h3>
      <p className="text-xs text-muted-foreground">Tempo médio até a resolução (horas)</p>
      {data.length ? (
        <ChartContainer
          config={chartConfig}
          className="mt-2 aspect-auto w-full"
          style={{ height: Math.max(data.length * 28, 80) }}
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, bottom: 0, left: 8, right: 24 }}
            barCategoryGap={6}
          >
            <YAxis
              dataKey="label"
              type="category"
              tickLine={false}
              axisLine={false}
              width={110}
              tick={{ fontSize: 11 }}
              interval={0}
            />
            <XAxis type="number" hide />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={4} barSize={12} />
          </BarChart>
        </ChartContainer>
      ) : (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Nenhum ticket resolvido ainda.
        </p>
      )}
    </div>
  );
}
