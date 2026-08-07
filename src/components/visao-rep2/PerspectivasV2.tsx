// Perspectivas da entrevista — navegação principal exclusiva da Visão Rep.
// Preserva o modelo visual aprovado nos Temas estratégicos (narrativa 8 col + apoio 4 col).
// Nenhum componente da Visão Rep original é alterado ou reutilizado aqui.

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { MarkdownView } from "@/components/MarkdownView";
import { cn } from "@/lib/utils";
import type { BriefConclusao, BriefEntidades, BriefPerspectiva } from "./briefing-fabio";
import { PERSPECTIVAS_META, type AgendaRef, type PerspectivaVM } from "@/lib/visao-rep2-perspectivas";
import { BlocoExpansivel } from "./BlocoExpansivel";
import { AcoesSecao } from "./AcoesSecao";


const has = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/* ------------------------------------------------------------------ */
/* Conclusões centrais — resumo compacto, nunca navegação              */
/* ------------------------------------------------------------------ */

export function ConclusoesCentraisV2({ conclusoes }: { conclusoes: BriefConclusao[] }) {
  if (!conclusoes.length) return null;
  return (
    <BlocoExpansivel
      titulo="Conclusões centrais"
      descricao="Os principais efeitos comerciais que atravessam diferentes perspectivas da entrevista."
    >
      <ol className="grid gap-4 sm:grid-cols-2">
        {conclusoes.map((c, i) => (
          <li key={c.titulo} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-l-2 border-border pl-3">
            <span className="tabular-nums text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-6">{c.titulo}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{c.frase}</p>
            </div>
          </li>
        ))}
      </ol>
    </BlocoExpansivel>
  );
}


/* ------------------------------------------------------------------ */
/* Painel de apoio                                                     */
/* ------------------------------------------------------------------ */

function ChipGroup({ label, itens }: { label: string; itens?: string[] }) {
  if (!itens?.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {itens.map(i => (
          <span key={i} className="rounded-md border px-2 py-0.5 text-xs">
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

function EntidadesV2({ e }: { e: BriefEntidades }) {
  const vazio = !e.produtos?.length && !e.concorrentes?.length && !e.clientes?.length && !e.ferramentas?.length;
  if (vazio) return null;
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Entidades citadas</p>
      <ChipGroup label="Produtos" itens={e.produtos} />
      <ChipGroup label="Concorrentes" itens={e.concorrentes} />
      <ChipGroup label="Clientes" itens={e.clientes} />
      <ChipGroup label="Ferramentas" itens={e.ferramentas} />
    </div>
  );
}

function PainelApoio({ p, ctx }: { p: PerspectivaVM; ctx: SecaoCtx }) {
  return (
    <aside className="space-y-6 rounded-xl border bg-muted/20 p-5" aria-label="Apoio à leitura da perspectiva">
      <div className="space-y-2">
        <TituloSecao titulo="Evidência principal" descricao={p.evidencia ?? ""} ctx={ctx}>
          Evidência principal
        </TituloSecao>
        {has(p.evidencia) ? (
          <figure className="space-y-1">
            <div className="border-l-2 border-primary pl-3 text-sm italic leading-6 text-muted-foreground">
              <MarkdownView markdown={p.evidencia?.startsWith('“') ? p.evidencia : `“${p.evidencia}”`} />
            </div>
            <figcaption className="pl-3 text-[11px] uppercase tracking-wide text-muted-foreground/80">
              Fala do representante
            </figcaption>
          </figure>
        ) : (
          <p className="text-sm text-muted-foreground">Esta perspectiva ainda não possui evidência destacada.</p>
        )}
      </div>

      <EntidadesV2 e={p.entidades} />

      <div className="space-y-2">
        <TituloSecao titulo="Comparação com o grupo" descricao={p.comparacao ?? ""} ctx={ctx}>
          Comparação com o grupo
        </TituloSecao>
        <p className="text-sm leading-6 text-muted-foreground">
          {has(p.comparacao) ? p.comparacao : "Não há comparação suficiente com o grupo."}
        </p>
      </div>

      {has(p.confianca) ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Nível de confiança</p>
          <Badge variant="outline">Confiança {p.confianca}</Badge>
        </div>
      ) : null}

      {p.conclusoes.length ? (
        <div className="space-y-2">
          <TituloSecao titulo="Conclusões centrais relacionadas" descricao={p.conclusoes.join(" · ")} ctx={ctx}>
            Conclusões centrais relacionadas
          </TituloSecao>
          <div className="flex flex-wrap gap-1.5">
            {p.conclusoes.map(c => (
              <span key={c} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {c}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Narrativa principal                                                 */
/* ------------------------------------------------------------------ */

function AgendaRefBloco({ label, prefixo, ref: r }: { label: string; prefixo: string; ref: AgendaRef }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      {r.indice ? (
        <p className="mt-1.5 text-sm leading-7">
          <span className="text-muted-foreground">
            {prefixo} {r.indice}:{" "}
          </span>
          {r.texto}
        </p>
      ) : (
        <p className="mt-1.5 text-sm leading-7">{r.texto}</p>
      )}
    </div>
  );
}

type SecaoCtx = { contexto?: string; escopo: string };

function TituloSecao({
  children,
  titulo,
  descricao,
  ctx,
  className = "text-sm font-semibold",
}: {
  children: ReactNode;
  titulo: string;
  descricao?: string;
  ctx: SecaoCtx;
  className?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className={className}>{children}</p>
      <AcoesSecao titulo={titulo} descricao={descricao} contexto={ctx.contexto} escopo={ctx.escopo} />
    </div>
  );
}

function Narrativa({ p, ctx }: { p: PerspectivaVM; ctx: SecaoCtx }) {
  return (
    <div className="min-w-0 space-y-6 lg:col-span-8">
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {String(p.numero).padStart(2, "0")} · {p.descricao}
        </p>
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xl font-semibold tracking-tight sm:text-2xl">{p.tituloConclusivo}</h4>
          <AcoesSecao
            titulo={`${String(p.numero).padStart(2, "0")} · ${p.nome}`}
            descricao={p.tituloConclusivo}
            contexto={ctx.contexto}
            escopo={ctx.escopo}
          />
        </div>
        {has(p.contexto) ? (
          <MarkdownView markdown={has(p.contexto) ? p.contexto : ""} />
        ) : null}
      </div>


      {p.ondeAparece.length ? (
        <div className="space-y-2">
          <TituloSecao
            titulo="Onde isso aparece"
            descricao={p.ondeAparece.join(" · ")}
            ctx={ctx}
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Onde isso aparece
          </TituloSecao>
          <ul className="space-y-2">
            {p.ondeAparece.map((o, i) => (
              <li key={i} className="flex gap-3 text-sm leading-6">
                <span className="shrink-0 tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">{o}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {has(p.representa) ? (
        <div className="rounded-lg border-l-2 border-primary bg-muted/30 p-4">
          <TituloSecao
            titulo="O que isso representa"
            descricao={p.representa ?? ""}
            ctx={ctx}
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            O que isso representa
          </TituloSecao>
          <p className="mt-1.5 max-w-[68ch] text-sm leading-7">{p.representa}</p>
        </div>
      ) : null}

      {p.decisao || p.validacao ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {p.decisao ? (
            <AgendaRefBloco label="Decisão relacionada" prefixo="Decisão executiva" ref={p.decisao} />
          ) : null}
          {p.validacao ? (
            <AgendaRefBloco label="Validação relacionada" prefixo="Validação necessária" ref={p.validacao} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navegação das oito perspectivas                                     */
/* ------------------------------------------------------------------ */

export function PerspectivasEntrevistaV2({
  perspectivas,
  contexto,
  mode = "rep",
}: {
  perspectivas: PerspectivaVM[];
  contexto?: string;
  mode?: "rep" | "imersao";
}) {
  const primeira = perspectivas.find(p => p.temConteudo) ?? perspectivas[0];
  const [ativo, setAtivo] = useState<number>(primeira?.numero ?? 1);
  const p = perspectivas.find(x => x.numero === ativo) ?? primeira;
  if (!p) return null;

  return (
    <BlocoExpansivel
      titulo={mode === "imersao" ? "Capítulos da imersão" : "Perspectivas da entrevista"}
      descricao={mode === "imersao" ? "Leitura detalhada de cada capítulo do relatório final." : "Selecione uma perspectiva para aprofundar a leitura, as evidências e sua relação com o grupo."}
    >
      <div className="space-y-5">


      <div
        role="tablist"
        aria-label="Perspectivas da entrevista"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible xl:grid-cols-8"
      >
        {perspectivas.map(item => {
          const sel = item.numero === p.numero;
          return (
            <button
              key={item.numero}
              role="tab"
              type="button"
              aria-selected={sel}
              aria-controls="vr2-perspectiva-panel"
              onClick={() => setAtivo(item.numero)}
              className={cn(
                "min-h-11 min-w-[9.5rem] shrink-0 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-w-0",
                sel
                  ? "border-primary bg-primary/10 font-semibold text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="tabular-nums text-xs text-muted-foreground">
                  {String(item.numero).padStart(2, "0")}
                </span>
                <span className="min-w-0 truncate">{item.nome}</span>
                {item.temConteudo ? (
                  <span
                    aria-hidden
                    className={cn("ml-auto h-1.5 w-1.5 shrink-0 rounded-full", sel ? "bg-primary" : "bg-muted-foreground/40")}
                  />
                ) : null}
                {sel ? <span className="sr-only">(selecionada)</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div id="vr2-perspectiva-panel" role="tabpanel" className="rounded-xl border bg-card p-5 sm:p-6">
        {p.temConteudo ? (
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
            <Narrativa p={p} ctx={{ contexto, escopo: `p${String(p.numero).padStart(2, "0")}` }} />
            <div className="min-w-0 lg:col-span-4">
              <PainelApoio p={p} ctx={{ contexto, escopo: `p${String(p.numero).padStart(2, "0")}` }} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Esta perspectiva ainda não possui conteúdo registrado.</p>
        )}
      </div>
      </div>
    </BlocoExpansivel>

  );
}

/* ------------------------------------------------------------------ */
/* Conversão do protótipo curado para o modelo de leitura              */
/* ------------------------------------------------------------------ */

export function briefPerspectivasToVM(
  perspectivas: BriefPerspectiva[],
  agenda: { decisoes: string[]; validacoes: string[] },
): PerspectivaVM[] {
  return PERSPECTIVAS_META.map(meta => {
    const b = perspectivas.find(x => x.numero === meta.numero);
    const decisao =
      b?.decisaoRef && agenda.decisoes[b.decisaoRef - 1]
        ? { texto: agenda.decisoes[b.decisaoRef - 1], indice: b.decisaoRef }
        : null;
    const validacao =
      b?.validacaoRef && agenda.validacoes[b.validacaoRef - 1]
        ? { texto: agenda.validacoes[b.validacaoRef - 1], indice: b.validacaoRef }
        : null;
    return {
      ...meta,
      tituloConclusivo: b?.tituloConclusivo ?? meta.descricao,
      contexto: b?.contexto ?? null,
      ondeAparece: b?.ondeAparece ?? [],
      representa: b?.representa ?? null,
      decisao,
      validacao,
      evidencia: b?.evidencia ?? null,
      entidades: b?.entidades ?? {},
      comparacao: b?.comparacao ?? null,
      confianca: b?.confianca ?? null,
      conclusoes: b?.conclusoes ?? [],
      temConteudo: Boolean(b?.contexto || b?.representa || b?.ondeAparece?.length || b?.evidencia),
    } satisfies PerspectivaVM;
  });
}
