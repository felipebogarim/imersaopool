import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgendaEvent } from "@/lib/agenda-types";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function eventsForDay(events: AgendaEvent[], date: Date) {
  return events
    .filter((event) => isSameDay(new Date(event.starts_at), date))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function EventButton({
  event,
  currentUserId,
  compact = false,
  onSelect,
}: {
  event: AgendaEvent;
  currentUserId: string;
  compact?: boolean;
  onSelect: (event: AgendaEvent) => void;
}) {
  const invited = event.owner_id !== currentUserId;
  return (
    <button
      type="button"
      title={`${format(new Date(event.starts_at), "HH:mm")} · ${event.title}`}
      onClick={(eventClick) => {
        eventClick.stopPropagation();
        onSelect(event);
      }}
      className={cn(
        "w-full overflow-hidden rounded-md border px-2 py-1.5 text-left transition hover:brightness-95",
        invited
          ? "border-warning/50 bg-warning/15 text-foreground"
          : "border-primary/40 bg-primary/12 text-foreground",
      )}
    >
      <span className={cn("block truncate font-medium", compact ? "text-[11px]" : "text-xs")}>
        {event.title}
      </span>
      {!compact && (
        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock3 className="h-3 w-3" /> {format(new Date(event.starts_at), "HH:mm")} ·{" "}
          {event.duration_minutes} min
        </span>
      )}
    </button>
  );
}

export function MonthCalendar({
  month,
  events,
  currentUserId,
  onSelectDay,
  onSelectEvent,
  showTitle = false,
}: {
  month: Date;
  events: AgendaEvent[];
  currentUserId: string;
  onSelectDay: (date: Date) => void;
  onSelectEvent: (event: AgendaEvent) => void;
  showTitle?: boolean;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  });

  return (
    <section className="min-w-[540px] overflow-hidden rounded-lg border bg-card">
      {showTitle && (
        <h3 className="border-b px-3 py-2 text-center text-sm font-semibold capitalize">
          {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
        </h3>
      )}
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground"
          >
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = eventsForDay(events, day);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                "min-h-32 cursor-pointer border-b border-r p-2 text-left transition hover:bg-accent/40",
                index % 7 === 6 && "border-r-0",
                !isSameMonth(day, month) && "bg-muted/25 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "mb-2 inline-grid h-7 w-7 place-items-center rounded-full text-xs font-semibold",
                  isToday(day) && "bg-primary text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </span>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventButton
                    key={event.id}
                    event={event}
                    currentUserId={currentUserId}
                    compact
                    onSelect={onSelectEvent}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <Badge variant="secondary" className="text-[10px]">
                    +{dayEvents.length - 3} compromissos
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
