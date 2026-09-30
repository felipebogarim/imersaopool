import { addDays, addMinutes, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AgendaEvent, AgendaEventType } from "@/lib/agenda-types";

export const AGENDA_EVENT_TYPES: { value: AgendaEventType; label: string }[] = [
  { value: "imersao", label: "Imersão" },
  { value: "reuniao", label: "Reunião" },
  { value: "outro", label: "Outro" },
];

export function agendaEventTypeLabel(type: AgendaEventType) {
  return AGENDA_EVENT_TYPES.find((item) => item.value === type)?.label ?? "Outro";
}

export function agendaEventEnd(
  event: Pick<AgendaEvent, "starts_at" | "ends_at" | "duration_minutes">,
) {
  const explicitEnd = new Date(event.ends_at);
  if (!Number.isNaN(explicitEnd.getTime())) return explicitEnd;
  return addMinutes(new Date(event.starts_at), event.duration_minutes);
}

export function eventOccursOnDay(event: AgendaEvent, day: Date) {
  const dayStart = startOfDay(day);
  const nextDay = addDays(dayStart, 1);
  return new Date(event.starts_at) < nextDay && agendaEventEnd(event) > dayStart;
}

export function eventsForAgendaDay(events: AgendaEvent[], day: Date) {
  return events
    .filter((event) => eventOccursOnDay(event, day))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function agendaEventPeriodLabel(event: AgendaEvent) {
  const startsAt = new Date(event.starts_at);
  const endsAt = agendaEventEnd(event);
  const sameDay = format(startsAt, "yyyy-MM-dd") === format(endsAt, "yyyy-MM-dd");
  if (sameDay) {
    return `${format(startsAt, "d 'de' MMMM, HH:mm", { locale: ptBR })}–${format(endsAt, "HH:mm")}`;
  }
  return `${format(startsAt, "d MMM, HH:mm", { locale: ptBR })} — ${format(endsAt, "d MMM, HH:mm", { locale: ptBR })}`;
}

export function agendaEventTimeOnDay(event: AgendaEvent, day: Date) {
  const startsAt = new Date(event.starts_at);
  const endsAt = agendaEventEnd(event);
  const startsToday = format(startsAt, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
  const endsToday = format(endsAt, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
  if (startsToday && endsToday) return `${format(startsAt, "HH:mm")}–${format(endsAt, "HH:mm")}`;
  if (startsToday) return `Início ${format(startsAt, "HH:mm")}`;
  if (endsToday) return `Fim ${format(endsAt, "HH:mm")}`;
  return "Em andamento";
}
