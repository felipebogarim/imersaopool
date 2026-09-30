import { describe, expect, it } from "vitest";
import { getBrazilianNationalHoliday } from "./brazilian-national-holidays";

describe("feriados nacionais brasileiros", () => {
  it.each([
    [new Date(2026, 0, 1), "Confraternização Universal"],
    [new Date(2026, 3, 3), "Paixão de Cristo"],
    [new Date(2026, 3, 21), "Tiradentes"],
    [new Date(2026, 4, 1), "Dia do Trabalho"],
    [new Date(2026, 8, 7), "Independência do Brasil"],
    [new Date(2026, 9, 12), "Nossa Senhora Aparecida"],
    [new Date(2026, 10, 2), "Finados"],
    [new Date(2026, 10, 15), "Proclamação da República"],
    [new Date(2026, 10, 20), "Consciência Negra"],
    [new Date(2026, 11, 25), "Natal"],
  ])("identifica %s", (date, expected) => {
    expect(getBrazilianNationalHoliday(date)).toBe(expected);
  });

  it("não marca pontos facultativos como feriados nacionais", () => {
    expect(getBrazilianNationalHoliday(new Date(2026, 1, 17))).toBeNull();
    expect(getBrazilianNationalHoliday(new Date(2026, 5, 4))).toBeNull();
  });

  it("calcula a Paixão de Cristo em anos diferentes", () => {
    expect(getBrazilianNationalHoliday(new Date(2027, 2, 26))).toBe("Paixão de Cristo");
  });

  it("aplica a Consciência Negra nacionalmente a partir de 2024", () => {
    expect(getBrazilianNationalHoliday(new Date(2023, 10, 20))).toBeNull();
    expect(getBrazilianNationalHoliday(new Date(2024, 10, 20))).toBe("Consciência Negra");
  });
});
