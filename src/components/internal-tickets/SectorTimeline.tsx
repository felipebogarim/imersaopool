import { Badge } from "@/components/ui/badge";
import { formatDurationMinutes } from "@/lib/internal-tickets/sla";
import type { SectorTimelineEntry } from "@/lib/internal-tickets/sector-timeline";
import { TICKET_STATUS_LABEL } from "@/lib/internal-tickets/status";

export function SectorTimeline({
  entries,
  sectorName,
}: {
  entries: SectorTimelineEntry[];
  sectorName: (id: string) => string;
}) {
  if (!entries.length) {
    return <p className="text-xs text-muted-foreground">Sem histórico de setor ainda.</p>;
  }

  return (
    <ol className="space-y-2">
      {entries.map((entry, index) => (
        <li
          key={`${entry.sectorId}-${entry.enteredAt.toISOString()}`}
          className="flex gap-3 text-xs"
        >
          <div className="flex flex-col items-center pt-0.5">
            <span
              className={`h-2 w-2 rounded-full ${entry.current ? "bg-sky-500" : "bg-muted-foreground/40"}`}
            />
            {index < entries.length - 1 && <span className="mt-1 h-full w-px flex-1 bg-border" />}
          </div>
          <div className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{sectorName(entry.sectorId)}</span>
              {entry.current && (
                <Badge
                  variant="outline"
                  className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400"
                >
                  atual
                </Badge>
              )}
              <span className="text-muted-foreground">
                {formatDurationMinutes(entry.durationMinutes)}
              </span>
            </div>
            <p className="text-muted-foreground">
              {entry.enteredAt.toLocaleString("pt-BR")} —{" "}
              {entry.leftAt ? entry.leftAt.toLocaleString("pt-BR") : "agora"}
              {entry.statusAtEnd && ` · ${TICKET_STATUS_LABEL[entry.statusAtEnd]}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
