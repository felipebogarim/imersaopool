// Leitura integrada — exclusiva da Visão Rep.
// Três camadas sincronizadas por sinal executivo: significado, evidência e comparação.
// Nenhum componente da Visão Rep original é alterado ou reutilizado aqui.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { BlocoExpansivel } from "./BlocoExpansivel";
import { AcoesSecao } from "./AcoesSecao";
import { MarkdownView } from "@/components/MarkdownView";

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

/** Contexto das notas/ações dos painéis (representante + sinal selecionado). */
const LeituraAcoesCtx = createContext<{ contexto?: string; escopo?: string }>({});


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
  const acoes = useContext(LeituraAcoesCtx);
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-muted/20 p-4 sm:p-5",
        emphasis && "bg-card",
        className,
      )}
    >
      <header className="mb-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground/80">{subtitle}</p>
        </div>
        <AcoesSecao titulo={title} descricao={subtitle} contexto={acoes.contexto} escopo={acoes.escopo} />
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
      <div className={cn("whitespace-pre-wrap break-words text-sm leading-relaxed", strong && "font-medium")}>
        <MarkdownView markdown={value ?? ""} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- seletor

function SignalCard({
  signal,
  active,
  total,
  onSelect,
}: {
  signal: LeituraSignal;
  active: boolean;
  total: number;
  onSelect: () => void;
}) {
  const detalhe = (
    <div className="w-[206px] space-y-2">
      <div
        className={cn(
          "break-words text-sm font-semibold leading-snug",
          active ? "text-foreground" : "text-foreground/90",
        )}
      >
        {signal.title}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {signal.confidence ? (
          <Badge variant={active ? "default" : "outline"} className="text-[10px]">
            {CONFIDENCE_LABEL[signal.confidence]}
          </Badge>
        ) : null}
        {signal.evidence ? (
          <Badge variant="secondary" className="text-[10px]">
            {EVIDENCE_LABEL[signal.evidence]}
          </Badge>
        ) : null}
      </div>
      <div className={cn("text-[11px]", active ? "text-foreground/70" : "text-muted-foreground/80")}>
        {signal.perspectives.length} perspectiva{signal.perspectives.length === 1 ? "" : "s"} relacionada
        {signal.perspectives.length === 1 ? "" : "s"}
      </div>
    </div>
  );

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      aria-label={`Sinal ${signal.index} de ${total}: ${signal.title}`}
      className={cn(
        "group relative flex shrink-0 snap-start flex-col gap-2 rounded-xl border-2 p-3 text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "w-[230px] flex-1 border-primary bg-primary/10 shadow-md"
          : "w-14 border-transparent bg-muted/40 hover:bg-muted/70",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition-colors",
            active ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15 text-muted-foreground",
          )}
        >
          {signal.index}
        </span>
      </div>

      {active ? (
        detalhe
      ) : (
        // Overlay: cresce por cima dos vizinhos, sem deslocar o layout (evita flicker no hover).
        <div
          className={cn(
            "pointer-events-none invisible absolute left-0 top-0 z-30 w-[230px] rounded-xl border-2 border-transparent bg-muted p-3 opacity-0 shadow-lg",
            "group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100",
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted-foreground/15 text-[11px] font-bold tabular-nums text-muted-foreground"
            >
              {signal.index}
            </span>
          </div>
          {detalhe}
        </div>
      )}

      {active ? (
        <span
          aria-hidden
          className="absolute -bottom-[9px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-primary bg-primary/10"
        />
      ) : null}
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

function QuoteCard({ 
  quote, 
  allQuotes 
}: { 
  quote: string; 
  allQuotes: any[] 
}) {
  // Tenta localizar o objeto da citação se o input for um ID (V2_JSON)
  const qObj = allQuotes?.find(q => q.id === quote);
  
  if (qObj) {
    const isReported = qObj.quote_type === "reported";
    const authorInfo = qObj.reported_by
      ? `${qObj.original_author} · fala relatada por ${qObj.reported_by}`
      : `${qObj.original_author}${qObj.original_author_role ? ` (${qObj.original_author_role})` : ""}`;
      
    return (
      <figure className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
        <Quote className="mb-2 h-4 w-4 text-primary/60" aria-hidden />
        <blockquote className="break-words text-sm italic leading-relaxed text-foreground/90">
          <MarkdownView markdown={qObj.text.startsWith('“') ? qObj.text : `“${qObj.text}”`} />
        </blockquote>
        <figcaption className="mt-3 flex flex-col gap-1 border-t pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="font-semibold text-foreground/70">{authorInfo}</span>
          {isReported && <span className="text-[9px] text-primary/70">Fala Relatada</span>}
        </figcaption>
      </figure>
    );
  }

  // Fallback para strings simples (Legado/V1)
  return (
    <figure className="rounded-lg border-l-2 border-primary/50 bg-muted/40 p-3">
      <Quote className="mb-1 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <blockquote className="break-words text-sm italic leading-relaxed">
        <MarkdownView markdown={quote.startsWith('“') ? quote : `“${quote}”`} />
      </blockquote>
      <figcaption className="mt-1 text-[11px] text-muted-foreground uppercase tracking-wider">
        Fala do representante
      </figcaption>
    </figure>
  );
}

function PerspectiveDetail({ ev, signal, visao }: { ev: PerspectiveEvidence; signal: LeituraSignal; visao: VisaoRep2 }) {
  const [open, setOpen] = useState(false);
  const [showAllQuotes, setShowAllQuotes] = useState(false);
  
  const allQuotes = (visao as any).source_control?.structured_data?.data?.quotes || 
                    (visao as any).legacy?.quotes || [];
                    
  const visibleQuotes = showAllQuotes ? ev.quotes : ev.quotes.slice(0, 3);
  
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <div className="text-[11px] font-bold tabular-nums text-primary/60">
          {String(ev.perspective.perspective_number).padStart(2, "0")}
        </div>
        <h4 className="break-words text-sm font-semibold tracking-tight">{ev.perspective.perspective_title}</h4>
      </div>

      <div className="grid gap-3">
        <Bloco label="Achado específico" value={ev.finding} />
        
        {has(ev.addedDetail) && (
          <Bloco label="Detalhe adicional" value={ev.addedDetail} />
        )}

        {ev.entities.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ev.entities.map(g => (
              <div key={g.label} className="rounded-lg border bg-muted/10 p-2">
                <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
                  {g.label}
                </div>
                <div className="flex flex-wrap gap-1">
                  {g.items.map(i => (
                    <Badge key={i} variant="outline" className="bg-background text-[10px] font-normal">
                      {i}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {ev.quotes.length ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
              Evidências ({ev.quotes.length})
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-1">
            {visibleQuotes.map((q, i) => (
              <QuoteCard key={i} quote={q} allQuotes={allQuotes} />
            ))}
          </div>
          
          {ev.quotes.length > 3 && !showAllQuotes && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowAllQuotes(true)}
              className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Ver mais evidências (+{ev.quotes.length - 3})
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>
      ) : null}

      {has(ev.fullReading) ? (
        <div className="overflow-hidden rounded-lg border bg-muted/5">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            ANÁLISE COMPLETA DA PERSPECTIVA
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
          {open ? (
            <div className="border-t bg-background px-4 py-4 text-sm leading-relaxed shadow-inner">
              <MarkdownView markdown={ev.fullReading} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


function PerspectiveEvidencePanelV2({ signal, visao, className }: { signal: LeituraSignal; visao: VisaoRep2; className?: string }) {
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
          {atual ? <PerspectiveDetail ev={atual} signal={signal} visao={visao} /> : null}
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
        <span className={cn("rounded-full px-2 py-0.5 text-[11px]", item.toneOverride ?? COMPARISON_TONE[item.kind])}>
          {item.labelOverride ?? COMPARISON_LABEL[item.kind]}
        </span>
        {item.supporting != null && item.comparable != null ? (
          <span className="text-[11px] text-muted-foreground">
            {item.supporting} de {item.comparable} fontes comparáveis sustentam
          </span>
        ) : item.comparable != null ? (
          <span className="text-[11px] text-muted-foreground">
            Base comparável: {item.comparable} entrevista{item.comparable === 1 ? "" : "s"}
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

export function LeituraIntegradaV2({ visao, defaultOpen = false }: { visao: VisaoRep2; defaultOpen?: boolean }) {
  const leitura = useMemo(() => buildLeituraIntegrada(visao), [visao]);
  const [sel, setSel] = useState(0);
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<"sintese" | "evidencias" | "grupo">("sintese");

  const signal = leitura.signals[sel] ?? leitura.signals[0] ?? null;

  const contexto =
    visao.metadata.representative_id ?? visao.metadata.representative_name ?? undefined;
  const acoesCtx = useMemo(
    () => ({ contexto, escopo: signal ? `sinal-${signal.id}` : "leitura" }),
    [contexto, signal?.id],
  );

  if (!leitura.signals.length) {
    return (
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold tracking-tight">Leitura integrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">Este relatório não possui sinais prioritários.</p>
      </section>
    );
  }

  return (
    <LeituraAcoesCtx.Provider value={acoesCtx}>
    <BlocoExpansivel
      titulo="Leitura integrada"
      descricao="Selecione um sinal estratégico para acompanhar sua síntese, as evidências da entrevista e o paralelo com o grupo."
      contexto={contexto}
      defaultOpen={defaultOpen}
    >
      <div className="space-y-5">
        <nav aria-label="Sinais estratégicos" className="rounded-xl border bg-muted/25 p-3 sm:p-4">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Menu de sinais · escolha um para atualizar o painel abaixo
            </p>
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
              {sel + 1} de {leitura.signals.length}
            </span>
          </div>
          <div
            role="tablist"
            aria-label="Sinais estratégicos"
            className="-mx-1 flex snap-x items-stretch gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible"
          >
            {leitura.signals.map((s, i) => (
              <SignalCard
                key={s.id}
                signal={s}
                active={i === sel}
                total={leitura.signals.length}
                onSelect={() => setSel(i)}
              />
            ))}
          </div>
        </nav>


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
    </LeituraAcoesCtx.Provider>
  );
}
