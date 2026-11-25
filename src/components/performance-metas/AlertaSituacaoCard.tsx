// Alerta estratégico abaixo da timeline: média mensal atual e situação do cliente, com destaque
// para o TOTAL de compras necessário até dezembro e a MÉDIA MENSAL necessária nos meses restantes
// para manter a categoria (fechamento anual jan–dez). Evolução (Silver/Gold) é complementar.
// Mesma apuração (`situacaoCategoria`) do card da timeline.

import { CheckCircle2, Flame, Info, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL } from "@/lib/performance-metas";
import type { EstadoCategoria, SituacaoCategoria } from "@/lib/performance-categoria";

const TEMA: Record<
  EstadoCategoria,
  {
    icon: typeof ShieldCheck;
    container: string;
    iconWrapper: string;
    badge: string;
    title: string;
    tag: string;
  }
> = {
  garantida: {
    icon: ShieldCheck,
    container:
      "from-emerald-500/12 via-emerald-500/5 to-card border-emerald-300 dark:border-emerald-800/60",
    iconWrapper:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-500/10",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300",
    title: "text-emerald-950 dark:text-emerald-100",
    tag: "bg-emerald-500/10 border-emerald-300/40 text-emerald-700 dark:text-emerald-300",
  },
  garantida_estimada: {
    icon: ShieldCheck,
    container:
      "from-emerald-500/12 via-emerald-500/5 to-card border-emerald-300 dark:border-emerald-800/60",
    iconWrapper:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-500/10",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300",
    title: "text-emerald-950 dark:text-emerald-100",
    tag: "bg-emerald-500/10 border-emerald-300/40 text-emerald-700 dark:text-emerald-300",
  },
  mantida_ritmo: {
    icon: CheckCircle2,
    container: "from-sky-500/12 via-sky-500/5 to-card border-sky-300 dark:border-sky-800/60",
    iconWrapper: "bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-4 ring-sky-500/10",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300",
    title: "text-sky-950 dark:text-sky-100",
    tag: "bg-sky-500/10 border-sky-300/40 text-sky-700 dark:text-sky-300",
  },
  risco_queda: {
    icon: Flame,
    container: "from-rose-500/12 via-rose-500/5 to-card border-rose-300 dark:border-rose-800/60",
    iconWrapper: "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-4 ring-rose-500/10",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300",
    title: "text-rose-950 dark:text-rose-100",
    tag: "bg-rose-500/10 border-rose-300/40 text-rose-700 dark:text-rose-300",
  },
  sem_base: {
    icon: Info,
    container: "from-muted/60 via-muted/30 to-card border-border",
    iconWrapper: "bg-muted text-muted-foreground ring-4 ring-muted/40",
    badge: "bg-muted text-muted-foreground border-border",
    title: "text-foreground",
    tag: "bg-muted border-border text-muted-foreground",
  },
};

type Destaque = { valor: string; rotulo: string };
type Texto = {
  badge: string;
  titulo: string;
  mensagem: string;
  /** Duas informações principais: total necessário até dezembro e média mensal necessária. */
  destaques: Destaque[];
  /** Silver/Gold: conquista da categoria superior (complementar). */
  evolucao: string | null;
};

const est = (on: boolean) => (on ? " (estimado)" : "");

function destaquesManter(s: SituacaoCategoria): Destaque[] {
  const m = s.manter;
  if (!m) return [{ valor: "—", rotulo: "sem mês de referência para o fechamento anual" }];
  const e = s.acumuladoEstimado ? " · est." : "";
  return [
    {
      valor: fmtBRL(m.totalNecessario),
      rotulo: `total até dezembro para manter ${m.categoria}${e}`,
    },
    m.mediaNecessaria != null
      ? {
          valor: `${fmtBRL(m.mediaNecessaria)}/mês`,
          rotulo: `média necessária em ${s.rotuloRestantes}${e}`,
        }
      : {
          valor: m.atingido ? "Atingido" : "Não atingido",
          rotulo: `fechamento anual ${s.ano ?? ""}${e}`.trim(),
        },
  ];
}

function textoEvolucao(s: SituacaoCategoria): string | null {
  const ev = s.evoluir;
  if (!ev) return null;
  const e = est(s.acumuladoEstimado);
  if (ev.atingido)
    return `Conquistar ${ev.categoria}: piso anual de ${fmtBRL(ev.pisoAnual)} já alcançado${e}.`;
  return (
    `Conquistar ${ev.categoria}: faltam ${fmtBRL(ev.totalNecessario)} até dezembro` +
    (ev.mediaNecessaria != null
      ? ` (${fmtBRL(ev.mediaNecessaria)}/mês em ${s.rotuloRestantes})`
      : "") +
    `${e}.` +
    (s.oportunidadeEvolucao ? " Oportunidade de evolução no ritmo atual." : "")
  );
}

export function textoAlerta(s: SituacaoCategoria): Texto {
  const m = s.media != null ? fmtBRL(s.media) : "—";
  const mEst = s.mediaEstimada ? " (estimada)" : "";
  const cad = s.cadastrada ?? "sem categoria";
  const acum =
    s.acumulado != null && s.ano != null
      ? ` Acumulado ${s.ano}: ${fmtBRL(s.acumulado)}${est(s.acumuladoEstimado)}, piso anual ${cad} ${fmtBRL(s.manter?.pisoAnual)}.`
      : "";
  const base = { destaques: destaquesManter(s), evolucao: textoEvolucao(s) };
  switch (s.estado) {
    case "sem_base":
      return {
        badge: "Sem base de compras",
        titulo: "A importação não traz valores de compra deste cliente",
        mensagem:
          "Nenhum portfólio tem média, realizado ou % sobre a meta original do upload. A categoria não é avaliada — isso não significa compra zero.",
        destaques: [{ valor: "—", rotulo: "sem base" }],
        evolucao: null,
      };
    case "garantida":
      return {
        ...base,
        badge: `${cad} garantida`,
        titulo: `Compras do ano já superam o piso anual ${cad}`,
        mensagem: `Média mensal${mEst} de ${m}.${acum} Categoria garantida para o fechamento de dezembro.`,
      };
    case "garantida_estimada":
      return {
        ...base,
        badge: `${cad} · piso anual atingido (estimado)`,
        titulo: `Pela estimativa, o acumulado do ano já supera o piso anual ${cad}`,
        mensagem: `Média mensal${mEst} de ${m}.${acum} Como o acumulado é estimado (média × meses), confirme com o fechamento real antes de considerar a categoria garantida.`,
      };
    case "mantida_ritmo":
      return {
        ...base,
        badge: `${cad} mantida pelo ritmo atual`,
        titulo: `Média mensal${mEst} de ${m}, acima do piso de ${fmtBRL(s.pisoCadastrada)}/mês`,
        mensagem: `Sem risco de queda pela média.${acum} Para consolidar ${cad} no fechamento anual ainda são necessárias compras até dezembro.`,
      };
    case "risco_queda":
      return {
        ...base,
        badge: `Risco de queda · ${cad}`,
        titulo: `Média mensal${mEst} de ${m}, abaixo do piso de ${fmtBRL(s.pisoCadastrada)}/mês`,
        mensagem: `Pela média, o cliente se enquadra em ${s.enquadrada ?? "faixa abaixo de Silver"}.${acum} Risco: sem acelerar as compras até dezembro, o cliente não sustenta ${cad} no fechamento anual.`,
      };
  }
}

export function AlertaSituacaoCard({
  situacao,
  periodoLabel,
  className,
}: {
  situacao: SituacaoCategoria;
  periodoLabel?: string | null;
  className?: string;
}) {
  const t = textoAlerta(situacao);
  const tema = TEMA[situacao.estado];
  const Icon = tema.icon;
  const estimado = situacao.acumuladoEstimado && situacao.estado !== "sem_base";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-r p-4 shadow-sm",
        tema.container,
        className,
      )}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              tema.iconWrapper,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight",
                  tema.badge,
                )}
              >
                {t.badge}
              </span>
              {estimado && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Valores estimados
                </span>
              )}
              {periodoLabel && (
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground/80">
                  {periodoLabel}
                </span>
              )}
            </div>
            <h3 className={cn("text-sm font-bold leading-snug tracking-tight", tema.title)}>
              {t.titulo}
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">{t.mensagem}</p>
            {t.evolucao && (
              <p className="text-[11px] font-medium text-purple-700/90 dark:text-purple-300/90">
                {t.evolucao}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:self-center">
          {t.destaques.map((d) => (
            <div
              key={d.rotulo}
              className={cn(
                "flex flex-col items-start rounded-lg border px-3.5 py-1.5 sm:items-end",
                tema.tag,
              )}
            >
              <span className="text-sm font-extrabold tabular-nums tracking-tight">{d.valor}</span>
              <span className="text-[10px] font-medium text-muted-foreground/90">{d.rotulo}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
