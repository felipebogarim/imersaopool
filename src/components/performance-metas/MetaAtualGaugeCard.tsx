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

export type MetaAtualGaugeCardProps = {
  metaAtual: number;
  realizado: number;
  metaComBase: number;
  atingimento: number | null;
  periodo: string;
  hint?: string;
  visao9mm?: boolean;
  onToggleVisao9mm?: (v: boolean) => void;
  showVisao9mm?: boolean;
  className?: string;
};

export function MetaAtualGaugeCard({
  metaAtual,
  realizado,
  metaComBase,
  atingimento,
  periodo,
  hint,
  visao9mm,
  onToggleVisao9mm,
  showVisao9mm = true,
  className,
}: MetaAtualGaugeCardProps) {
  const rawId = useId();
  const gradId = `gaugeGrad-${rawId.replace(/:/g, "")}`;
  const glowId = `gaugeGlow-${rawId.replace(/:/g, "")}`;

  const status = statusFromRatio(atingimento);
  const colors = GAUGE_GRADIENTS[status ?? "sem_compra"];
  const statusTextColor = GAUGE_STATUS_TEXT[status ?? "sem_compra"];

  // Escala do arco: 0 a 120% (1.20)
  const ratio = atingimento ?? 0;
  const clamped = Math.min(1.2, Math.max(0, ratio));
  const t = clamped / 1.2;
  const arcRadius = 64;
  const cx = 100;
  const cy = 90;
  const arcLength = Math.PI * arcRadius; // ~201.06
  const offset = arcLength * (1 - t);

  // Ponto da agulha / indicador luminoso na ponta do progresso
  const tipX = cx - arcRadius * Math.cos(t * Math.PI);
  const tipY = cy - arcRadius * Math.sin(t * Math.PI);

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
            {showVisao9mm && (
              <button
                type="button"
                onClick={() => onToggleVisao9mm?.(!visao9mm)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-all cursor-pointer",
                  visao9mm
                    ? "bg-amber-500 text-white font-semibold shadow-xs hover:bg-amber-600"
                    : "border border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                title="Simular com meta proporcional de 9 milhões por mês"
              >
                <SlidersHorizontal className="h-2.5 w-2.5" />
                Visão 9MM/mês
              </button>
            )}
            <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
              {periodo}
            </span>
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-base font-bold tracking-tight text-foreground tabular-nums">
            {fmtBRL(metaAtual)}
          </p>
          {visao9mm && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
              Cenário 9MM
            </span>
          )}
        </div>
      </div>

      <div className="my-2 flex flex-col items-center">
        <svg viewBox="0 0 200 110" className="w-full max-w-[210px] overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors[0]} />
              <stop offset="100%" stopColor={colors[1]} />
            </linearGradient>
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="2"
                floodColor={colors[1]}
                floodOpacity="0.45"
              />
            </filter>
          </defs>

          {/* Arco de fundo (trilha) mais encorpado */}
          <path
            d="M 36 90 A 64 64 0 0 1 164 90"
            fill="none"
            strokeWidth={14}
            strokeLinecap="round"
            className="stroke-muted/30"
          />

          {/* Arco preenchido de progresso encorpado */}
          {t > 0 && (
            <path
              d="M 36 90 A 64 64 0 0 1 164 90"
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${arcLength}`}
              strokeDashoffset={offset}
              className="transition-all duration-500 ease-out"
            />
          )}

          {/* Marcador de 100% (meta atingida) */}
          <line
            x1={147.6}
            y1={62.5}
            x2={165.0}
            y2={52.5}
            stroke="currentColor"
            strokeWidth={1.5}
            className="text-muted-foreground/50"
          />
          <text
            x={168}
            y={50}
            className="text-[8px] font-semibold fill-muted-foreground/80 select-none"
          >
            100%
          </text>

          {/* Indicador luminoso na ponta do arco */}
          {t > 0 && (
            <g filter={`url(#${glowId})`}>
              <circle
                cx={tipX}
                cy={tipY}
                r={5.5}
                fill="#ffffff"
                stroke={colors[1]}
                strokeWidth={3}
              />
            </g>
          )}

          {/* Leitura central do percentual (sem sobreposição com o arco) */}
          <text
            x={100}
            y={68}
            textAnchor="middle"
            className="text-2xl font-bold fill-foreground tabular-nums select-none"
          >
            {atingimento != null ? fmtPct(atingimento) : "—"}
          </text>

          {/* Status do farol */}
          <text
            x={100}
            y={83}
            textAnchor="middle"
            className={cn(
              "text-[9px] font-bold uppercase tracking-wider select-none",
              statusTextColor,
            )}
          >
            {status ? FAROL_LABEL[status] : "Sem base"}
          </text>

          {/* Marcas de escala */}
          <text
            x={34}
            y={106}
            textAnchor="middle"
            className="text-[9px] font-medium fill-muted-foreground/60 select-none"
          >
            0%
          </text>
          <text
            x={166}
            y={106}
            textAnchor="middle"
            className="text-[9px] font-medium fill-muted-foreground/60 select-none"
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
