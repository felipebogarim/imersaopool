import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, BarChart3, Compass, ExternalLink, Eye, Flag,
  LayoutGrid, Lightbulb, MessageSquare, Search, Settings2, Tag, Users, ListChecks,
} from "lucide-react";
import { ENTREVISTA_CAPITULOS, GUIA_ETAPAS, type GuiaEtapa } from "@/lib/guia-gerencial";

const ICONES = [MessageSquare, Eye, BarChart3, Users, Search, Tag, ListChecks, Settings2];


export function GuiaGerencial() {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const conteudoRef = useRef<HTMLDivElement | null>(null);

  const abrir = useCallback((i: number) => {
    setAtivo(prev => {
      setDir(prev === null || i >= prev ? 1 : -1);
      return i;
    });
  }, []);

  useEffect(() => {
    if (ativo === null) return;
    const el = conteudoRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
    return () => window.clearTimeout(t);
  }, [ativo]);

  const etapa = ativo !== null ? GUIA_ETAPAS[ativo] : null;

  return (
    <div className="pb-20">
      {/* ---------- TOPO ---------- */}
      <section className="border-b border-border bg-gradient-to-b from-muted/60 via-background to-background">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-8 pt-12 pb-8 text-center">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Guia de Uso <span className="text-primary">Gerencial</span>
          </h1>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Siga a trilha para transformar informações comerciais em decisões, prioridades e ações.
          </p>
        </div>

        {/* ---------- TRILHA FLUIDA ---------- */}
        <div className="mx-auto max-w-[1320px] px-4 sm:px-8 pb-12">
          <TrilhaFluida ativo={ativo} onSelect={abrir} />
        </div>
      </section>


      {/* ---------- CONTEÚDO + TIMELINE VERTICAL ---------- */}
      <div ref={conteudoRef} className="scroll-mt-4">
        {etapa ? (
          <div className="mx-auto max-w-[1320px] px-4 sm:px-8 py-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_4fr]">
            <aside className="lg:sticky lg:top-4 lg:self-start">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3 px-1">Trilha</p>
              <ol className="relative space-y-1 border-l border-border/70 pl-3">
                {GUIA_ETAPAS.map((e, i) => {
                  const on = i === ativo;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => abrir(i)}
                        className={`w-full text-left rounded-lg px-3 py-2 text-xs transition border-l-2 ${
                          on
                            ? "bg-primary/10 border-primary font-semibold text-foreground"
                            : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        <span
                          className={`mr-2 inline-grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold ${
                            on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {e.numero}
                        </span>
                        {e.titulo}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <Button variant="ghost" size="sm" className="mt-3 gap-1 text-xs" onClick={() => setAtivo(null)}>
                <LayoutGrid className="h-3.5 w-3.5" /> Ver trilha completa
              </Button>
            </aside>

            <div
              key={ativo}
              className={`min-w-0 animate-in fade-in duration-300 ${
                dir === 1 ? "slide-in-from-right-8" : "slide-in-from-left-8"
              }`}
            >
              <EtapaDetalhe
                etapa={etapa}
                index={ativo!}
                total={GUIA_ETAPAS.length}
                onPrev={() => abrir(Math.max(0, ativo! - 1))}
                onNext={() => abrir(Math.min(GUIA_ETAPAS.length - 1, ativo! + 1))}
              />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[1320px] px-4 sm:px-8 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Selecione uma etapa da trilha acima para abrir a orientação completa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- TRILHA FLUIDA ---------- */

const VB_W = 1000;
const VB_H = 160;
const NOS = GUIA_ETAPAS.map((_, i) => ({
  x: 62.5 + i * (VB_W / GUIA_ETAPAS.length),
  y: i % 2 === 0 ? 52 : 108,
}));

const CAMINHO = NOS.reduce((d, p, i) => {
  if (i === 0) return `M ${p.x} ${p.y}`;
  const prev = NOS[i - 1];
  const cx = (prev.x + p.x) / 2;
  return `${d} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
}, "");

function TrilhaFluida({ ativo, onSelect }: { ativo: number | null; onSelect: (i: number) => void }) {
  const total = GUIA_ETAPAS.length;
  const progresso = ativo === null ? 0 : ((ativo + 0.5) / total) * 100;

  return (
    <>
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Trilha · {total} etapas</p>

      {/* horizontal — md+ */}
      <div className="relative hidden h-[320px] w-full md:block">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d={CAMINHO}
            fill="none"
            stroke="var(--border)"
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={CAMINHO}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={100 - progresso}
            style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>

        {GUIA_ETAPAS.map((e, i) => {
          const { x, y } = NOS[i];
          const acima = i % 2 === 0;
          const on = ativo === i;
          const Icon = ICONES[i];
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelect(i)}
              aria-current={on ? "step" : undefined}
              className="group absolute -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none"
              style={{ left: `${(x / VB_W) * 100}%`, top: `${(y / VB_H) * 100}%` }}
            >
              <span
                className={`relative grid h-11 w-11 place-items-center rounded-full border transition-all duration-300 group-hover:scale-110 ${
                  on
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_6px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
                    : "border-border bg-card text-muted-foreground group-hover:border-primary/60 group-hover:text-primary"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span
                  className={`absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold ${
                    on ? "bg-background text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {e.numero}
                </span>
              </span>

              <span
                className={`absolute left-1/2 w-44 -translate-x-1/2 text-center ${
                  acima ? "bottom-full mb-4" : "top-full mt-4"
                }`}
              >
                <span
                  className={`block text-xs font-semibold uppercase tracking-wide transition-colors ${
                    on ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {e.titulo}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground/80 line-clamp-2">
                  {e.resumo}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* vertical — mobile */}
      <ol className="relative md:hidden">
        <span className="absolute left-[21px] top-3 bottom-3 w-px bg-border" aria-hidden />
        <span
          className="absolute left-[21px] top-3 w-px bg-primary transition-all duration-500"
          style={{ height: ativo === null ? 0 : `calc(${progresso}% - 0.75rem)` }}
          aria-hidden
        />
        {GUIA_ETAPAS.map((e, i) => {
          const on = ativo === i;
          const Icon = ICONES[i];
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={on ? "step" : undefined}
                className="group flex w-full items-start gap-3 py-2 text-left"
              >
                <span
                  className={`relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-colors ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 pt-1">
                  <span className={`block text-xs font-semibold uppercase tracking-wide ${on ? "text-foreground" : "text-muted-foreground"}`}>
                    {e.numero}. {e.titulo}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground/80 line-clamp-2">{e.resumo}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}


function Bloco({
  icon: Icon, titulo, children, tone = "card",
}: { icon: any; titulo: string; children: React.ReactNode; tone?: "card" | "inset" }) {
  return (
    <div className={`${tone === "inset" ? "surface-inset" : "surface"} rounded-xl p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider">{titulo}</h3>
      </div>
      {children}
    </div>
  );
}

function Lista({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map(t => (
        <li key={t} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-primary/60" aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function EtapaDetalhe({
  etapa, index, total, onPrev, onNext,
}: { etapa: GuiaEtapa; index: number; total: number; onPrev: () => void; onNext: () => void }) {
  const Icon = ICONES[index];
  return (
    <section className="space-y-6 min-w-0">
      <header className="surface rounded-2xl p-6 sm:p-7 border-l-4 border-l-primary">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Etapa {etapa.numero} de {total}
            </p>
            <h2 className="mt-1 flex items-center gap-3 text-2xl sm:text-3xl font-bold tracking-tight">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              {etapa.titulo}
            </h2>
            <p className="mt-3 text-sm font-medium text-primary">{etapa.frase}</p>
          </div>
          {etapa.to ? (
            <Button asChild className="gap-2">
              <Link to={etapa.to as any}><ExternalLink className="h-4 w-4" /> {etapa.botao}</Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline">Em desenvolvimento</Badge>
              <Button disabled className="gap-2"><ExternalLink className="h-4 w-4" /> {etapa.botao}</Button>
            </div>
          )}
        </div>

        <div className="mt-5 surface-inset rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Objetivo gerencial</p>
          <p className="text-sm">{etapa.objetivo}</p>
        </div>
      </header>

      {etapa.id === "entrevistas" ? (
        <CapitulosInfografico />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Bloco icon={LayoutGrid} titulo="O que você encontrará">
            <Lista items={etapa.encontrar} />
          </Bloco>
          <Bloco icon={Compass} titulo="Como utilizar">
            <Lista items={etapa.comoUsar} />
          </Bloco>
          <Bloco icon={Eye} titulo="O que observar">
            <Lista items={etapa.observar} />
          </Bloco>
          <div className="space-y-4">
            <Bloco icon={Flag} titulo="Decisão esperada" tone="inset">
              <p className="text-sm text-muted-foreground">{etapa.decisao}</p>
            </Bloco>
            <Bloco icon={Lightbulb} titulo="Próximo passo" tone="inset">
              <p className="text-sm text-muted-foreground">{etapa.proximoPasso}</p>
            </Bloco>
          </div>
        </div>
      )}


      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5">
        <Button variant="outline" onClick={onPrev} disabled={index === 0} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Etapa anterior
        </Button>
        <Button onClick={onNext} disabled={index === total - 1} className="gap-2">
          Próxima etapa <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

function CapitulosInfografico() {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-muted/50 via-background to-background p-6 sm:p-10">
      {/* brilho orgânico de fundo */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl"
      />

      <header className="relative mb-8 max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.22em] text-primary/80">Resultado final da entrevista</p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Os 8 capítulos que você encontrará</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Cada entrevista é entregue organizada nestes capítulos — é este o conteúdo que estará disponível para leitura e análise.
        </p>
      </header>

      <ol className="relative grid gap-x-10 gap-y-2 sm:grid-cols-2">
        {ENTREVISTA_CAPITULOS.map((cap, i) => (
          <li key={cap.titulo} className="group relative">
            <div className="relative py-5">
              {/* numeral fantasma */}
              <span
                aria-hidden
                className="block select-none text-[2.6rem] font-black leading-none tabular-nums text-transparent transition-all duration-500 sm:text-[3.4rem] [-webkit-text-stroke:1px_color-mix(in_oklab,var(--foreground)_22%,transparent)] group-hover:[-webkit-text-stroke:1px_var(--primary)]"
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="mt-2 min-w-0 transition-transform duration-500 group-hover:translate-x-1.5">
                <p className="text-base font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary sm:text-lg">
                  {cap.titulo}
                </p>
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{cap.descricao}</p>
              </div>
            </div>

            {i < ENTREVISTA_CAPITULOS.length - (ENTREVISTA_CAPITULOS.length % 2 === 0 ? 2 : 1) && (
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
              />
            )}
          </li>
        ))}
      </ol>

    </section>
  );

}
