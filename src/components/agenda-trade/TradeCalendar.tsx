import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, MapPin, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TradeAction, TradeView } from "@/lib/agenda-trade-types";
import { statusMeta, tipoLabel } from "@/lib/agenda-trade-types";

type Props = {
  view: TradeView;
  cursor: Date;
  actions: TradeAction[];
  clientNames: Map<string, string>;
  userNames: Map<string, string>;
  onSelectDay: (date: Date) => void;
  onSelectAction: (action: TradeAction) => void;
};

export function visibleRange(view: TradeView, cursor: Date) {
  if (view === "week") {
    return { start: startOfWeek(cursor, { locale: ptBR }), end: endOfWeek(cursor, { locale: ptBR }) };
  }
  return { start: startOfMonth(cursor), end: endOfMonth(cursor) };
}

export function gridRange(view: TradeView, cursor: Date) {
  if (view === "week") return visibleRange(view, cursor);
  return {
    start: startOfWeek(startOfMonth(cursor), { locale: ptBR }),
    end: endOfWeek(endOfMonth(cursor), { locale: ptBR }),
  };
}

export function moveCursor(view: TradeView, cursor: Date, direction: number) {
  if (view === "week") return addDays(cursor, 7 * direction);
  const next = new Date(cursor);
  next.setMonth(next.getMonth() + direction);
  return next;
}

export function periodTitle(view: TradeView, cursor: Date) {
  if (view === "week") {
    const { start, end } = visibleRange("week", cursor);
    return `${format(start, "dd MMM", { locale: ptBR })} – ${format(end, "dd MMM yyyy", { locale: ptBR })}`;
  }
  return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function actionsForDay(actions: TradeAction[], day: Date) {
  return actions.filter((action) => {
    const start = parseISO(action.data_inicio);
    const end = action.data_fim ? parseISO(action.data_fim) : start;
    return day >= new Date(start.toDateString()) && day <= new Date(end.toDateString());
  });
}

function ActionCard({
  action,
  clientNames,
  userNames,
  onSelect,
}: {
  action: TradeAction;
  clientNames: Map<string, string>;
  userNames: Map<string, string>;
  onSelect: (action: TradeAction) => void;
}) {
  const meta = statusMeta(action.status);
  const clients = (action.clients ?? []).map((c) => clientNames.get(c.client_id) ?? "Cliente").join(", ");
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(action);
      }}
      className="w-full rounded-md border bg-card px-2 py-1.5 text-left text-[11px] leading-tight transition hover:border-primary/50 hover:bg-accent"
    >
      <span className="flex items-center gap-1.5 font-medium">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
        <span className="truncate">{clients || "Sem cliente"}</span>
      </span>
      <span className="mt-0.5 block truncate text-muted-foreground">{tipoLabel(action)}</span>
      {(action.cidade || action.responsavel_id) && (
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-muted-foreground">
          {action.cidade && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3" /> {action.cidade}
            </span>
          )}
          {action.responsavel_id && (
            <span className="flex items-center gap-1 truncate">
              <UserRound className="h-3 w-3" /> {userNames.get(action.responsavel_id) ?? "Responsável"}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

export function TradeCalendar({ view, cursor, actions, clientNames, userNames, onSelectDay, onSelectAction }: Props) {
  if (view === "list") {
    const sorted = [...actions].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
    if (sorted.length === 0) {
      return (
        <div className="grid min-h-60 place-items-center rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Nenhuma ação no período.
        </div>
      );
    }
    return (
      <div className="divide-y rounded-lg border bg-card">
        {sorted.map((action) => {
          const meta = statusMeta(action.status);
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onSelectAction(action)}
              className="flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-accent sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {(action.clients ?? []).map((c) => clientNames.get(c.client_id) ?? "Cliente").join(", ") || "Sem cliente"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {tipoLabel(action)}
                  {action.cidade ? ` · ${action.cidade}` : ""}
                  {action.responsavel_id ? ` · ${userNames.get(action.responsavel_id) ?? ""}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {format(parseISO(action.data_inicio), "dd/MM/yyyy")}
                  {action.horario ? ` ${action.horario}` : ""}
                </span>
                <Badge variant="outline" className={meta.badge}>
                  {meta.label}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  const { start, end } = gridRange(view, cursor);
  const days = eachDayOfInterval({ start, end });

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className="grid min-w-[760px] grid-cols-7 border-b bg-muted/30 text-center text-[11px] font-medium uppercase text-muted-foreground">
        {WEEKDAYS.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>
      <div className="grid min-w-[760px] grid-cols-7">
        {days.map((day) => {
          const dayActions = actionsForDay(actions, day);
          const outside = view === "month" && !isSameMonth(day, cursor);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                "group min-h-[112px] cursor-pointer border-b border-r p-1.5 transition hover:bg-accent/40",
                view === "week" && "min-h-[220px]",
                outside && "bg-muted/20 text-muted-foreground",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full text-xs",
                    isToday(day) && "bg-primary text-primary-foreground font-semibold",
                  )}
                >
                  {format(day, "d")}
                </span>
                <CalendarPlus className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-60" />
              </div>
              <div className="space-y-1">
                {dayActions.slice(0, view === "week" ? 8 : 3).map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    clientNames={clientNames}
                    userNames={userNames}
                    onSelect={onSelectAction}
                  />
                ))}
                {dayActions.length > (view === "week" ? 8 : 3) && (
                  <p className="px-1 text-[11px] text-muted-foreground">
                    +{dayActions.length - (view === "week" ? 8 : 3)} ações
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { isSameDay };
