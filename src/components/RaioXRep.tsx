import { useState } from "react";
import { cn } from "@/lib/utils";
import type { RaioXLente } from "@/lib/visao-rep";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Quote } from "lucide-react";

/** Radar octogonal com a densidade de cada uma das 8 perspectivas. */
function Radar({ data }: { data: RaioXLente[] }) {
  const size = 260;
  const c = size / 2;
  const r = size / 2 - 34;
  const n = Math.max(1, data.length);
  const pt = (i: number, frac: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * frac, c + Math.sin(a) * r * frac] as const;
  };
  const poly = (frac: (i: number) => number) =>
    data.map((_, i) => pt(i, frac(i)).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] mx-auto" role="img" aria-label="Densidade das 8 perspectivas">
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon
          key={f}
          points={poly(() => f)}
          className="fill-none stroke-border"
          strokeWidth={1}
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} className="stroke-border" strokeWidth={1} />;
      })}
      <polygon
        points={poly(i => Math.max(0.06, data[i].intensidade / 100))}
        className="fill-primary/25 stroke-primary"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {data.map((d, i) => {
        const [x, y] = pt(i, Math.max(0.06, d.intensidade / 100));
        return <circle key={d.lente} cx={x} cy={y} r={3} className="fill-primary" />;
      })}
      {data.map((d, i) => {
        const [x, y] = pt(i, 1.2);
        return (
          <text
            key={`l-${d.lente}`}
            x={x}
            y={y}
            textAnchor={x > c + 4 ? "start" : x < c - 4 ? "end" : "middle"}
            dominantBaseline="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 8 }}
          >
            {d.label.length > 16 ? `${d.label.slice(0, 15)}…` : d.label}
          </text>
        );
      })}
    </svg>
  );
}

/** Anel de intensidade. */
function Ring({ value }: { value: number }) {
  const R = 16;
  const dash = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 40 40" className="h-11 w-11 shrink-0 -rotate-90">
      <circle cx="20" cy="20" r={R} className="fill-none stroke-muted" strokeWidth={4} />
      <circle
        cx="20"
        cy="20"
        r={R}
        className="fill-none stroke-primary"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={dash}
        strokeDashoffset={dash * (1 - Math.max(0, Math.min(100, value)) / 100)}
      />
    </svg>
  );
}

export function RaioXRep({ intro, data }: { intro: string; data: RaioXLente[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">{intro}</p>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr] items-start">
        <div className="surface rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Cobertura da fala</p>
          <Radar data={data} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map(d => (
            <LenteCard key={d.lente} d={d} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LenteCard({ d }: { d: RaioXLente }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn("surface rounded-xl p-3.5", d.vazia && "opacity-60")}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Ring value={d.intensidade} />
          <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums">
            {d.sinais}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{d.label}</p>
          <p className="text-[11px] text-muted-foreground truncate">{d.descricao}</p>
        </div>
      </div>

      {d.vazia ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Sem registro nesta perspectiva.</p>
      ) : (
        <>
          {d.termos.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {d.termos.map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] leading-tight"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {d.highlight && (
            <p className="mt-2.5 flex gap-1.5 text-[11px] italic text-muted-foreground">
              <Quote className="h-3 w-3 shrink-0 mt-0.5 text-primary/60" />
              <span className="line-clamp-2">{d.highlight}</span>
            </p>
          )}
          <CollapsibleTrigger className="mt-2.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
            {open ? "Ocultar detalhe" : "Ver detalhe"}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 border-t pt-2">
            {d.leitura && <p className="text-xs leading-relaxed">{d.leitura}</p>}
            <dl className="space-y-1.5">
              {d.campos.map(c => (
                <div key={c.label}>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</dt>
                  <dd className="text-xs">{c.valores.join(" · ")}</dd>
                </div>
              ))}
            </dl>
          </CollapsibleContent>
        </>
      )}
    </Collapsible>
  );
}
