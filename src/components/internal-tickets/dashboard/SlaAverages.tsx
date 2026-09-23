function formatMinutes(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} dias`;
}

function AverageTile({ label, minutes }: { label: string; minutes: number | null }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{formatMinutes(minutes)}</p>
    </div>
  );
}

export function SlaAverages({
  avgFirstResponseMinutes,
  avgResolutionMinutes,
}: {
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <AverageTile label="SLA médio de 1ª resposta" minutes={avgFirstResponseMinutes} />
      <AverageTile label="Tempo médio de resolução" minutes={avgResolutionMinutes} />
    </div>
  );
}
