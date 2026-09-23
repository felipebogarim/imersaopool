import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { PeriodBucket } from "@/lib/internal-tickets/dashboard-metrics";

const chartConfig: ChartConfig = {
  value: { label: "Tickets criados", color: "hsl(217 91% 60%)" },
};

export function TrendChart({ buckets }: { buckets: PeriodBucket[] }) {
  const data = buckets.map((b) => ({
    label: b.periodStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    value: b.count,
  }));
  return (
    <div className="rounded-xl border bg-card p-3">
      <h3 className="text-sm font-semibold">Evolução por período</h3>
      <p className="text-xs text-muted-foreground">Tickets criados por semana</p>
      <ChartContainer config={chartConfig} className="mt-2 aspect-auto h-[180px] w-full">
        <BarChart data={data} margin={{ top: 8, bottom: 0, left: 0, right: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis hide />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={4} barSize={20} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
