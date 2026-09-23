import { AlertTriangle, CheckCircle2, Clock, Inbox, MailQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardKpis } from "@/lib/internal-tickets/dashboard-metrics";

function Kpi({
  icon: Icon,
  label,
  value,
  iconClassName,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  iconClassName: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            iconClassName,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold leading-tight tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

export function KpiRow({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <Kpi
        icon={Inbox}
        label="Em aberto"
        value={kpis.open}
        iconClassName="bg-sky-500/15 text-sky-600"
      />
      <Kpi
        icon={CheckCircle2}
        label="Concluídos"
        value={kpis.completed}
        iconClassName="bg-emerald-500/15 text-emerald-600"
      />
      <Kpi
        icon={AlertTriangle}
        label="Atrasados"
        value={kpis.overdue}
        iconClassName="bg-destructive/15 text-destructive"
      />
      <Kpi
        icon={MailQuestion}
        label="Sem 1ª resposta"
        value={kpis.noFirstResponse}
        iconClassName="bg-amber-500/15 text-amber-600"
      />
      <Kpi
        icon={Clock}
        label="Vencem em 24h"
        value={kpis.dueSoon}
        iconClassName="bg-violet-500/15 text-violet-600"
      />
    </div>
  );
}
