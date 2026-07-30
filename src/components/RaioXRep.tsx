import { useState } from "react";
import { cn } from "@/lib/utils";
import type { RaioXLente } from "@/lib/visao-rep";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Quote, X, BookOpen } from "lucide-react";

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
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[260px] mx-auto" role="img" aria-label="Densidade das 8 perspectivas">
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon key={f} points={poly(() => f)} className="fill-none stroke-border" strokeWidth={1} />
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
  const [ativa, setAtiva] = useState<string | null>(null);
  const [coberturaAberta, setCoberturaAberta] = useState(false);
  const detalheRef = useRef<HTMLDivElement | null>(null);
  const sel = data.find(d => d.lente === ativa) ?? null;

  // Ao abrir um detalhe, traz o bloco selecionado (e seu detalhe) para a área visível.
  useEffect(() => {
    if (!ativa) return;
    const t = window.setTimeout(() => {
      detalheRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [ativa]);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">{intro}</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.map((d, i) => {
          const isAtiva = d.lente === ativa;
          return (
            <div
              key={d.lente}
              className={cn("contents")}
              style={undefined}
            >
              <div className={cn(isAtiva ? "order-1" : ativa ? "order-3" : "order-none")}>
                <LenteCard
                  d={d}
                  ordem={i + 1}
                  ativa={isAtiva}
                  onOpen={() => setAtiva(isAtiva ? null : d.lente)}
                />
              </div>
              {isAtiva && sel && (
                <div ref={detalheRef} className="order-2 sm:col-span-2 xl:col-span-4 scroll-mt-24">
                  <DetalheLente d={sel} ordem={i + 1} onClose={() => setAtiva(null)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Collapsible open={coberturaAberta} onOpenChange={setCoberturaAberta} className="surface rounded-xl px-4 py-3">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Cobertura da fala</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", coberturaAberta && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <Radar data={data} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}


/** Bloco em destaque: o conteúdo da lente vira pequenos capítulos. */
function DetalheLente({ d, onClose }: { d: RaioXLente; onClose: () => void }) {
  return (
    <section className="surface rounded-2xl border border-primary/30 p-4 sm:p-5 space-y-4">
      <header className="flex items-start gap-3">
        <div className="relative">
          <Ring value={d.intensidade} />
          <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums">
            {d.sinais}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{d.label}</p>
          <p className="text-xs text-muted-foreground">{d.descricao}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Fechar detalhe"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {d.capitulos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem registro nesta perspectiva.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {d.capitulos.map((cap, i) => (
            <article
              key={`${cap.titulo}-${i}`}
              className={cn(
                "rounded-xl border bg-card/40 p-3.5",
                cap.tipo === "citacao" && "border-primary/30 bg-primary/5",
              )}
            >
              <div className="mb-2 flex items-start gap-1.5">
                <span className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary tabular-nums">
                  {i + 1}
                </span>
                {cap.tipo === "citacao" ? (
                  <Quote className="mt-[2px] h-3.5 w-3.5 shrink-0 text-primary/70" />
                ) : (
                  <BookOpen className="mt-[2px] h-3.5 w-3.5 shrink-0 text-primary/70" />
                )}
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/80 leading-snug">
                  {cap.titulo}
                </h4>
              </div>

              {cap.tipo === "campo" ? (
                <ul className="space-y-1">
                  {cap.itens.map((v, k) => (
                    <li key={k} className="flex gap-1.5 text-xs leading-relaxed">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2">
                  {cap.itens.map((v, k) => (
                    <p
                      key={k}
                      className={cn("text-xs leading-relaxed", cap.tipo === "citacao" && "italic text-muted-foreground")}
                    >
                      {v}
                    </p>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function LenteCard({ d, ativa, onOpen }: { d: RaioXLente; ativa: boolean; onOpen: () => void }) {
  return (
    <div
      className={cn(
        "surface rounded-xl p-3.5 transition-colors",
        d.vazia && "opacity-60",
        ativa && "ring-2 ring-primary",
      )}
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
              {d.termos.slice(0, 3).map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] leading-tight"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={onOpen}
            className="mt-2.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", ativa && "rotate-180")} />
            {ativa ? "Fechar detalhe" : `Ver detalhe · ${d.capitulos.length} capítulos`}
          </button>
        </>
      )}
    </div>
  );
}
