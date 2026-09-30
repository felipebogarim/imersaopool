import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, Clock3, UsersRound } from "lucide-react";
import { EventButton, MonthCalendar } from "@/components/agenda/AgendaMonthCalendar";
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

function EmptyDay({ onAdd }: { onAdd: () => void }) {
  return (
    <Button
      variant="ghost"
      className="h-20 w-full border border-dashed text-muted-foreground"
      onClick={onAdd}
    >
      <CalendarPlus /> Adicionar compromisso
    </Button>
  );
}

export function AgendaCalendar({
  view,
  cursor,
  events,
  currentUserId,
  onSelectDay,
  onSelectEvent,
}: Props) {
  if (view === "day") {
    const dayEvents = eventsForDay(events, cursor);
    return (
      <section className="min-h-[540px] rounded-lg border bg-card">
        <header className="border-b px-5 py-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {format(cursor, "EEEE", { locale: ptBR })}
          </p>
          <h2 className="text-xl font-semibold">
            {format(cursor, "d 'de' MMMM", { locale: ptBR })}
          </h2>
        </header>
        <div className="space-y-3 p-4 sm:p-5">
          {dayEvents.length === 0 ? (
            <EmptyDay onAdd={() => onSelectDay(cursor)} />
          ) : (
            dayEvents.map((event) => (
              <button
                type="button"
                key={event.id}
                onClick={() => onSelectEvent(event)}
                className={cn(
                  "grid w-full gap-3 rounded-lg border p-4 text-left transition hover:shadow-sm sm:grid-cols-[90px_minmax(0,1fr)_auto]",
                  event.owner_id === currentUserId
                    ? "border-primary/35 bg-primary/8"
                    : "border-warning/40 bg-warning/10",
                )}
              >
                <span className="font-semibold">{format(new Date(event.starts_at), "HH:mm")}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{event.title}</span>
                  {event.details && (
                    <span className="mt-1 block line-clamp-2 text-sm text-muted-foreground">
                      {event.details}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" /> {event.duration_minutes} min
                </span>
              </button>
            ))
          )}
          {dayEvents.length > 0 && (
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => onSelectDay(cursor)}
            >
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
                  className={cn(
                    "w-full border-b px-2 py-3 text-center hover:bg-accent",
                    isToday(day) && "bg-primary/10",
                  )}
                >
                  <span className="block text-[11px] font-semibold uppercase text-muted-foreground">
                    {format(day, "EEE", { locale: ptBR })}
                  </span>
                  <span
                    className={cn(
                      "mt-1 inline-grid h-8 w-8 place-items-center rounded-full text-sm font-semibold",
                      isToday(day) && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </button>
                <div className="space-y-2 p-2">
                  {dayEvents.map((event) => (
                    <EventButton
                      key={event.id}
                      event={event}
                      currentUserId={currentUserId}
                      onSelect={onSelectEvent}
                    />
                  ))}
                  {dayEvents.length === 0 && (
                    <p className="py-5 text-center text-xs text-muted-foreground">Livre</p>
                  )}
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
              <button
                type="button"
                className="mb-3 w-full text-left font-semibold capitalize hover:text-primary"
                onClick={() => onSelectDay(month)}
              >
                {format(month, "MMMM", { locale: ptBR })}
              </button>
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((weekday) => (
                  <span
                    key={weekday}
                    className="pb-1 text-[10px] font-semibold uppercase text-muted-foreground"
                  >
                    {weekday.slice(0, 1)}
                  </span>
                ))}
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
                      {count > 0 && (
                        <span
                          className={cn(
                            "absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
                            isToday(day) ? "bg-primary-foreground" : "bg-primary",
                          )}
                        />
                      )}
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

  if (view === "bimonth") {
    const months = [startOfMonth(cursor), addMonths(startOfMonth(cursor), 1)];
    return (
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[1100px] grid-cols-2 gap-4">
          {months.map((month) => (
            <MonthCalendar
              key={month.toISOString()}
              month={month}
              events={events}
              currentUserId={currentUserId}
              onSelectDay={onSelectDay}
              onSelectEvent={onSelectEvent}
              showTitle
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <MonthCalendar
          month={cursor}
          events={events}
          currentUserId={currentUserId}
          onSelectDay={onSelectDay}
          onSelectEvent={onSelectEvent}
        />
      </div>
    </div>
  );
}
