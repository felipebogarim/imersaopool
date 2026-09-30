import { describe, expect, it } from "vitest";
import { moveCursor, periodTitle, visibleRange } from "@/lib/agenda-calendar";

describe("visualização bimesal da agenda", () => {
  it("avança e retrocede em blocos de dois meses", () => {
    const cursor = new Date(2026, 8, 15);

    expect(moveCursor("bimonth", cursor, 1)).toEqual(new Date(2026, 10, 15));
    expect(moveCursor("bimonth", cursor, -1)).toEqual(new Date(2026, 6, 15));
  });

  it("mostra os dois meses no título, inclusive na troca de ano", () => {
    expect(periodTitle("bimonth", new Date(2026, 8, 15))).toBe("setembro — outubro de 2026");
    expect(periodTitle("bimonth", new Date(2026, 11, 15))).toBe(
      "dezembro de 2026 — janeiro de 2027",
    );
  });

  it("consulta toda a grade do primeiro e do segundo mês", () => {
    const range = visibleRange("bimonth", new Date(2026, 8, 15));

    expect(range.start).toEqual(new Date(2026, 7, 30));
    expect(range.end).toEqual(new Date(2026, 10, 1, 23, 59, 59, 999));
  });
});
