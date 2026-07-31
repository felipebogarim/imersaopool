// Leitura integrada — exclusiva da Visão Rep 2.
// Três camadas sincronizadas por sinal executivo: significado, evidência e comparação.
// Nenhum componente da Visão Rep original é alterado ou reutilizado aqui.

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { CONFIDENCE_LABEL, EVIDENCE_LABEL, type VisaoRep2 } from "@/lib/visao-rep2-schema";
import {
  COMPARISON_LABEL,
  COMPARISON_TONE,
  buildLeituraIntegrada,
  type ComparisonItem,
  type LeituraSignal,
  type PerspectiveEvidence,
} from "@/lib/visao-rep2-leitura";
import { ChevronDown, Quote } from "lucide-react";

const has = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function PanelShell({
  title,
  subtitle,
  children,
  className,
  emphasis,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-muted/20 p-4 sm:p-5",
        emphasis && "bg-card",
        className,
      )}
    >
      <header className="mb-3 min-w-0">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground/80">{subtitle}</p>
      </header>
      <div className="min-w-0 space-y-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{children}</p>;
}

function Bloco({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  if (!has(value)) return null;
  return (
    <div className={cn("rounded-lg border p-3", strong && "border-primary/40 bg-primary/5")}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <p className={cn("whitespace-pre-wrap break-words text-sm leading-relaxed", strong && "font-medium")}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------- seletor

function SignalCard({
  signal,
  active,
  onSelect,
}: {
  signal: LeituraSignal;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`Sinal ${signal.index}: ${signal.title}`}
      className={cn(
        "relative min-w-[240px] flex-1 shrink-0 snap-start rounded-xl border p-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-muted/40",
      )}
    >
      {active ? <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary" aria-hidden /> : null}
      <div className="text-[11px] font-semibold tabular-nums text-muted-foreground">
        {String(signal.index).padStart(2, "0")}
      </div>
      <div className="mt-0.5 break-words text-sm font-semibold leading-snug">{signal.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {signal.confidence ? (
          <Badge variant="outline" className="text-[10px]">
            {CONFIDENCE_LABEL[signal.confidence]}
          </Badge>
        ) : null}
        {signal.evidence ? (
          <Badge variant="secondary" className="text-[10px]">
            {EVIDENCE_LABEL[signal.evidence]}
          </Badge>
        ) : null}
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">
        {signal.perspectives.length} perspectiva{signal.perspectives.length === 1 ? "" : "s"} relacionada
        {signal.perspectives.length === 1 ? "" : "s"}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------- painel 1

function ExecutiveSignalPanelV2({ signal, className }: { signal: LeituraSignal; className?: string }) {
  return (
    <PanelShell title="O que isso significa" subtitle="Conclusão e decisão exigida." emphasis className={className}>
      <h4 className="break-words text-base font-semibold leading-snug">{signal.title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {signal.confidence ? <Badge variant="outline">{CONFIDENCE_LABEL[signal.confidence]}</Badge> : null}
        {signal.evidence ? <Badge variant="secondary">{EVIDENCE_LABEL[signal.evidence]}</Badge> : null}
      </div>
      <Bloco label="Conclusão" value={signal.conclusion} strong />
      <Bloco label="Impacto comercial" value={signal.businessImpact} />
      <Bloco label="Decisão relacionada" value={signal.decision} />
      <Bloco label="Validação" value={signal.validation} />
      {!has(signal.conclusion) && !has(signal.businessImpact) && !has(signal.decision) ? (
        <Empty>Este sinal ainda não possui síntese executiva.</Empty>
      ) : null}
    </PanelShell>
  );
}

// ---------------------------------------------------------------- painel 2

function PerspectiveDetail({ ev }: { ev: PerspectiveEvidence }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] tabular-nums text-muted-foreground">
          {String(ev.perspective.perspective_number).padStart(2, "0")}
        </div>
        <h4 className="break-words text-sm font-semibold">{ev.perspective.perspective_title}</h4>
      </div>

      <Bloco label="Achado específico" value={ev.finding} />

      {ev.entities.length ? (
        <div className="space-y-2">
          {ev.entities.map(g => (
            <div key={g.label}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map(i => (
                  <Badge key={i} variant="outline" className="max-w-full break-words text-[11px]">
                    {i}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {ev.examples.length ? (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Exemplos e evidências
          </div>
          <div className="grid gap-2">
            {ev.examples.map((e, i) => (
              <div key={i} className="rounded-lg border bg-card p-3 text-sm leading-relaxed">
                {e}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Bloco label="Evidência" value={ev.evidence} />

      {ev.quotes.length ? (
        <div className="space-y-2">
          {ev.quotes.map((q, i) => (
            <figure key={i} className="rounded-lg border-l-2 border-primary/50 bg-muted/40 p-3">
              <Quote className="mb-1 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <blockquote className="break-words text-sm italic leading-relaxed">“{q}”</blockquote>
              <figcaption className="mt-1 text-[11px] text-muted-foreground">
                {ev.perspective.perspective_title}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {has(ev.fullReading) ? (
        <div className="rounded-lg border">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver análise completa da perspectiva
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
          {open ? (
            <p className="whitespace-pre-wrap break-words border-t px-3 py-3 text-sm leading-relaxed">
              {ev.fullReading}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PerspectiveEvidencePanelV2({ signal, className }: { signal: LeituraSignal; className?: string }) {
  const [aba, setAba] = useState(0);
  useEffect(() => setAba(0), [signal.id]);
  const atual = signal.perspectives[aba] ?? signal.perspectives[0] ?? null;

  return (
    <PanelShell title="Onde isso apareceu" subtitle="Produtos, marcas, clientes, casos e falas." className={className}>
      {!signal.perspectives.length ? (
        <Empty>Nenhuma perspectiva foi vinculada a este sinal.</Empty>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Perspectivas relacionadas">
            {signal.perspectives.map((p, i) => (
              <button
                key={p.perspective.perspective_number}
                type="button"
                role="tab"
                aria-selected={i === aba}
                onClick={() => setAba(i)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === aba ? "border-primary bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                {p.perspective.perspective_title}
              </button>
            ))}
          </div>
          {atual ? <PerspectiveDetail ev={atual} /> : null}
        </>
      )}
    </PanelShell>
  );
}

// ---------------------------------------------------------------- painel 3

function ComparisonBlock({ item }: { item: ComparisonItem }) {
  const [open, setOpen] = useState(false);
  const temDetalhe = item.details.length > 0 || item.sources.length > 0 || has(item.note ?? "");
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px]", COMPARISON_TONE[item.kind])}>
          {COMPARISON_LABEL[item.kind]}
        </span>
        {item.supporting != null && item.comparable != null ? (
          <span className="text-[11px] text-muted-foreground">
            {item.supporting} de {item.comparable} fontes comparáveis sustentam
          </span>
        ) : null}
      </div>
      <p className="break-words text-sm leading-relaxed">{item.summary}</p>
      {temDetalhe ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="mt-1.5 text-[11px] text-muted-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {open ? "Ocultar detalhes" : "Ver detalhes"}
          </button>
          {open ? (
            <div className="mt-2 space-y-2">
              {item.details.map((d, i) => (
                <div key={i}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {d.label}
                  </div>
                  <p className="break-words text-sm leading-relaxed">{d.value}</p>
                </div>
              ))}
              {item.sources.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {item.sources.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {has(item.note ?? "") ? (
                <p className="text-[11px] text-muted-foreground">{item.note}</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function GroupComparisonPanelV2({
  signal,
  comparableSourceCount,
  className,
}: {
  signal: LeituraSignal;
  comparableSourceCount: number | null;
  className?: string;
}) {
  const sustentam = signal.comparisons.filter(c => c.kind === "consenso").length;
  return (
    <PanelShell title="Como isso se compara ao grupo" subtitle="Consenso, ausência, divergência e exclusividade." className={className}>
      {!signal.comparisons.length ? (
        <Empty>Este sinal ainda não possui comparação com o grupo.</Empty>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {comparableSourceCount != null ? (
              <Badge variant="outline">{comparableSourceCount} fontes comparáveis</Badge>
            ) : null}
            {sustentam ? <Badge variant="secondary">{sustentam} ponto(s) sustentado(s)</Badge> : null}
          </div>
          <div className="space-y-2">
            {signal.comparisons.map((c, i) => (
              <ComparisonBlock key={i} item={c} />
            ))}
          </div>
        </>
      )}
    </PanelShell>
  );
}

// ---------------------------------------------------------------- seção

export function LeituraIntegradaV2({ visao }: { visao: VisaoRep2 }) {
  const leitura = useMemo(() => buildLeituraIntegrada(visao), [visao]);
  const [sel, setSel] = useState(0);
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<"sintese" | "evidencias" | "grupo">("sintese");

  const signal = leitura.signals[sel] ?? leitura.signals[0] ?? null;

  if (!leitura.signals.length) {
    return (
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold tracking-tight">Leitura integrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">Este relatório não possui sinais prioritários.</p>
      </section>
    );
  }

  return (
    <BlocoExpansivel
      titulo="Leitura integrada"
      descricao="Selecione um sinal estratégico para acompanhar sua síntese, as evidências da entrevista e o paralelo com o grupo."
    >
      <div className="space-y-4">


      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible">
        {leitura.signals.map((s, i) => (
          <SignalCard key={s.id} signal={s} active={i === sel} onSelect={() => setSel(i)} />
        ))}
      </div>

      {leitura.semVinculos ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          O relatório foi importado, mas ainda não possui vínculos para a Leitura integrada.
        </p>
      ) : null}

      {signal ? (
        isMobile ? (
          <div className="space-y-3">
            <div className="flex gap-1.5" role="tablist" aria-label="Camadas de leitura">
              {(
                [
                  ["sintese", "Síntese"],
                  ["evidencias", "Evidências"],
                  ["grupo", "Grupo"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={mobileTab === k}
                  onClick={() => setMobileTab(k)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    mobileTab === k ? "border-primary bg-primary/10" : "text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {mobileTab === "sintese" ? <ExecutiveSignalPanelV2 signal={signal} /> : null}
            {mobileTab === "evidencias" ? <PerspectiveEvidencePanelV2 signal={signal} /> : null}
            {mobileTab === "grupo" ? (
              <GroupComparisonPanelV2 signal={signal} comparableSourceCount={leitura.comparableSourceCount} />
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-12">
            <ExecutiveSignalPanelV2 signal={signal} className="md:col-span-4 xl:col-span-3" />
            <PerspectiveEvidencePanelV2 signal={signal} className="md:col-span-8 xl:col-span-6" />
            <GroupComparisonPanelV2
              signal={signal}
              comparableSourceCount={leitura.comparableSourceCount}
              className="md:col-span-12 xl:col-span-3"
            />
          </div>
        )
      ) : null}

      {has(leitura.methodologyNote ?? "") ? (
        <p className="text-xs text-muted-foreground">{leitura.methodologyNote}</p>
      ) : null}
      </div>
    </BlocoExpansivel>
  );
}
