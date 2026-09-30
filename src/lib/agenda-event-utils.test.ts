import { describe, expect, it } from "vitest";
import {
  agendaEventPeriodLabel,
  agendaEventTimeOnDay,
  agendaEventTypeLabel,
  eventOccursOnDay,
  eventsForAgendaDay,
} from "./agenda-event-utils";
import type { AgendaEvent } from "./agenda-types";

function event(overrides: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: "event-1",
    owner_id: "owner-1",
    company_id: "company-1",
    title: "Imersão comercial",
    starts_at: "2026-12-01T09:00:00.000Z",
    ends_at: "2026-12-03T18:00:00.000Z",
    event_type: "imersao",
    duration_minutes: 3_420,
    details: null,
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("períodos dos eventos da agenda", () => {
  it("mostra um evento em todos os dias abrangidos", () => {
    const multiDay = event();

    expect(eventOccursOnDay(multiDay, new Date("2026-11-30T12:00:00.000Z"))).toBe(false);
    expect(eventOccursOnDay(multiDay, new Date("2026-12-01T12:00:00.000Z"))).toBe(true);
    expect(eventOccursOnDay(multiDay, new Date("2026-12-02T12:00:00.000Z"))).toBe(true);
    expect(eventOccursOnDay(multiDay, new Date("2026-12-03T12:00:00.000Z"))).toBe(true);
    expect(eventOccursOnDay(multiDay, new Date("2026-12-04T12:00:00.000Z"))).toBe(false);
  });

  it("inclui eventos iniciados antes do dia consultado", () => {
    expect(eventsForAgendaDay([event()], new Date("2026-12-02T12:00:00.000Z"))).toHaveLength(1);
  });

  it("formata períodos de um ou vários dias", () => {
    expect(agendaEventPeriodLabel(event())).toBe("1 dez, 09:00 — 3 dez, 18:00");
    expect(
      agendaEventPeriodLabel(event({ ends_at: "2026-12-01T10:30:00.000Z", duration_minutes: 90 })),
    ).toBe("1 de dezembro, 09:00–10:30");
  });

  it("identifica início, continuidade e fim em cada dia", () => {
    const multiDay = event();

    expect(agendaEventTimeOnDay(multiDay, new Date("2026-12-01T12:00:00.000Z"))).toBe(
      "Início 09:00",
    );
    expect(agendaEventTimeOnDay(multiDay, new Date("2026-12-02T12:00:00.000Z"))).toBe(
      "Em andamento",
    );
    expect(agendaEventTimeOnDay(multiDay, new Date("2026-12-03T12:00:00.000Z"))).toBe("Fim 18:00");
  });

  it("traduz os tipos disponíveis", () => {
    expect(agendaEventTypeLabel("imersao")).toBe("Imersão");
    expect(agendaEventTypeLabel("reuniao")).toBe("Reunião");
    expect(agendaEventTypeLabel("outro")).toBe("Outro");
  });
});
