import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, BarChart3, Compass, ExternalLink, Eye, Flag,
  LayoutGrid, Lightbulb, MessageSquare, Search, Settings2, Tag, Users, ListChecks, ChevronRight,
} from "lucide-react";
import { GUIA_ETAPAS, type GuiaEtapa } from "@/lib/guia-gerencial";

const ICONES = [MessageSquare, Eye, BarChart3, Users, Search, Tag, ListChecks, Settings2];

/** cor de acento por etapa — usa a paleta de famílias já definida no design system */
const ACENTO = ["--fam-1", "--fam-2", "--fam-3", "--fam-4", "--fam-5", "--fam-6", "--fam-7", "--fam-8"];

const bullets = (e: GuiaEtapa) => [e.encontrar[0], e.comoUsar[0]].filter(Boolean) as string[];

export function GuiaGerencial() {
  const [ativo, setAtivo] = useState<number | null>(null);
  const conteudoRef = useRef<HTMLDivElement | null>(null);

  const abrir = useCallback((i: number) => {
    setAtivo(i);
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
      <section className="border-b border-border bg-gradient-to-b from-primary/12 via-background to-background">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-8 pt-12 pb-8 text-center">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Guia de Uso <span className="text-primary">Gerencial</span>
          </h1>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Siga a trilha para transformar informações comerciais em decisões, prioridades e ações.
          </p>
        </div>

        {/* ---------- TIMELINE HORIZONTAL ---------- */}
        <div className="mx-auto max-w-[1320px] px-4 sm:px-8 pb-12">
          <div className="grid gap-x-5 gap-y-10 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {GUIA_ETAPAS.map((e, i) => (
              <TimelineCard
                key={e.id}
                etapa={e}
                index={i}
                ativo={ativo === i}
                ultimoDaLinha={(i + 1) % 4 === 0}
                onClick={() => abrir(i)}
              />
            ))}
          </div>
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
                        style={on ? { borderColor: `var(${ACENTO[i]})` } : undefined}
                        className={`w-full text-left rounded-lg px-3 py-2 text-xs transition border-l-2 ${
                          on
                            ? "bg-primary/12 border-l-2 font-semibold text-foreground"
                            : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        <span
                          className="mr-2 inline-grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold"
                          style={{
                            backgroundColor: on ? `var(${ACENTO[i]})` : "var(--muted)",
                            color: on ? "var(--background)" : "var(--muted-foreground)",
                          }}
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

            <EtapaDetalhe
              etapa={etapa}
              index={ativo!}
              total={GUIA_ETAPAS.length}
              onPrev={() => abrir(Math.max(0, ativo! - 1))}
              onNext={() => abrir(Math.min(GUIA_ETAPAS.length - 1, ativo! + 1))}
            />
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

function TimelineCard({
  etapa, index, ativo, ultimoDaLinha, onClick,
}: { etapa: GuiaEtapa; index: number; ativo: boolean; ultimoDaLinha: boolean; onClick: () => void }) {
  const Icon = ICONES[index];
  const cor = `var(${ACENTO[index]})`;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative text-left focus-visible:outline-none"
      aria-current={ativo ? "step" : undefined}
    >
      {/* linha conectora */}
      {!ultimoDaLinha && (
        <span
          className="hidden xl:block absolute top-0 left-1/2 right-[-1.25rem] h-px bg-border"
          aria-hidden
        />
      )}
      {/* nó numerado */}
      <span
        className="absolute -top-5 left-5 grid h-10 w-10 place-items-center rounded-full text-sm font-bold shadow-md transition-transform group-hover:scale-110"
        style={{ backgroundColor: cor, color: "var(--background)" }}
      >
        {etapa.numero}
      </span>

      <div
        className="surface rounded-2xl pt-8 pb-5 px-5 h-full transition-all group-hover:-translate-y-1"
        style={{
          borderTop: `3px solid ${cor}`,
          boxShadow: ativo ? `0 0 0 2px ${cor}` : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: `color-mix(in oklab, ${cor} 18%, transparent)`, color: cor }}
          >
            <Icon className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-sm font-bold uppercase tracking-wide leading-tight">{etapa.titulo}</h2>
        </div>

        <ul className="mt-3 space-y-1.5">
          {bullets(etapa).map(b => (
            <li key={b} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
              <span className="line-clamp-2">{b}</span>
            </li>
          ))}
        </ul>

        <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium" style={{ color: cor }}>
          Abrir etapa <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

function Bloco({
  icon: Icon, titulo, cor, children, tone = "card",
}: { icon: any; titulo: string; cor: string; children: React.ReactNode; tone?: "card" | "inset" }) {
  return (
    <div className={`${tone === "inset" ? "surface-inset" : "surface"} rounded-xl p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4" style={{ color: cor }} />
        <h3 className="text-xs font-semibold uppercase tracking-wider">{titulo}</h3>
      </div>
      {children}
    </div>
  );
}

function Lista({ items, cor }: { items: string[]; cor: string }) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map(t => (
        <li key={t} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cor }} aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function EtapaDetalhe({
  etapa, index, total, onPrev, onNext,
}: { etapa: GuiaEtapa; index: number; total: number; onPrev: () => void; onNext: () => void }) {
  const cor = `var(${ACENTO[index]})`;
  const Icon = ICONES[index];
  return (
    <section className="space-y-6 min-w-0">
      <header
        className="surface rounded-2xl p-6 sm:p-7"
        style={{ borderLeft: `4px solid ${cor}` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Etapa {etapa.numero} de {total}
            </p>
            <h2 className="mt-1 flex items-center gap-3 text-2xl sm:text-3xl font-bold tracking-tight">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: `color-mix(in oklab, ${cor} 18%, transparent)`, color: cor }}
              >
                <Icon className="h-5 w-5" />
              </span>
              {etapa.titulo}
            </h2>
            <p className="mt-3 text-sm font-medium" style={{ color: cor }}>{etapa.frase}</p>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Bloco icon={LayoutGrid} titulo="O que você encontrará" cor={cor}>
          <Lista items={etapa.encontrar} cor={cor} />
        </Bloco>
        <Bloco icon={Compass} titulo="Como utilizar" cor={cor}>
          <Lista items={etapa.comoUsar} cor={cor} />
        </Bloco>
        <Bloco icon={Eye} titulo="O que observar" cor={cor}>
          <Lista items={etapa.observar} cor={cor} />
        </Bloco>
        <div className="space-y-4">
          <Bloco icon={Flag} titulo="Decisão esperada" cor={cor} tone="inset">
            <p className="text-sm text-muted-foreground">{etapa.decisao}</p>
          </Bloco>
          <Bloco icon={Lightbulb} titulo="Próximo passo" cor={cor} tone="inset">
            <p className="text-sm text-muted-foreground">{etapa.proximoPasso}</p>
          </Bloco>
        </div>
      </div>

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
