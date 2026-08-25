import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown } from "lucide-react";

export type PeriodoValue = {
  label: string;
  inicio: string; // YYYY-MM-DD
  fim: string;    // YYYY-MM-DD
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function lastDay(year: number, month1: number) {
  return new Date(year, month1, 0).getDate();
}

function parseInitial(value?: PeriodoValue | null): { ano: string; meses: number[] } {
  const ano = String(new Date().getFullYear());
  const state = { ano, meses: [] as number[] };
  if (value?.inicio) {
    const [y, m] = value.inicio.split("-").map(Number);
    if (y) state.ano = String(y);
    const mf = value.fim ? Number(value.fim.split("-")[1]) : m;
    if (m) {
      for (let i = m; i <= (mf || m); i++) state.meses.push(i);
    }
  } else if (value?.label) {
    const l = value.label.toLowerCase();
    const yMatch = l.match(/(20\d{2})/);
    if (yMatch) state.ano = yMatch[1];
    MESES.forEach((mes, i) => {
      if (l.includes(mes.toLowerCase())) state.meses.push(i + 1);
    });
  }
  if (!state.meses.length) state.meses = [1, 2, 3, 4, 5, 6];
  return state;
}

function isContiguous(meses: number[]) {
  for (let i = 1; i < meses.length; i++) if (meses[i] !== meses[i - 1] + 1) return false;
  return true;
}

export function buildPeriodoLabel(ano: string, mesesSel: number[]): string {
  const meses = [...mesesSel].sort((a, b) => a - b);
  if (!meses.length) return ano;
  if (meses.length === 12) return `Anual ${ano}`;
  if (meses.length === 1) return `${MESES[meses[0] - 1]} ${ano}`;
  if (isContiguous(meses)) {
    if (meses.length === 6 && meses[0] === 1) return `1º Semestre ${ano}`;
    if (meses.length === 6 && meses[0] === 7) return `2º Semestre ${ano}`;
    return `${MESES[meses[0] - 1]} a ${MESES[meses[meses.length - 1] - 1]} ${ano}`;
  }
  return `${meses.map((m) => MESES_ABREV[m - 1]).join(", ")} ${ano}`;
}

function computeValue(ano: string, mesesSel: number[]): PeriodoValue {
  const y = Number(ano);
  const meses = [...mesesSel].sort((a, b) => a - b);
  const first = meses[0] ?? 1;
  const last = meses[meses.length - 1] ?? 12;
  return {
    label: buildPeriodoLabel(ano, meses),
    inicio: `${y}-${pad(first)}-01`,
    fim: `${y}-${pad(last)}-${pad(lastDay(y, last))}`,
  };
}

export function PeriodoPicker({
  value,
  onChange,
  label = "Período",
  required,
}: {
  value: PeriodoValue;
  onChange: (v: PeriodoValue) => void;
  label?: string;
  required?: boolean;
}) {
  const initialRef = useRef(parseInitial(value));
  const [ano, setAno] = useState<string>(initialRef.current.ano);
  const [meses, setMeses] = useState<number[]>(initialRef.current.meses);

  const anos = useMemo(() => {
    const now = new Date().getFullYear();
    const list: string[] = [];
    for (let y = now + 1; y >= 2024; y--) list.push(String(y));
    return list;
  }, []);

  useEffect(() => {
    const next = computeValue(ano, meses);
    if (next.label !== value?.label || next.inicio !== value?.inicio || next.fim !== value?.fim) {
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, meses]);

  function toggleMes(m: number) {
    setMeses((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)));
  }

  const resumo = meses.length ? buildPeriodoLabel(ano, meses) : "Selecione os meses";

  return (
    <div className="space-y-1.5">
      <Label>{label}{required && " *"}</Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
          <SelectContent>
            {anos.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-between font-normal">
              <span className="truncate">{resumo}</span>
              <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 pointer-events-auto" align="start">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Meses</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setMeses([1,2,3,4,5,6,7,8,9,10,11,12])}>Todos</Button>
                <Button variant="ghost" size="sm" onClick={() => setMeses([])}>Limpar</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {MESES.map((m, i) => {
                const n = i + 1;
                return (
                  <label key={m} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
                    <Checkbox checked={meses.includes(n)} onCheckedChange={() => toggleMes(n)} />
                    <span>{m}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {meses.length > 0 && (
        <p className="text-xs text-muted-foreground">Período: {resumo}</p>
      )}
    </div>
  );
}
