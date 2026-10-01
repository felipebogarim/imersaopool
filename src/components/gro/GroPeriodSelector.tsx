import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { periodKind } from "@/lib/gro-nr1";

export type GroPeriod = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: string;
  consultant_id?: string | null;
};

const STORAGE_KEY = "gro:selected-periods";

export function GroPeriodSelector({
  periods,
  value,
  onChange,
}: {
  periods: GroPeriod[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = periods.filter((period) => periodKind(period) === "atual");

  useEffect(() => {
    if (value.length || !periods.length) return;
    const stored = localStorage.getItem(STORAGE_KEY)?.split(",").filter(Boolean) ?? [];
    const valid = stored.filter((id) => periods.some((period) => period.id === id));
    onChange(valid.length ? valid : [current[0]?.id ?? periods[0].id]);
  }, [current, onChange, periods, value.length]);

  useEffect(() => {
    if (value.length) localStorage.setItem(STORAGE_KEY, value.join(","));
  }, [value]);

  const label = useMemo(() => {
    if (value.length === periods.length && periods.length > 1) return "Todos os períodos";
    const names = periods
      .filter((period) => value.includes(period.id))
      .map((period) => period.name);
    if (names.length > 2) return `${names.length} períodos selecionados`;
    return names.join(" + ") || "Selecionar período";
  }, [periods, value]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  }

  function selectKind(kind: "atual" | "anterior" | "programado" | "todos") {
    const ids =
      kind === "todos"
        ? periods.map((period) => period.id)
        : periods.filter((period) => periodKind(period) === kind).map((period) => period.id);
    if (ids.length) onChange(ids);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-auto min-h-10 w-full justify-between gap-3 sm:w-auto sm:min-w-56"
        >
          <span className="flex min-w-0 items-center gap-2 text-left">
            <CalendarRange className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                Período
              </span>
              <span className="block truncate text-sm">{label}</span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] p-3">
        <div className="grid grid-cols-2 gap-1 border-b pb-3">
          <Button size="sm" variant="ghost" onClick={() => selectKind("atual")}>
            Período atual
          </Button>
          <Button size="sm" variant="ghost" onClick={() => selectKind("anterior")}>
            Anteriores
          </Button>
          <Button size="sm" variant="ghost" onClick={() => selectKind("programado")}>
            Programados
          </Button>
          <Button size="sm" variant="ghost" onClick={() => selectKind("todos")}>
            Todos os períodos
          </Button>
        </div>
        <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
          {periods.map((period) => (
            <label
              key={period.id}
              className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted"
            >
              <Checkbox
                checked={value.includes(period.id)}
                onCheckedChange={() => toggle(period.id)}
              />
              <span className="min-w-0 text-sm">
                <span className="block font-medium">{period.name}</span>
                <span className="text-xs capitalize text-muted-foreground">
                  {periodKind(period)}
                </span>
              </span>
            </label>
          ))}
          {!periods.length && (
            <p className="p-3 text-center text-sm text-muted-foreground">
              Nenhum período cadastrado.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
