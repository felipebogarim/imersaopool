// Áreas de Aprofundamento — camada complementar exclusiva da Visão Imersão 2.
// Mostra apenas achados adicionais (título curto, contexto, citação, implicação),
// sem recapitular a conclusão da perspectiva nem o painel lateral das Perspectivas.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MarkdownView } from "@/components/MarkdownView";
import { BlocoExpansivel } from "@/components/visao-rep2/BlocoExpansivel";
import type { PerspectivaVM } from "@/lib/visao-rep2-perspectivas";

export type Achado = {
  titulo: string;
  contexto: string[];
  citacoes: string[];
  implicacao: string | null;
};

const IMPLICACAO_RE = /^\s*\**\s*(leitura executiva|implica[cç][aã]o|por que importa)\s*\**\s*:?\s*$/i;

/** Extrai os achados adicionais de um capítulo em markdown (blocos iniciados por "###"). */
export function extrairAchados(markdown: string | null | undefined): Achado[] {
  const md = (markdown ?? "").trim();
  if (!md) return [];

  const linhas = md.split(/\r?\n/);
  const achados: Achado[] = [];
  let atual: Achado | null = null;
  let modoImplicacao = false;
  let buffer: string[] = [];
  let lista: string[] = [];

  const flushLista = () => {
    if (!lista.length || !atual) {
      lista = [];
      return;
    }
    const bloco = lista.join("\n");
    lista = [];
    if (modoImplicacao) {
      atual.implicacao = atual.implicacao ? `${atual.implicacao} ${bloco}` : bloco;
    } else {
      atual.contexto.push(bloco);
    }
  };

  const flushParagrafo = () => {
    const texto = buffer.join(" ").trim();
    buffer = [];
    if (!texto || !atual) return;
    if (modoImplicacao) {
      atual.implicacao = atual.implicacao ? `${atual.implicacao} ${texto}` : texto;
    } else {
      atual.contexto.push(texto);
    }
  };


  const flushBlocos = () => {
    flushParagrafo();
    flushLista();
  };

  for (const raw of linhas) {
    const linha = raw.trim();

    const h3 = /^#{3,6}\s+(.*)$/.exec(linha);
    if (h3) {
      flushBlocos();
      if (atual) achados.push(atual);
      atual = { titulo: h3[1].replace(/\*+/g, "").trim(), contexto: [], citacoes: [], implicacao: null };
      modoImplicacao = false;
      continue;
    }

    // Ignora tudo antes do primeiro achado (recapitulação do capítulo).
    if (!atual) continue;

    if (/^#{1,2}\s+/.test(linha)) {
      flushBlocos();
      achados.push(atual);
      atual = null;
      modoImplicacao = false;
      continue;
    }

    if (!linha) {
      flushParagrafo();
      continue;
    }

    if (IMPLICACAO_RE.test(linha)) {
      flushBlocos();
      modoImplicacao = true;
      continue;
    }

    const cit = /^>\s?(.*)$/.exec(linha);
    if (cit) {
      flushBlocos();
      const texto = cit[1].replace(/^[“"']+|[”"']+$/g, "").trim();
      if (texto) atual.citacoes.push(texto);
      continue;
    }

    // Bullets viram lista semântica (um item por linha), nunca parágrafo concatenado.
    const bullet = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(linha);
    if (bullet) {
      flushParagrafo();
      const item = bullet[1].trim();
      if (item) lista.push(`- ${item}`);
      continue;
    }

    // Continuação de um item de lista pertence ao último item.
    if (lista.length) {
      lista[lista.length - 1] = `${lista[lista.length - 1]} ${linha}`;
      continue;
    }

    buffer.push(linha);
  }
  flushBlocos();
  if (atual) achados.push(atual);


  return achados.filter(a => a.titulo && (a.contexto.length || a.citacoes.length || a.implicacao));
}

function AchadoCard({ a }: { a: Achado }) {
  return (
    <article className="space-y-3 border-l-2 border-border pl-4">
      <h4 className="text-base font-semibold leading-6 tracking-tight">{a.titulo}</h4>
      {a.contexto.map((p, i) => (
        <div key={i} className="max-w-[72ch] text-sm leading-7 text-muted-foreground">
          <MarkdownView markdown={p} />
        </div>
      ))}
      {a.citacoes.map((c, i) => (
        <figure key={i} className="rounded-lg border bg-muted/20 p-3">
          <blockquote className="text-sm italic leading-6">“{c}”</blockquote>
        </figure>
      ))}
      {a.implicacao ? (
        <div className="rounded-lg border-l-2 border-primary bg-muted/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Implicação</p>
          <p className="mt-1 max-w-[72ch] text-sm leading-7">{a.implicacao}</p>
        </div>
      ) : null}
    </article>
  );
}

export function AreasAprofundamento({
  perspectivas,
  titulo = "ÁREAS DE APROFUNDAMENTO",
  defaultOpen = false,
}: {
  perspectivas: PerspectivaVM[];
  titulo?: string;
  defaultOpen?: boolean;
}) {
  const achadosPorNumero = new Map<number, Achado[]>(
    perspectivas.map(p => [p.numero, extrairAchados(p.contexto)]),
  );

  const primeira = perspectivas.find(p => (achadosPorNumero.get(p.numero) ?? []).length) ?? perspectivas[0];
  const [ativo, setAtivo] = useState<number>(primeira?.numero ?? 1);
  const p = perspectivas.find(x => x.numero === ativo) ?? primeira;
  if (!p) return null;

  const achados = achadosPorNumero.get(p.numero) ?? [];

  return (
    <BlocoExpansivel
      defaultOpen={defaultOpen}
      titulo={titulo}
      descricao="Somente pontos adicionais e específicos, diferentes do que já foi apresentado na Síntese Estratégica e na Leitura Integrada."
    >
      <div className="space-y-5">
        <div
          role="tablist"
          aria-label="Áreas de aprofundamento"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible xl:grid-cols-8"
        >
          {perspectivas.map(item => {
            const sel = item.numero === p.numero;
            const tem = (achadosPorNumero.get(item.numero) ?? []).length > 0;
            return (
              <button
                key={item.numero}
                role="tab"
                type="button"
                aria-selected={sel}
                aria-controls="vi2-aprofundamento-panel"
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
                  {tem ? (
                    <span
                      aria-hidden
                      className={cn(
                        "ml-auto h-1.5 w-1.5 shrink-0 rounded-full",
                        sel ? "bg-primary" : "bg-muted-foreground/40",
                      )}
                    />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <div id="vi2-aprofundamento-panel" role="tabpanel" className="rounded-xl border bg-card p-5 sm:p-6">
          {achados.length ? (
            <div className="space-y-8">
              {achados.map((a, i) => (
                <AchadoCard key={i} a={a} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum ponto adicional relevante identificado.</p>
          )}
        </div>
      </div>
    </BlocoExpansivel>
  );
}
