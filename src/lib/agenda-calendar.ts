import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AgendaView } from "@/lib/agenda-types";

export function periodTitle(view: AgendaView, cursor: Date) {
  if (view === "day") return format(cursor, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  if (view === "week") {
    const start = startOfWeek(cursor, { weekStartsOn: 0 });
    const end = endOfWeek(cursor, { weekStartsOn: 0 });
    return `${format(start, "d MMM", { locale: ptBR })} — ${format(end, "d MMM yyyy", { locale: ptBR })}`;
  }
  if (view === "bimonth") {
    const nextMonth = addMonths(cursor, 1);
    const sameYear = cursor.getFullYear() === nextMonth.getFullYear();
    return sameYear
      ? `${format(cursor, "MMMM", { locale: ptBR })} — ${format(nextMonth, "MMMM 'de' yyyy", { locale: ptBR })}`
      : `${format(cursor, "MMMM 'de' yyyy", { locale: ptBR })} — ${format(nextMonth, "MMMM 'de' yyyy", { locale: ptBR })}`;
  }
  if (view === "year") return format(startOfYear(cursor), "yyyy");
  return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
}

export function moveCursor(view: AgendaView, cursor: Date, direction: -1 | 1) {
  if (view === "day") return addDays(cursor, direction);
  if (view === "week") return addWeeks(cursor, direction);
  if (view === "bimonth") return addMonths(cursor, direction * 2);
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
  if (view === "week") {
    return {
      start: startOfWeek(cursor, { weekStartsOn: 0 }),
      end: addDays(endOfWeek(cursor, { weekStartsOn: 0 }), 1),
    };
  }
  if (view === "bimonth") {
    const nextMonth = addMonths(cursor, 1);
    return {
      start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
      end: addDays(endOfWeek(endOfMonth(nextMonth), { weekStartsOn: 0 }), 1),
    };
  }
  if (view === "year") return { start: startOfYear(cursor), end: addDays(endOfYear(cursor), 1) };
  return {
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
    end: addDays(endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }), 1),
  };
}
