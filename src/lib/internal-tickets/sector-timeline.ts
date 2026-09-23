import type { TicketStatus } from "./status";

/**
 * Combina o histórico de paradas de setor (internal_ticket_sector_stops)
 * com o log de eventos (internal_ticket_events) pra responder "por onde
 * passou, quanto tempo ficou e qual status" — sem exigir que o backend
 * grave o status junto de cada parada: o status de uma parada é o último
 * to_status de um evento cujo created_at caiu dentro de [entered_at, saída].
 */

export type SectorStopInput = { sectorId: string; enteredAt: Date; leftAt: Date | null };
export type StatusEventInput = { toStatus: TicketStatus | null; createdAt: Date };

export type SectorTimelineEntry = {
  sectorId: string;
  enteredAt: Date;
  leftAt: Date | null;
  durationMinutes: number;
  statusAtEnd: TicketStatus | null;
  current: boolean;
};

export function buildSectorTimeline(
  stops: SectorStopInput[],
  events: StatusEventInput[],
  now: Date = new Date(),
): SectorTimelineEntry[] {
  return [...stops]
    .sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime())
    .map((stop) => {
      const end = stop.leftAt ?? now;
      const statusEvents = events
        .filter((e) => e.toStatus && e.createdAt >= stop.enteredAt && e.createdAt <= end)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return {
        sectorId: stop.sectorId,
        enteredAt: stop.enteredAt,
        leftAt: stop.leftAt,
        durationMinutes: (end.getTime() - stop.enteredAt.getTime()) / 60_000,
        statusAtEnd: statusEvents[0]?.toStatus ?? null,
        current: stop.leftAt === null,
      };
    });
}
