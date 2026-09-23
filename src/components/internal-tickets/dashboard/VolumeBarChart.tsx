import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { VolumeBucket } from "@/lib/internal-tickets/dashboard-metrics";

const chartConfig: ChartConfig = {
  value: { label: "Tickets", color: "hsl(217 91% 60%)" },
};

/** Uma série só (contagem por categoria) → um hue só, sem legenda (o título já nomeia a série). */
export function VolumeBarChart({ title, buckets }: { title: string; buckets: VolumeBucket[] }) {
  const data = buckets.map((b) => ({ label: b.key, value: b.count }));
  return (
    <div className="rounded-xl border bg-card p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
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
        <p className="mt-4 text-center text-sm text-muted-foreground">Sem dados.</p>
      )}
    </div>
  );
}
