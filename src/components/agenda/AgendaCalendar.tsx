import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, Clock3, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgendaEvent, AgendaView } from "@/lib/agenda-types";

type Props = {
  view: AgendaView;
  cursor: Date;
  events: AgendaEvent[];
  currentUserId: string;
  onSelectDay: (date: Date) => void;
  onSelectEvent: (event: AgendaEvent) => void;
};

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function eventsForDay(events: AgendaEvent[], date: Date) {
  return events
    .filter((event) => isSameDay(new Date(event.starts_at), date))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

function EventButton({ event, currentUserId, compact = false, onSelect }: {
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
      onClick={(e) => { e.stopPropagation(); onSelect(event); }}
      className={cn(
        "w-full overflow-hidden rounded-md border px-2 py-1.5 text-left transition hover:brightness-95",
        invited ? "border-warning/50 bg-warning/15 text-foreground" : "border-primary/40 bg-primary/12 text-foreground",
      )}
    >
      <span className={cn("block truncate font-medium", compact ? "text-[11px]" : "text-xs")}>{event.title}</span>
      {!compact && (
        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock3 className="h-3 w-3" /> {format(new Date(event.starts_at), "HH:mm")} · {event.duration_minutes} min
        </span>
      )}
    </button>
  );
}

function EmptyDay({ onAdd }: { onAdd: () => void }) {
  return (
    <Button variant="ghost" className="h-20 w-full border border-dashed text-muted-foreground" onClick={onAdd}>
      <CalendarPlus /> Adicionar compromisso
    </Button>
  );
}

export function AgendaCalendar({ view, cursor, events, currentUserId, onSelectDay, onSelectEvent }: Props) {
  if (view === "day") {
    const dayEvents = eventsForDay(events, cursor);
    return (
      <section className="min-h-[540px] rounded-lg border bg-card">
        <header className="border-b px-5 py-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{format(cursor, "EEEE", { locale: ptBR })}</p>
          <h2 className="text-xl font-semibold">{format(cursor, "d 'de' MMMM", { locale: ptBR })}</h2>
        </header>
        <div className="space-y-3 p-4 sm:p-5">
          {dayEvents.length === 0 ? <EmptyDay onAdd={() => onSelectDay(cursor)} /> : dayEvents.map((event) => (
            <button
              type="button"
              key={event.id}
              onClick={() => onSelectEvent(event)}
              className={cn(
                "grid w-full gap-3 rounded-lg border p-4 text-left transition hover:shadow-sm sm:grid-cols-[90px_minmax(0,1fr)_auto]",
                event.owner_id === currentUserId ? "border-primary/35 bg-primary/8" : "border-warning/40 bg-warning/10",
              )}
            >
              <span className="font-semibold">{format(new Date(event.starts_at), "HH:mm")}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{event.title}</span>
                {event.details && <span className="mt-1 block line-clamp-2 text-sm text-muted-foreground">{event.details}</span>}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" /> {event.duration_minutes} min
              </span>
            </button>
          ))}
          {dayEvents.length > 0 && (
            <Button variant="outline" className="w-full border-dashed" onClick={() => onSelectDay(cursor)}>
              <CalendarPlus /> Adicionar outro compromisso
            </Button>
          )}
        </div>
      </section>
    );
  }

  if (view === "week") {
    const days = eachDayOfInterval({
      start: startOfWeek(cursor, { weekStartsOn: 0 }),
      end: endOfWeek(cursor, { weekStartsOn: 0 }),
    });
    return (
      <div className="overflow-x-auto rounded-lg border bg-card">
        <div className="grid min-w-[840px] grid-cols-7 divide-x">
          {days.map((day) => {
            const dayEvents = eventsForDay(events, day);
            return (
              <section key={day.toISOString()} className="min-h-[560px]">
                <button
                  type="button"
                  onClick={() => onSelectDay(day)}
                  className={cn("w-full border-b px-2 py-3 text-center hover:bg-accent", isToday(day) && "bg-primary/10")}
                >
                  <span className="block text-[11px] font-semibold uppercase text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</span>
                  <span className={cn("mt-1 inline-grid h-8 w-8 place-items-center rounded-full text-sm font-semibold", isToday(day) && "bg-primary text-primary-foreground")}>{format(day, "d")}</span>
                </button>
                <div className="space-y-2 p-2">
                  {dayEvents.map((event) => <EventButton key={event.id} event={event} currentUserId={currentUserId} onSelect={onSelectEvent} />)}
                  {dayEvents.length === 0 && <p className="py-5 text-center text-xs text-muted-foreground">Livre</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "year") {
    const months = Array.from({ length: 12 }, (_, index) => addMonths(startOfYear(cursor), index));
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {months.map((month) => {
          const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
          const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
          const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
          return (
            <section key={month.toISOString()} className="rounded-lg border bg-card p-3">
              <button type="button" className="mb-3 w-full text-left font-semibold capitalize hover:text-primary" onClick={() => onSelectDay(month)}>
                {format(month, "MMMM", { locale: ptBR })}
              </button>
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((weekday) => <span key={weekday} className="pb-1 text-[10px] font-semibold uppercase text-muted-foreground">{weekday.slice(0, 1)}</span>)}
                {days.map((day) => {
                  const count = eventsForDay(events, day).length;
                  return (
                    <button
                      type="button"
                      key={day.toISOString()}
                      onClick={() => onSelectDay(day)}
                      className={cn(
                        "relative aspect-square rounded text-xs hover:bg-accent",
                        !isSameMonth(day, month) && "text-muted-foreground/40",
                        isToday(day) && "bg-primary text-primary-foreground hover:bg-primary/90",
                      )}
                    >
                      {format(day, "d")}
                      {count > 0 && <span className={cn("absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full", isToday(day) ? "bg-primary-foreground" : "bg-primary")} />}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  const monthStart = startOfMonth(cursor);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
  });
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className="grid min-w-[760px] grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((weekday) => <div key={weekday} className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{weekday}</div>)}
      </div>
      <div className="grid min-w-[760px] grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = eventsForDay(events, day);
          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                "min-h-32 border-b border-r p-2 text-left transition hover:bg-accent/40",
                index % 7 === 6 && "border-r-0",
                !isSameMonth(day, cursor) && "bg-muted/25 text-muted-foreground",
              )}
            >
              <span className={cn("mb-2 inline-grid h-7 w-7 place-items-center rounded-full text-xs font-semibold", isToday(day) && "bg-primary text-primary-foreground")}>{format(day, "d")}</span>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => <EventButton key={event.id} event={event} currentUserId={currentUserId} compact onSelect={onSelectEvent} />)}
                {dayEvents.length > 3 && <Badge variant="secondary" className="text-[10px]">+{dayEvents.length - 3} compromissos</Badge>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function periodTitle(view: AgendaView, cursor: Date) {
  if (view === "day") return format(cursor, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  if (view === "week") {
    const start = startOfWeek(cursor, { weekStartsOn: 0 });
    const end = endOfWeek(cursor, { weekStartsOn: 0 });
    return `${format(start, "d MMM", { locale: ptBR })} — ${format(end, "d MMM yyyy", { locale: ptBR })}`;
  }
  if (view === "year") return format(startOfYear(cursor), "yyyy");
  return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
}

export function moveCursor(view: AgendaView, cursor: Date, direction: -1 | 1) {
  if (view === "day") return addDays(cursor, direction);
  if (view === "week") return addWeeks(cursor, direction);
  if (view === "year") return addYears(cursor, direction);
  return addMonths(cursor, direction);
}

export function createStartsAt(date: Date) {
  const start = startOfDay(date);
  start.setHours(9, 0, 0, 0);
  return start.toISOString();
}

export function visibleRange(view: AgendaView, cursor: Date) {
  if (view === "day") return { start: startOfDay(cursor), end: addDays(startOfDay(cursor), 1) };
  if (view === "week") return { start: startOfWeek(cursor, { weekStartsOn: 0 }), end: addDays(endOfWeek(cursor, { weekStartsOn: 0 }), 1) };
  if (view === "year") return { start: startOfYear(cursor), end: addDays(endOfYear(cursor), 1) };
  return { start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }), end: addDays(endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }), 1) };
}