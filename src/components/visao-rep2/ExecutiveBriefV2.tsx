import { useState, type ReactNode } from "react";
import { ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GerarTarefaDialog } from "@/components/sintese/GerarTarefaDialog";
import type { BriefEntidades, BriefingExecutivo, BriefTema } from "./briefing-fabio";
import { ConclusoesCentraisV2, PerspectivasEntrevistaV2, briefPerspectivasToVM } from "./PerspectivasV2";
import { PerformanceFamiliasV2 } from "./PerformanceFamiliasV2";
import { BlocoExpansivel } from "./BlocoExpansivel";
import { GaugeAtingimento } from "./GaugeAtingimento";
import type { PerspectivaVM } from "@/lib/visao-rep2-perspectivas";
import type { PerfResumo } from "@/lib/visao-rep";


export { BlocoExpansivel };


/* ------------------------------------------------------------------ */
/* Cabeçalho do relatório                                              */
/* ------------------------------------------------------------------ */

export function BriefHeaderV2({
  nome,
  regiao,
  marcas = [],
  atingimentoPct,
  periodo,
}: {
  nome: string;
  regiao?: string | null;
  dataEntrevista?: string | null;
  dataRelatorio?: string | null;
  marcas?: string[];
  atingimentoPct?: number | null;
  periodo?: string | null;
}) {
  return (
    <header className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 rounded-xl border bg-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Briefing executivo · Visão Rep
        </p>
        <h2 className="mt-1.5 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{nome}</h2>
        {regiao ? (
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            <span className="font-medium text-foreground/70">Região: </span>
            {regiao}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 rounded-xl border bg-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Representa também:
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {marcas.length ? (
            marcas.map(m => (
              <Badge key={m} variant="secondary" className="px-2.5 py-0.5 text-xs font-normal">
                {m}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Não informado</span>
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-xl border bg-muted/30 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Atingimento ponderado geral
          </p>
          {periodo ? <span className="text-xs font-semibold tabular-nums">{periodo}</span> : null}
        </div>
        <div className="mt-1">
          <GaugeAtingimento valor={atingimentoPct ?? null} label="Atingimento ponderado geral" />
        </div>
      </div>
    </header>
  );
}



/* ------------------------------------------------------------------ */
/* Contexto e carteira estratégica                                     */
/* ------------------------------------------------------------------ */

export function ContextPortfolioV2({ brief }: { brief: BriefingExecutivo }) {
  if (!brief.clientes.length && !brief.contexto.regiaoModelo) return null;
  return (
    <BlocoExpansivel
      titulo="Clientes estratégicos, na visão do representante"
      descricao="Contexto de atuação e contas citadas como prioritárias na entrevista."
    >
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        {brief.contexto.regiaoModelo ? (
          <div className="min-w-0 space-y-2">
            <h4 className="text-sm font-semibold">Contexto do representante</h4>
            <p className="max-w-prose text-sm leading-7 text-muted-foreground">{brief.contexto.regiaoModelo}</p>
          </div>
        ) : null}

        {brief.clientes.length ? (
          <div className="min-w-0 space-y-3">
            <h4 className="text-sm font-semibold">Clientes estratégicos</h4>
            <ul className="space-y-3">
              {brief.clientes.slice(0, 6).map(c => (
                <li key={c.nome} className="min-w-0 border-l-2 border-border pl-3">
                  <p className="text-sm font-semibold">{c.nome}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{c.motivo}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </BlocoExpansivel>
  );
}


/* ------------------------------------------------------------------ */
/* Síntese estratégica                                                 */
/* ------------------------------------------------------------------ */

export function SintesePresidencialV2({ texto, teia }: { texto: string; teia?: ReactNode }) {
  return (
    <BlocoExpansivel
      titulo="Síntese estratégica"
      descricao="Leitura geral da entrevista e dos principais impactos para o negócio."
      className="bg-muted/30"
    >
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] lg:gap-10">
        <div className="min-w-0 border-l-2 border-primary pl-5">
          <p className="max-w-[68ch] text-base leading-8">{texto}</p>
        </div>
        {teia ? <div className="min-w-0 self-center">{teia}</div> : null}
      </div>
    </BlocoExpansivel>
  );
}



/* ------------------------------------------------------------------ */
/* Temas estratégicos                                                  */
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
  if (vazio && !e.nota) return null;
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Entidades citadas</p>
      <ChipGroup label="Produtos" itens={e.produtos} />
      <ChipGroup label="Concorrentes" itens={e.concorrentes} />
      <ChipGroup label="Clientes" itens={e.clientes} />
      <ChipGroup label="Ferramentas" itens={e.ferramentas} />
      {e.nota ? <p className="text-xs leading-5 text-muted-foreground">{e.nota}</p> : null}
    </div>
  );
}

function EvidenceSidebarV2({ tema }: { tema: BriefTema }) {
  return (
    <aside className="space-y-6 rounded-xl border bg-muted/20 p-5" aria-label="Apoio à leitura do tema">
      <div className="space-y-2">
        <p className="text-sm font-semibold">Evidência principal</p>
        <blockquote className="border-l-2 border-primary pl-3 text-sm italic leading-6 text-muted-foreground">
          “{tema.evidencia}”
        </blockquote>
      </div>

      <EntidadesV2 e={tema.entidades} />

      <div className="space-y-2">
        <p className="text-sm font-semibold">Comparação com o grupo</p>
        <p className="text-sm leading-6 text-muted-foreground">{tema.comparacao}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Nível de confiança</p>
        <Badge variant="outline">{tema.confianca}</Badge>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Perspectivas relacionadas</p>
        <div className="flex flex-wrap gap-1.5">
          {tema.perspectivas.map(p => (
            <span key={p} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {p}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}

function StrategicThemeV2({ tema }: { tema: BriefTema }) {
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
      <div className="min-w-0 space-y-6 lg:col-span-8">
        <div className="space-y-3">
          <h4 className="text-xl font-semibold tracking-tight sm:text-2xl">{tema.titulo}</h4>
          <p className="max-w-[68ch] text-base leading-8 text-foreground/90">{tema.contexto}</p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Onde isso aparece
          </p>
          <ul className="space-y-2">
            {tema.ondeAparece.map((o, i) => (
              <li key={i} className="flex gap-3 text-sm leading-6">
                <span className="shrink-0 tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">{o}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border-l-2 border-primary bg-muted/30 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            O que isso representa
          </p>
          <p className="mt-1.5 max-w-[68ch] text-sm leading-7">{tema.representa}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Decisão sugerida
            </p>
            <p className="mt-1.5 text-sm leading-7">{tema.decisao}</p>
          </div>
          {tema.validacao ? (
            <div className="rounded-lg border p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Validação necessária
              </p>
              <p className="mt-1.5 text-sm leading-7">{tema.validacao}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 lg:col-span-4">
        <EvidenceSidebarV2 tema={tema} />
      </div>
    </div>
  );
}

export function TemasEstrategicosV2({ temas }: { temas: BriefTema[] }) {
  const [ativo, setAtivo] = useState(temas[0]?.id ?? "");
  const tema = temas.find(t => t.id === ativo) ?? temas[0];
  if (!tema) return null;

  return (
    <section className="space-y-5" aria-labelledby="vr2-temas">
      <div>
        <h3 id="vr2-temas" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Temas estratégicos
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Quatro leituras que concentram os principais efeitos comerciais identificados na entrevista.
        </p>
      </div>

      <div role="tablist" aria-label="Temas estratégicos" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {temas.map(t => {
          const sel = t.id === tema.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={sel}
              aria-controls={`vr2-tema-${t.id}`}
              onClick={() => setAtivo(t.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                sel
                  ? "border-primary bg-primary/10 font-semibold text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn("h-1.5 w-1.5 rounded-full", sel ? "bg-primary" : "bg-muted-foreground/40")}
                />
                {t.seletor}
                {sel ? <span className="sr-only">(selecionado)</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div id={`vr2-tema-${tema.id}`} role="tabpanel" className="rounded-xl border bg-card p-5 sm:p-6">
        <StrategicThemeV2 tema={tema} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Agenda executiva                                                    */
/* ------------------------------------------------------------------ */

function AgendaCard({
  titulo,
  itens,
  onGerarTarefa,
}: {
  titulo: string;
  itens: { texto: string; status: string }[];
  onGerarTarefa: (it: { texto: string; status: string }) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 sm:p-6">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{titulo}</h4>
      <ol className="mt-4 space-y-4">
        {itens.map((it, i) => (
          <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
            <span className="tabular-nums text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm leading-7">{it.texto}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{it.status}</Badge>
                <span>Responsável ainda não definido</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={() => onGerarTarefa(it)}
                >
                  <ListPlus className="h-3.5 w-3.5" aria-hidden />
                  Transformar em tarefa
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AgendaExecutivaV2({ brief }: { brief: BriefingExecutivo }) {
  const [tarefa, setTarefa] = useState<{ title: string; description: string } | null>(null);

  const gerar = (origem: string, it: { texto: string; status: string }) =>
    setTarefa({
      title: it.texto,
      description: `Origem: Visão Rep · Agenda executiva · ${origem}\nStatus: ${it.status}\n\n${it.texto}`,
    });

  return (
    <BlocoExpansivel
      titulo="Agenda executiva"
      descricao="Decisões e validações que dependem de responsáveis definidos."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <AgendaCard
          titulo="Decisões requeridas"
          itens={brief.decisoes}
          onGerarTarefa={it => gerar("Decisões requeridas", it)}
        />
        <AgendaCard
          titulo="Validações necessárias"
          itens={brief.validacoes}
          onGerarTarefa={it => gerar("Validações necessárias", it)}
        />
      </div>
      <GerarTarefaDialog tarefa={tarefa} onClose={() => setTarefa(null)} />
    </BlocoExpansivel>
  );

}


/* ------------------------------------------------------------------ */
/* Composição                                                          */
/* ------------------------------------------------------------------ */

export function ExecutiveBriefV2({
  brief,
  nome,
  regiao,
  dataEntrevista,
  dataRelatorio,
  perspectivas: perspectivasProp,
  perf = null,
  leitura,
  teia,
}: {
  brief: BriefingExecutivo;
  nome: string;
  regiao?: string | null;
  dataEntrevista?: string | null;
  dataRelatorio?: string | null;
  /** Perspectivas já montadas a partir do relatório; se ausente, usa as do briefing curado. */
  perspectivas?: PerspectivaVM[];
  perf?: PerfResumo | null;
  /** Bloco "Leitura integrada" do relatório. */
  leitura?: ReactNode;
  /** Teia comparativa exibida ao lado da síntese estratégica. */
  teia?: ReactNode;
}) {
  const perspectivas =
    perspectivasProp ??
    briefPerspectivasToVM(brief.perspectivas, {
      decisoes: brief.decisoes.map(d => d.texto),
      validacoes: brief.validacoes.map(v => v.texto),
    });

  const temPerspectivas = perspectivas.some(p => p.temConteudo);

  return (
    <div className="space-y-6">
      <BriefHeaderV2
        nome={nome}
        regiao={regiao}
        dataEntrevista={dataEntrevista}
        dataRelatorio={dataRelatorio}
        marcas={brief.contexto.marcas}
        atingimentoPct={perf?.geralPct ?? null}
        periodo={perf?.periodoLabel ?? null}
      />
      {brief.sintese ? <SintesePresidencialV2 texto={brief.sintese} teia={teia} /> : null}

      <PerformanceFamiliasV2 perf={perf} />
      {leitura ?? null}
      <ContextPortfolioV2 brief={brief} />
      {temPerspectivas ? <PerspectivasEntrevistaV2 perspectivas={perspectivas} /> : null}
      <ConclusoesCentraisV2 conclusoes={brief.conclusoes} />
      {brief.decisoes.length || brief.validacoes.length ? <AgendaExecutivaV2 brief={brief} /> : null}
    </div>
  );
}


