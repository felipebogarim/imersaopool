import { describe, expect, it } from "vitest";
import { buildSectorTimeline } from "./sector-timeline";

describe("buildSectorTimeline", () => {
  it("calcula a duração de uma parada fechada e da parada atual (aberta)", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    const stops = [
      {
        sectorId: "engenharia",
        enteredAt: new Date("2026-09-20T00:00:00Z"),
        leftAt: new Date("2026-09-21T00:00:00Z"),
      },
      { sectorId: "cadastro", enteredAt: new Date("2026-09-21T00:00:00Z"), leftAt: null },
    ];
    const timeline = buildSectorTimeline(stops, [], now);
    expect(timeline).toHaveLength(2);
    expect(timeline[0].durationMinutes).toBe(24 * 60);
    expect(timeline[0].current).toBe(false);
    expect(timeline[1].durationMinutes).toBe(2.5 * 24 * 60); // 21/09 00:00 até 23/09 12:00 = 2,5 dias
    expect(timeline[1].current).toBe(true);
  });

  it("ordena as paradas por entered_at mesmo se vierem fora de ordem", () => {
    const stops = [
      { sectorId: "b", enteredAt: new Date("2026-09-21T00:00:00Z"), leftAt: null },
      {
        sectorId: "a",
        enteredAt: new Date("2026-09-20T00:00:00Z"),
        leftAt: new Date("2026-09-21T00:00:00Z"),
      },
    ];
    const timeline = buildSectorTimeline(stops, []);
    expect(timeline.map((t) => t.sectorId)).toEqual(["a", "b"]);
  });

  it("associa o último status alcançado dentro da janela da parada", () => {
    const stops = [
      {
        sectorId: "engenharia",
        enteredAt: new Date("2026-09-20T00:00:00Z"),
        leftAt: new Date("2026-09-21T00:00:00Z"),
      },
    ];
    const events = [
      { toStatus: "recebido_pelo_setor" as const, createdAt: new Date("2026-09-20T01:00:00Z") },
      { toStatus: "em_analise" as const, createdAt: new Date("2026-09-20T02:00:00Z") },
      // fora da janela (depois de left_at) — não deve contar pra essa parada
      { toStatus: "respondido" as const, createdAt: new Date("2026-09-22T00:00:00Z") },
    ];
    const timeline = buildSectorTimeline(stops, events);
    expect(timeline[0].statusAtEnd).toBe("em_analise");
  });

  it("statusAtEnd é null quando nenhum evento caiu na janela", () => {
    const stops = [
      {
        sectorId: "engenharia",
        enteredAt: new Date("2026-09-20T00:00:00Z"),
        leftAt: new Date("2026-09-21T00:00:00Z"),
      },
    ];
    const timeline = buildSectorTimeline(stops, []);
    expect(timeline[0].statusAtEnd).toBeNull();
  });

  it("lista vazia de paradas devolve timeline vazia", () => {
    expect(buildSectorTimeline([], [])).toEqual([]);
  });
});
