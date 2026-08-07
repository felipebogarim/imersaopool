// Gauge semicircular de atingimento ponderado (apenas percentual).
// Escala fixa 0%–120%: zona verde a partir de 100%, marca vermelha em 70%.

const MIN = 0;
const MAX = 120;
const GREEN_FROM = 100;
const RED_MARK = 70;

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

export function GaugeAtingimento({ valor, label }: { valor: number | null | undefined; label?: string }) {
  const v = valor == null || Number.isNaN(valor) ? null : valor;
  
  // No gráfico, se o valor for < MIN, o ponteiro fica no MIN. 
  // Se for > MAX, fica no MAX.
  const visualValue = v == null ? MIN : Math.min(MAX, Math.max(MIN, v));
  const needle = pointOf(visualValue, R - STROKE / 2 - 4);
  const red = pointOf(RED_MARK, R + STROKE / 2);
  const redIn = pointOf(RED_MARK, R - STROKE / 2);

  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[86px] w-[150px] shrink-0"
        role="img"
        aria-label={label ?? "Atingimento"}
      >
        <path d={arcPath(MIN, MAX)} fill="none" strokeWidth={STROKE} strokeLinecap="round" className="stroke-muted-foreground/25" />
        <path
          d={arcPath(GREEN_FROM, MAX)}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          stroke="oklch(0.78 0.19 140)"
        />
        <line x1={redIn.x} y1={redIn.y} x2={red.x} y2={red.y} strokeWidth={2} stroke="oklch(0.65 0.2 25)" />
        {v != null ? (
          <>
            <line
              x1={CX}
              y1={CY}
              x2={needle.x}
              y2={needle.y}
              strokeWidth={6}
              strokeLinecap="round"
              className="stroke-foreground"
            />
            <circle cx={CX} cy={CY} r={9} className="fill-foreground" />
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
        <p className="text-3xl font-semibold leading-none tabular-nums">
          {v == null ? "—" : `${v.toFixed(1).replace(".", ",")}%`}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">meta 100%</p>
      </div>
    </div>
  );
}

