import { Fragment, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronDown, Quote, X } from "lucide-react";
import {
  CONFIDENCE_LABEL,
  EVIDENCE_LABEL,
  type Perspective,
} from "@/lib/visao-rep2-schema";

type Capitulo = { titulo: string; itens: string[]; tipo: "texto" | "campo" | "citacao" };

const has = (v?: string | null) => typeof v === "string" && v.trim().length > 0;

/** Título curto derivado do próprio conteúdo, no padrão visual do Raio-X. */
function tituloDoTexto(texto: string, fallback: string) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  const palavras = limpo
    .split(" ")
    .filter(p => p.replace(/[^\p{L}\p{N}]/gu, "").length > 3)
    .slice(0, 4);
  return palavras.length >= 2 ? palavras.join(" ") : fallback;
}

function capitulosDaPerspectiva(p: Perspective): Capitulo[] {
  const caps: Capitulo[] = [];
  const push = (titulo: string, valor?: string | null, tipo: Capitulo["tipo"] = "texto") => {
    if (!has(valor)) return;
    caps.push({ titulo, itens: [valor!.trim()], tipo });
  };

  if (has(p.executive_finding)) {
    caps.push({
      titulo: tituloDoTexto(p.executive_finding!, "Achado executivo"),
      itens: [p.executive_finding!.trim()],
      tipo: "texto",
    });
  }
  push("Impacto comercial", p.business_impact);
  push("Ação recomendada", p.recommended_action);
  push("Evidência", p.evidence);
  push("Classificação comparativa", p.comparative_classification);

  for (const [k, v] of Object.entries(p.structured_fields ?? {})) {
    const itens = (Array.isArray(v) ? v : [v]).map(s => String(s).trim()).filter(Boolean);
    if (itens.length) caps.push({ titulo: k, itens, tipo: "campo" });
  }

  push("Citação de origem", p.source_quote, "citacao");
  if (has(p.full_reading)) {
    caps.push({ titulo: "Análise completa", itens: [p.full_reading!.trim()], tipo: "texto" });
  }
  return caps;
}

function intensidadeDa(p: Perspective) {
  const campos = [
    p.executive_finding,
    p.business_impact,
    p.recommended_action,
    p.evidence,
    p.comparative_classification,
    p.source_quote,
    p.full_reading,
  ];
  const preenchidos = campos.filter(has).length;
  return Math.round((preenchidos / campos.length) * 100);
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

export function PerspectivasRep2({ perspectives }: { perspectives: Perspective[] }) {
  const [ativa, setAtiva] = useState<number | null>(null);
  const detalheRef = useRef<HTMLDivElement | null>(null);
  const sel = perspectives.find(p => p.perspective_number === ativa) ?? null;

  useEffect(() => {
    if (ativa == null) return;
    const t = window.setTimeout(() => {
      detalheRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [ativa]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {perspectives.map(p => {
        const isAtiva = p.perspective_number === ativa;
        return (
          <Fragment key={p.perspective_number}>
            <div className={cn(isAtiva ? "order-1" : ativa != null ? "order-3" : "order-none")}>
              <PerspectivaCard
                p={p}
                ativa={isAtiva}
                onOpen={() => setAtiva(isAtiva ? null : p.perspective_number)}
              />
            </div>
            {isAtiva && sel && (
              <div ref={detalheRef} className="order-2 sm:col-span-2 xl:col-span-4 scroll-mt-24">
                <PerspectivaDetalhe p={sel} onClose={() => setAtiva(null)} />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function Cabecalho({ p, grande }: { p: Perspective; grande?: boolean }) {
  const caps = capitulosDaPerspectiva(p);
  const intensidade = intensidadeDa(p);
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="relative">
        <Ring value={intensidade} />
        <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums">
          {p.perspective_number}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold", grande ? "text-base" : "text-sm truncate")}>
          {p.perspective_title}
        </p>
        <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
          {grande ? `${caps.length} capítulos · ` : ""}
          {caps.length} sinais · intensidade {intensidade}%
        </p>
      </div>
    </div>
  );
}

function Selos({ p }: { p: Perspective }) {
  if (!p.confidence_level && !p.evidence_status) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {p.confidence_level ? <Badge variant="outline">{CONFIDENCE_LABEL[p.confidence_level]}</Badge> : null}
      {p.evidence_status ? <Badge variant="secondary">{EVIDENCE_LABEL[p.evidence_status]}</Badge> : null}
    </div>
  );
}

function PerspectivaCard({ p, ativa, onOpen }: { p: Perspective; ativa: boolean; onOpen: () => void }) {
  const caps = capitulosDaPerspectiva(p);
  const vazia = caps.length === 0;
  return (
    <div
      className={cn(
        "surface h-full rounded-xl p-3.5 transition-colors",
        vazia && "opacity-60",
        ativa && "ring-2 ring-primary",
      )}
    >
      <Cabecalho p={p} />
      <div className="mt-2.5">
        <Selos p={p} />
      </div>
      {vazia ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Sem conteúdo informado.</p>
      ) : (
        <button
          onClick={onOpen}
          className="mt-2.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", ativa && "rotate-180")} />
          {ativa ? "Fechar detalhe" : `Ver detalhe · ${caps.length} capítulos`}
        </button>
      )}
    </div>
  );
}

function PerspectivaDetalhe({ p, onClose }: { p: Perspective; onClose: () => void }) {
  const caps = capitulosDaPerspectiva(p);
  return (
    <section className="surface rounded-2xl border border-primary/30 p-4 sm:p-5 space-y-4">
      <header className="flex items-start gap-3">
        <Cabecalho p={p} grande />
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Fechar detalhe"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <Selos p={p} />

      {caps.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem conteúdo informado.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {caps.map((cap, i) => (
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
                      className={cn(
                        "whitespace-pre-wrap text-xs leading-relaxed",
                        cap.tipo === "citacao" && "italic text-muted-foreground",
                      )}
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
