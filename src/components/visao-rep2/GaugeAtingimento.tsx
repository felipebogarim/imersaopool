import { cn } from "@/lib/utils";
// Gauge semicircular de atingimento ponderado (apenas percentual).
// Escala fixa 0%–120%: zona verde a partir de 100%, marca vermelha em 70%.

const MIN = 0;
const MAX = 120;
const RANGE_RED = 60;
const RANGE_YELLOW = 80;
const RANGE_LIGHT_GREEN = 90;
const RANGE_GREEN = 120;

const W = 260;
const H = 135;
const CX = W / 2;
const CY = 120;
const R = 92;
const STROKE = 22;

const angleOf = (v: number) => {
  const t = Math.min(1, Math.max(0, (v - MIN) / (MAX - MIN)));
  return Math.PI - t * Math.PI; // rad, 180° -> 0°
};

const pointOf = (v: number, r = R) => {
  const a = angleOf(v);
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
};

const arcPath = (from: number, to: number) => {
  const p1 = pointOf(from);
  const p2 = pointOf(to);
  const large = angleOf(from) - angleOf(to) > Math.PI ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${R} ${R} 0 ${large} 1 ${p2.x} ${p2.y}`;
};

export function GaugeAtingimento({ valor, label, placeholder }: { valor: number | null | undefined; label?: string; placeholder?: string }) {
  const v = valor == null || Number.isNaN(valor) ? null : valor;

  
  // No gráfico, se o valor for < MIN, o ponteiro fica no MIN. 
  // Se for > MAX, fica no MAX.
  const visualValue = v == null ? MIN : Math.min(MAX, Math.max(MIN, v));
  const needle = pointOf(visualValue, R - STROKE / 2 - 4);

  // Lógica de cores para o valor atual
  const getStatusColor = (val: number | null) => {
    if (val === null) return "stroke-muted-foreground/25";
    if (val <= 60) return "fill-red-500 stroke-red-500";
    if (val <= 80) return "fill-amber-400 stroke-amber-400";
    if (val <= 90) return "fill-lime-400 stroke-lime-400";
    return "fill-emerald-500 stroke-emerald-500";
  };

  const needleColor = v === null ? "fill-foreground stroke-foreground" : getStatusColor(v);

  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[86px] w-[150px] shrink-0"
        role="img"
        aria-label={label ?? "Atingimento"}
      >
        <path d={arcPath(MIN, MAX)} fill="none" strokeWidth={STROKE} strokeLinecap="round" className="stroke-muted-foreground/15" />
        
        {/* Trilhas de cor fixas no fundo */}
        <path
          d={arcPath(MIN, RANGE_RED)}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          stroke="oklch(0.65 0.2 25 / 0.2)"
        />
        <path
          d={arcPath(RANGE_RED, RANGE_YELLOW)}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          stroke="oklch(0.85 0.2 90 / 0.2)"
        />
        <path
          d={arcPath(RANGE_YELLOW, RANGE_LIGHT_GREEN)}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          stroke="oklch(0.88 0.15 140 / 0.2)"
        />
        <path
          d={arcPath(RANGE_LIGHT_GREEN, RANGE_GREEN)}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          stroke="oklch(0.7 0.2 145 / 0.2)"
        />

        {/* Arco de progresso colorido até o valor atual */}
        {v !== null && (
           <path
            d={arcPath(MIN, visualValue)}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            className={needleColor.split(' ').find(c => c.startsWith('stroke-'))}
          />
        )}

        {v != null ? (
          <>
            <line
              x1={CX}
              y1={CY}
              x2={needle.x}
              y2={needle.y}
              strokeWidth={6}
              strokeLinecap="round"
              className={needleColor.split(' ').find(c => c.startsWith('stroke-'))}
            />
            <circle cx={CX} cy={CY} r={9} className={needleColor.split(' ').find(c => c.startsWith('fill-'))} />
          </>
        ) : null}
        <text x={pointOf(MIN).x} y={CY + 18} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {MIN}%
        </text>
        <text x={pointOf(MAX).x} y={CY + 18} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {MAX}%
        </text>
      </svg>
      <div className="min-w-0">
        <p className={cn("text-3xl font-semibold leading-none tabular-nums", v !== null && needleColor.split(' ').find(c => c.startsWith('text-')))}>
          {v == null ? (placeholder || "—") : `${v.toFixed(1).replace(".", ",")}%`}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">{v == null ? "performance indisponível" : "meta 100%"}</p>

      </div>
    </div>
  );
}

