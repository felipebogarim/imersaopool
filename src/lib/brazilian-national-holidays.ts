import { isSameDay, subDays } from "date-fns";

const FIXED_HOLIDAYS = [
  { month: 0, day: 1, name: "Confraternização Universal" },
  { month: 3, day: 21, name: "Tiradentes" },
  { month: 4, day: 1, name: "Dia do Trabalho" },
  { month: 8, day: 7, name: "Independência do Brasil" },
  { month: 9, day: 12, name: "Nossa Senhora Aparecida" },
  { month: 10, day: 2, name: "Finados" },
  { month: 10, day: 15, name: "Proclamação da República" },
  { month: 11, day: 25, name: "Natal" },
] as const;

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getBrazilianNationalHoliday(date: Date) {
  const year = date.getFullYear();

  if (isSameDay(date, subDays(easterSunday(year), 2))) return "Paixão de Cristo";
  if (year >= 2024 && date.getMonth() === 10 && date.getDate() === 20) {
    return "Consciência Negra";
  }

  return (
    FIXED_HOLIDAYS.find(
      (holiday) => holiday.month === date.getMonth() && holiday.day === date.getDate(),
    )?.name ?? null
  );
}
