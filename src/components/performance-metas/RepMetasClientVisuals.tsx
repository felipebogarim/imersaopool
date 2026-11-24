import { useState } from "react";
import { BarChart3, ChevronDown, History } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CanonicalFamily } from "@/lib/client-bi-familias";
import { FAROL_HEX, FAROL_LABEL, statusFromRatio } from "@/lib/performance-farol";
import { METAS_FAMILIES, METAS_FAMILY_LABEL, fmtBRL, fmtPct } from "@/lib/performance-metas";
import type { RepGoalsView, RepSuggestionSubmission } from "@/lib/performance-metas-persistence";
import { cn } from "@/lib/utils";

type ChartDatum = {
  familia: CanonicalFamily;
  label: string;
  atingimento: number;
  ratio: number | null;
  meta: number | null;
};

export function RepMetasPerformanceChart({
  view,
  selected,
  onSelect,
}: {
  view: RepGoalsView;
  selected: CanonicalFamily;
  onSelect: (familia: CanonicalFamily) => void;
}) {
  const data: ChartDatum[] = METAS_FAMILIES.map((familia) => {
    const ratio = view.atingimento[familia]?.ratio ?? null;
    return {
      familia,
      label: METAS_FAMILY_LABEL[familia],
      atingimento: ratio == null ? 0 : ratio * 100,
      ratio,
      meta: view.items.find((item) => item.familia === familia)?.meta_mensal ?? null,
    };
  });
  const peak = Math.max(120, ...data.map((item) => item.atingimento));
  const step = peak <= 150 ? 25 : peak <= 300 ? 50 : 100;
  const yMax = Math.ceil(peak / step) * step;

  return (
    <section className="rounded-xl border bg-background p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Resultado por portfólio no período avaliado</h3>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Clique em uma barra para abrir o portfólio
        </p>
      </div>
      <div className="w-full overflow-x-auto pb-1">
        <div className="mx-auto h-[300px] w-full min-w-[760px] max-w-[1240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 16, left: -4, bottom: 12 }}
              barCategoryGap="22%"
              barGap={4}
              onClick={(event) => {
                const item = data.find((row) => row.label === event?.activeLabel);
                if (item) onSelect(item.familia);
              }}
            >
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis
                dataKey="label"
                interval={0}
                height={52}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={[0, yMax]}
                ticks={Array.from({ length: yMax / step + 1 }, (_, index) => index * step)}
                tickFormatter={(value) => `${value}%`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="4 4" />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
                content={<RepTooltip />}
              />
              <Bar dataKey="atingimento" radius={[6, 6, 0, 0]} maxBarSize={96}>
                {data.map((item) => {
                  const status = statusFromRatio(item.ratio);
                  const active = selected === item.familia;
                  return (
                    <Cell
                      key={item.familia}
                      fill={status ? `#${FAROL_HEX[status]}` : "hsl(var(--muted))"}
                      fillOpacity={active ? 1 : 0.68}
                      stroke={active ? "hsl(var(--foreground))" : "transparent"}
                      strokeWidth={active ? 1.5 : 0}
                      className="cursor-pointer"
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function RepTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  const status = statusFromRatio(item.ratio);
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{item.label}</p>
      <p>
        Atingimento: {fmtPct(item.ratio)}
        {status ? ` · ${FAROL_LABEL[status]}` : ""}
      </p>
      <p>Meta oficial mensal: {fmtBRL(item.meta)}</p>
    </div>
  );
}

export function RepSuggestionHistory({ history }: { history: RepSuggestionSubmission[] }) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border bg-background shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-4 text-left hover:bg-muted/40"
      >
        <History className="h-4 w-4 text-primary" />
        <span className="font-semibold">Histórico de envios</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {history.length}
        </span>
        <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="divide-y border-t">
          {history.map((submission, index) => (
            <div key={submission.sent_at} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">Envio {history.length - index}</p>
                <time className="text-xs text-muted-foreground">
                  {formatSentAt(submission.sent_at)}
                </time>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {submission.items.map((item) => (
                  <div key={item.familia} className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs font-semibold">{METAS_FAMILY_LABEL[item.familia]}</p>
                    <p className="mt-1 text-sm tabular-nums">Sugestão: {fmtBRL(item.valor)}</p>
                    {item.justificativa && (
                      <p className="mt-1 text-xs text-muted-foreground">{item.justificativa}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatSentAt(iso: string) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}
