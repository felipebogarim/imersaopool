import { AlertTriangle, CheckCircle2, PlayCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DirectorKpis } from "@/lib/director-bi";

function pct(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  iconClassName,
  barClassName,
  percent,
}: {
  icon: typeof PlayCircle;
  label: string;
  value: number;
  hint: string;
  iconClassName: string;
  barClassName?: string;
  percent?: number;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            iconClassName,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">{label}</span>
            {percent !== undefined && (
              <span className="text-[10px] text-muted-foreground">{percent}%</span>
            )}
          </div>
          <div className="text-3xl font-bold leading-tight tabular-nums">{value}</div>
          <div className="text-[10px] text-muted-foreground">{hint}</div>
          {barClassName !== undefined && percent !== undefined && (
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", barClassName)}
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DirectorKpiRow({ kpis }: { kpis: DirectorKpis }) {
  const { total, inProgress, overdue, completed, activeResponsibles } = kpis;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi
        icon={PlayCircle}
        label="Em andamento"
        value={inProgress}
        hint={`de ${total} ações no total`}
        iconClassName="bg-sky-500/15 text-sky-600"
        barClassName="bg-sky-500"
        percent={pct(inProgress, total)}
      />
      <Kpi
        icon={AlertTriangle}
        label="Atrasadas"
        value={overdue}
        hint={`de ${total} ações no total`}
        iconClassName="bg-destructive/15 text-destructive"
        barClassName="bg-destructive"
        percent={pct(overdue, total)}
      />
      <Kpi
        icon={CheckCircle2}
        label="Concluídas"
        value={completed}
        hint={`de ${total} ações no total`}
        iconClassName="bg-emerald-500/15 text-emerald-600"
        barClassName="bg-emerald-500"
        percent={pct(completed, total)}
      />
      <Kpi
        icon={Users}
        label="Responsáveis ativos"
        value={activeResponsibles}
        hint="pessoas com ações"
        iconClassName="bg-violet-500/15 text-violet-600"
      />
    </div>
  );
}
