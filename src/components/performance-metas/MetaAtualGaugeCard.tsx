import { useId } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { FAROL_LABEL, statusFromRatio, type FarolStatus } from "@/lib/performance-farol";
import { fmtBRL, fmtPct } from "@/lib/performance-metas";

export const GAUGE_GRADIENTS: Record<FarolStatus, [string, string]> = {
  excelente: ["#059669", "#10b981"],
  otimo: ["#10b981", "#34d399"],
  proximo: ["#f59e0b", "#eab308"],
  pode_melhorar: ["#f97316", "#f59e0b"],
  abaixo_meta: ["#f43f5e", "#ef4444"],
  sem_compra: ["#94a3b8", "#64748b"],
};

export const GAUGE_STATUS_TEXT: Record<FarolStatus, string> = {
  excelente: "fill-emerald-600 dark:fill-emerald-400",
  otimo: "fill-emerald-500 dark:fill-emerald-300",
  proximo: "fill-amber-600 dark:fill-amber-400",
  pode_melhorar: "fill-orange-600 dark:fill-orange-400",
  abaixo_meta: "fill-red-600 dark:fill-red-400",
  sem_compra: "fill-muted-foreground",
};

/** Cenários de meta total da empresa (milhões/mês) disponíveis no card. */
export const CENARIOS_MM = [8, 8.5, 9] as const;

/** "8,5" para 8.5 (rótulos de cenário em pt-BR). */
export const fmtCenarioMM = (mm: number) => mm.toLocaleString("pt-BR");

/** Seletor de cenário de meta total da empresa (clicar no ativo volta às metas reais). */
export function CenarioMMToggle({
  value,
  onChange,
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-md border border-border p-0.5", className)} role="group">
      {CENARIOS_MM.map((mm) => {
        const ativo = value === mm;
        return (
          <button
            key={mm}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(ativo ? null : mm)}
            title={
              ativo
                ? "Voltar às metas reais"
                : `Simular com meta proporcional de ${fmtCenarioMM(mm)} milhões por mês`
            }
            className={cn(
              "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs whitespace-nowrap transition-colors",
              ativo
                ? "bg-amber-500 font-semibold text-white hover:bg-amber-600"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Visão {fmtCenarioMM(mm)}MM/mês
          </button>
        );
      })}
    </div>
  );
}

export type MetaAtualGaugeCardProps = {
  metaAtual: number;
  realizado: number;
  metaComBase: number;
  atingimento: number | null;
  periodo: string;
  hint?: string;
  /** Cenário ativo em milhões/mês (ex.: 9 ou 8); null = metas reais. */
  cenarioMM?: number | null;
  onCenarioMM?: (v: number | null) => void;
  showCenarios?: boolean;
  className?: string;
};

export function MetaAtualGaugeCard({
  metaAtual,
  realizado,
  metaComBase,
  atingimento,
  periodo,
  hint,
  cenarioMM = null,
  onCenarioMM,
  showCenarios = true,
  className,
}: MetaAtualGaugeCardProps) {
  const rawId = useId();
  const gradId = `gaugeGrad-${rawId.replace(/:/g, "")}`;
  const glowId = `gaugeGlow-${rawId.replace(/:/g, "")}`;

  const status = statusFromRatio(atingimento);
  const colors = GAUGE_GRADIENTS[status ?? "sem_compra"];
  const statusTextColor = GAUGE_STATUS_TEXT[status ?? "sem_compra"];

  // Escala do arco: 0 a 120% (1.20). Geometria pensada para não haver sobreposição:
  // leitura central dentro do raio interno, marcador de 100% e escalas fora do arco.
  const MAX = 1.2;
  const ratio = atingimento ?? 0;
  const t = Math.min(MAX, Math.max(0, ratio)) / MAX;
  const cx = 110;
  const cy = 100;
  const r = 76;
  const sw = 12;
  const arcLength = Math.PI * r;
  const offset = arcLength * (1 - t);
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  /** Ponto do arco para uma fração 0..1 da escala, num raio qualquer. */
  const at = (f: number, radius: number) => ({
    x: cx - radius * Math.cos(f * Math.PI),
    y: cy - radius * Math.sin(f * Math.PI),
  });
  const tip = at(t, r);
  const f100 = 1 / MAX;
  const notchIn = at(f100, r - sw / 2 - 1);
  const notchOut = at(f100, r + sw / 2 + 1);
  const tickOut = at(f100, r + sw / 2 + 7);
  const label100 = at(f100, r + sw / 2 + 11);

  return (
    <div
      className={cn(
        "flex h-full flex-1 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
      title={hint}
    >
      <div>
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Meta atual
          </p>
          <div className="flex items-center gap-1.5">
            {showCenarios &&
              CENARIOS_MM.map((mm) => {
                const ativo = cenarioMM === mm;
                return (
                  <button
                    key={mm}
                    type="button"
                    onClick={() => onCenarioMM?.(ativo ? null : mm)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-all cursor-pointer",
                      ativo
                        ? "bg-amber-500 text-white font-semibold shadow-xs hover:bg-amber-600"
                        : "border border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    title={`Simular com meta proporcional de ${fmtCenarioMM(mm)} milhões por mês`}
                  >
                    <SlidersHorizontal className="h-2.5 w-2.5" />
                    Visão {fmtCenarioMM(mm)}MM/mês
                  </button>
                );
              })}
            <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
              {periodo}
            </span>
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-base font-bold tracking-tight text-foreground tabular-nums">
            {fmtBRL(metaAtual)}
          </p>
          {cenarioMM != null && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
              Cenário {fmtCenarioMM(cenarioMM)}MM
            </span>
          )}
        </div>
      </div>

      <div className="my-2 flex flex-col items-center">
        <svg viewBox="0 0 220 128" className="w-full max-w-[240px] overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors[0]} />
              <stop offset="100%" stopColor={colors[1]} />
            </linearGradient>
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="1.5"
                floodColor={colors[1]}
                floodOpacity="0.45"
              />
            </filter>
          </defs>

          {/* Trilha */}
          <path
            d={arcPath}
            fill="none"
            strokeWidth={sw}
            strokeLinecap="round"
            className="stroke-muted"
          />

          {/* Progresso */}
          {t > 0 && (
            <path
              d={arcPath}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${arcLength}`}
              strokeDashoffset={offset}
              className="transition-all duration-500 ease-out"
            />
          )}

          {/* Marcador de 100%: entalhe no arco + traço e rótulo por fora */}
          <line
            x1={notchIn.x}
            y1={notchIn.y}
            x2={notchOut.x}
            y2={notchOut.y}
            strokeWidth={2}
            className="stroke-card"
          />
          <line
            x1={notchOut.x}
            y1={notchOut.y}
            x2={tickOut.x}
            y2={tickOut.y}
            strokeWidth={1.5}
            strokeLinecap="round"
            className="stroke-muted-foreground/60"
          />
          <text
            x={label100.x + 1}
            y={label100.y}
            fontSize={8}
            dominantBaseline="middle"
            className="font-semibold fill-muted-foreground select-none"
          >
            100%
          </text>

          {/* Ponta do progresso */}
          {t > 0 && (
            <g filter={`url(#${glowId})`}>
              <circle
                cx={tip.x}
                cy={tip.y}
                r={5}
                fill="#ffffff"
                stroke={colors[1]}
                strokeWidth={2.5}
              />
            </g>
          )}

          {/* Leitura central, dentro do raio interno */}
          <text
            x={cx}
            y={cy - 14}
            textAnchor="middle"
            fontSize={25}
            className="font-bold fill-foreground tabular-nums select-none"
          >
            {atingimento != null ? fmtPct(atingimento) : "—"}
          </text>
          <text
            x={cx}
            y={cy + 2}
            textAnchor="middle"
            fontSize={8.5}
            letterSpacing={0.8}
            className={cn("font-bold uppercase select-none", statusTextColor)}
          >
            {status ? FAROL_LABEL[status] : "Sem base"}
          </text>

          {/* Escala, abaixo das pontas do arco */}
          <text
            x={cx - r}
            y={cy + sw / 2 + 14}
            textAnchor="middle"
            fontSize={8.5}
            className="font-medium fill-muted-foreground select-none"
          >
            0%
          </text>
          <text
            x={cx + r}
            y={cy + sw / 2 + 14}
            textAnchor="middle"
            fontSize={8.5}
            className="font-medium fill-muted-foreground select-none"
          >
            120%
          </text>
        </svg>
      </div>

      <div className="border-t border-border/50 pt-2 text-[11px] text-muted-foreground flex items-center justify-between">
        <span className="truncate">Base: {fmtBRL(realizado)}</span>
        {metaComBase > 0 && (
          <span className="shrink-0 text-[10px] text-muted-foreground/80">
            de {fmtBRL(metaComBase)}
          </span>
        )}
      </div>
    </div>
  );
}
