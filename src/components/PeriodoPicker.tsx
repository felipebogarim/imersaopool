import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PeriodoTipo = "mensal" | "semestral" | "anual";

export type PeriodoValue = {
  label: string;
  inicio: string; // YYYY-MM-DD
  fim: string;    // YYYY-MM-DD
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function lastDay(year: number, month1: number) {
  return new Date(year, month1, 0).getDate();
}

function tryParse(label?: string | null, inicio?: string | null, fim?: string | null) {
  const state: { tipo: PeriodoTipo; ano: string; sub: string } = {
    tipo: "semestral",
    ano: String(new Date().getFullYear()),
    sub: "1",
  };
  if (inicio) {
    const [y, m, d] = inicio.split("-").map(Number);
    if (y) state.ano = String(y);
    if (m && fim) {
      const [, mf] = fim.split("-").map(Number);
      const spanMonths = (mf ?? m) - m + 1;
      if (spanMonths === 1) {
        state.tipo = "mensal";
        state.sub = String(m);
      } else if (spanMonths === 6) {
        state.tipo = "semestral";
        state.sub = m <= 6 ? "1" : "2";
      } else if (spanMonths === 12) {
        state.tipo = "anual";
        state.sub = "1";
      }
    }
  } else if (label) {
    const l = label.toLowerCase();
    const yMatch = l.match(/(20\d{2})/);
    if (yMatch) state.ano = yMatch[1];
    if (/semestre/.test(l)) {
      state.tipo = "semestral";
      state.sub = /2/.test(l.split("semestre")[0]) ? "2" : "1";
    } else if (/anual|ano/.test(l)) {
      state.tipo = "anual";
    } else {
      for (let i = 0; i < MESES.length; i++) {
        if (l.includes(MESES[i].toLowerCase())) {
          state.tipo = "mensal";
          state.sub = String(i + 1);
          break;
        }
      }
    }
  }
  return state;
}

function computeValue(tipo: PeriodoTipo, ano: string, sub: string): PeriodoValue {
  const y = Number(ano);
  if (tipo === "mensal") {
    const m = Number(sub);
    const inicio = `${y}-${pad(m)}-01`;
    const fim = `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
    return { label: `${MESES[m - 1]} ${y}`, inicio, fim };
  }
  if (tipo === "semestral") {
    const s = Number(sub);
    if (s === 1) {
      return { label: `1º Semestre ${y}`, inicio: `${y}-01-01`, fim: `${y}-06-30` };
    }
    return { label: `2º Semestre ${y}`, inicio: `${y}-07-01`, fim: `${y}-12-31` };
  }
  return { label: `Anual ${y}`, inicio: `${y}-01-01`, fim: `${y}-12-31` };
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
  const parsed = useMemo(() => tryParse(value?.label, value?.inicio, value?.fim), []);
  const [tipo, setTipo] = useState<PeriodoTipo>(parsed.tipo);
  const [ano, setAno] = useState<string>(parsed.ano);
  const [sub, setSub] = useState<string>(parsed.sub);

  const anos = useMemo(() => {
    const now = new Date().getFullYear();
    const list: string[] = [];
    for (let y = now; y >= 2024; y--) list.push(String(y));
    return list;
  }, []);

  useEffect(() => {
    const next = computeValue(tipo, ano, tipo === "anual" ? "1" : sub);
    if (next.label !== value?.label || next.inicio !== value?.inicio || next.fim !== value?.fim) {
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, ano, sub]);

  return (
    <div className="space-y-1.5">
      <Label>{label}{required && " *"}</Label>
      <div className="grid grid-cols-3 gap-2">
        <Select value={tipo} onValueChange={(v) => { setTipo(v as PeriodoTipo); if (v === "anual") setSub("1"); else if (v === "semestral" && Number(sub) > 2) setSub("1"); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mensal">Mensal</SelectItem>
            <SelectItem value="semestral">Semestral</SelectItem>
            <SelectItem value="anual">Anual</SelectItem>
          </SelectContent>
        </Select>

        {tipo === "anual" ? (
          <div className="col-span-1" />
        ) : tipo === "semestral" ? (
          <Select value={sub} onValueChange={setSub}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1º Semestre</SelectItem>
              <SelectItem value="2">2º Semestre</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Select value={sub} onValueChange={setSub}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {anos.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
