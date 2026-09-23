import { Cell, Pie, PieChart, Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DirectorResponsibleCount, DirectorStatusCount } from "@/lib/director-bi";

const STATUS_COLOR: Record<DirectorStatusCount["bucket"], string> = {
  in_progress: "hsl(217 91% 60%)",
  todo: "hsl(220 9% 70%)",
  completed: "hsl(152 60% 45%)",
  overdue: "hsl(0 72% 55%)",
};

const statusConfig: ChartConfig = {
  in_progress: { label: "Em andamento", color: STATUS_COLOR.in_progress },
  todo: { label: "A Fazer", color: STATUS_COLOR.todo },
  completed: { label: "Concluídas", color: STATUS_COLOR.completed },
  overdue: { label: "Atrasadas", color: STATUS_COLOR.overdue },
};

function pct(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

export function StatusDonutChart({ data }: { data: DirectorStatusCount[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="rounded-xl border bg-card p-3">
      <h3 className="text-sm font-semibold">Status das ações</h3>
      <p className="text-xs text-muted-foreground">Distribuição das ações por status</p>
      <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row">
        <ChartContainer config={statusConfig} className="mx-auto aspect-square h-[130px] w-[130px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={38}
              outerRadius={60}
              strokeWidth={2}
            >
              {data.map((item) => (
                <Cell key={item.bucket} fill={STATUS_COLOR[item.bucket]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="relative -mt-[90px] flex flex-col items-center sm:absolute sm:left-[65px] sm:mt-0">
          <span className="text-lg font-bold tabular-nums">{total}</span>
          <span className="text-[10px] text-muted-foreground">ações</span>
        </div>
        <ul className="w-full flex-1 space-y-1 text-sm">
          {data.map((item) => (
            <li key={item.bucket} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_COLOR[item.bucket] }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {item.value} <span className="text-xs">{pct(item.value, total)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const responsibleConfig: ChartConfig = {
  value: { label: "Ações", color: "hsl(217 91% 60%)" },
};

export function ResponsibleBarChart({ data }: { data: DirectorResponsibleCount[] }) {
  const top = data.slice(0, 8);
  return (
    <div className="rounded-xl border bg-card p-3">
      <h3 className="text-sm font-semibold">Ações por responsável</h3>
      <p className="text-xs text-muted-foreground">Total de ações atribuídas a cada pessoa</p>
      {top.length ? (
        <ChartContainer
          config={responsibleConfig}
          className="mt-2 aspect-auto w-full"
          style={{ height: Math.max(top.length * 26, 80) }}
        >
          <BarChart
            data={top}
            layout="vertical"
            margin={{ top: 0, bottom: 0, left: 8, right: 24 }}
            barCategoryGap={6}
          >
            <YAxis
              dataKey="responsible"
              type="category"
              tickLine={false}
              axisLine={false}
              width={100}
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
          Sem ações atribuídas ainda.
        </p>
      )}
    </div>
  );
}
