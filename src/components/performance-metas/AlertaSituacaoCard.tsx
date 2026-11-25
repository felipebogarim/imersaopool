// Alerta estratégico abaixo da timeline: situação atual, distância mensal (R$) para manter ou
// evoluir e a oportunidade/risco comercial. Mesma apuração (`situacaoCategoria`) do card.

import { AlertTriangle, Crown, Flame, Info, Rocket, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL } from "@/lib/performance-metas";
import type { EstadoCategoria, SituacaoCategoria } from "@/lib/performance-categoria";

const TEMA: Record<
  EstadoCategoria,
  {
    icon: typeof Crown;
    container: string;
    iconWrapper: string;
    badge: string;
    title: string;
    tag: string;
  }
> = {
  evolucao: {
    icon: Crown,
    container:
      "from-purple-500/12 via-purple-500/5 to-card border-purple-300 dark:border-purple-800/60",
    iconWrapper: "bg-purple-500/15 text-purple-600 dark:text-purple-400 ring-4 ring-purple-500/10",
    badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300",
    title: "text-purple-950 dark:text-purple-100",
    tag: "bg-purple-500/10 border-purple-300/40 text-purple-700 dark:text-purple-300",
  },
  proximo_evoluir: {
    icon: Rocket,
    container:
      "from-purple-500/10 via-purple-500/5 to-card border-purple-300 dark:border-purple-800/60",
    iconWrapper: "bg-purple-500/15 text-purple-600 dark:text-purple-400 ring-4 ring-purple-500/10",
    badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300",
    title: "text-purple-950 dark:text-purple-100",
    tag: "bg-purple-500/10 border-purple-300/40 text-purple-700 dark:text-purple-300",
  },
  manutencao: {
    icon: ShieldCheck,
    container:
      "from-emerald-500/12 via-emerald-500/5 to-card border-emerald-300 dark:border-emerald-800/60",
    iconWrapper:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-500/10",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300",
    title: "text-emerald-950 dark:text-emerald-100",
    tag: "bg-emerald-500/10 border-emerald-300/40 text-emerald-700 dark:text-emerald-300",
  },
  atencao: {
    icon: AlertTriangle,
    container:
      "from-amber-500/12 via-amber-500/5 to-card border-amber-300 dark:border-amber-800/60",
    iconWrapper: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/10",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300",
    title: "text-amber-950 dark:text-amber-100",
    tag: "bg-amber-500/10 border-amber-300/40 text-amber-700 dark:text-amber-300",
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

type Texto = { badge: string; titulo: string; mensagem: string; valor: string; rotulo: string };

export function textoAlerta(s: SituacaoCategoria): Texto {
  const m = s.media != null ? fmtBRL(s.media) : "—";
  const est = s.estimado ? " (estimada)" : "";
  const cad = s.cadastrada ?? "sem categoria";
  switch (s.estado) {
    case "sem_base":
      return {
        badge: "Sem base de compras",
        titulo: "A importação não traz valores de compra deste cliente",
        mensagem:
          "Nenhum portfólio tem média, realizado ou % sobre a meta original do upload. A categoria não é avaliada — isso não significa compra zero.",
        valor: "—",
        rotulo: "sem base",
      };
    case "evolucao":
      return {
        badge: `Desempenho ${s.enquadrada} · cadastrado ${cad}`,
        titulo: `Média mensal${est} de ${m}: desempenho compatível com ${s.enquadrada}`,
        mensagem: `O cliente supera o piso ${s.enquadrada} e está acima da categoria cadastrada (${cad}). Oportunidade: consolidar o novo patamar com mix completo e avaliar a reclassificação no corte. A categoria cadastrada não é alterada automaticamente.`,
        valor: `+${fmtBRL(s.media! - (s.pisoEnquadrada ?? 0))}`,
        rotulo: `por mês acima do piso ${s.enquadrada}`,
      };
    case "proximo_evoluir":
      return {
        badge: `${cad} mantida · rumo a ${s.proxima}`,
        titulo: `Faltam ${fmtBRL(s.faltaProxima!)}/mês para o patamar ${s.proxima}`,
        mensagem: `Média mensal${est} de ${m}, a ${Math.round((s.media! / s.pisoProxima!) * 100)}% do piso ${s.proxima} (${fmtBRL(s.pisoProxima!)}/mês). Oportunidade: ampliar portfólios pouco comprados para alcançar a próxima categoria.`,
        valor: `${fmtBRL(s.faltaProxima!)}`,
        rotulo: `por mês para ${s.proxima}`,
      };
    case "manutencao":
      return {
        badge: `Categoria ${cad} mantida`,
        titulo: `Média mensal${est} de ${m}, ${fmtBRL(s.saldoManutencao!)}/mês acima do piso ${cad}`,
        mensagem: s.proxima
          ? `Categoria sustentada com folga. Para evoluir a ${s.proxima} faltam ${fmtBRL(s.faltaProxima!)}/mês (piso ${fmtBRL(s.pisoProxima!)}/mês).`
          : "Cliente no patamar máximo da carteira, com folga sobre o piso. Oportunidade: proteger a relação e expandir o mix.",
        valor: `+${fmtBRL(s.saldoManutencao!)}`,
        rotulo: `por mês acima do piso ${cad}`,
      };
    case "atencao":
      return {
        badge: `${cad} mantida · pouca folga`,
        titulo: `Média mensal${est} de ${m}: só ${fmtBRL(s.saldoManutencao!)}/mês acima do piso ${cad}`,
        mensagem: `A categoria está mantida, mas qualquer queda nas compras leva o cliente abaixo do piso de ${fmtBRL(s.pisoCadastrada!)}/mês. Risco: acompanhar os portfólios em queda e antecipar pedidos.`,
        valor: `+${fmtBRL(s.saldoManutencao!)}`,
        rotulo: "de folga por mês",
      };
    case "risco_queda":
      return {
        badge: `Risco de queda · ${cad}`,
        titulo: `Faltam ${fmtBRL(-s.saldoManutencao!)}/mês para manter ${cad}`,
        mensagem: `Média mensal${est} de ${m}, ${Math.round((s.pctPiso ?? 0) * 100)}% do piso ${cad} (${fmtBRL(s.pisoCadastrada!)}/mês); pela média, o cliente se enquadra em ${s.enquadrada ?? "faixa abaixo de Silver"}. Risco: ativação concentrada nos portfólios com menor compra.`,
        valor: `−${fmtBRL(-s.saldoManutencao!)}`,
        rotulo: `por mês para o piso ${cad}`,
      };
  }
}

export function AlertaSituacaoCard({
  situacao,
  periodoLabel,
  complemento,
  className,
}: {
  situacao: SituacaoCategoria | null;
  periodoLabel?: string | null;
  complemento?: { label: string; projecao: number; piso: number } | null;
  className?: string;
}) {
  if (!situacao) return null;
  const t = textoAlerta(situacao);
  const tema = TEMA[situacao.estado];
  const Icon = tema.icon;
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
              {situacao.estimado && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Média estimada
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
            {complemento && situacao.estado !== "sem_base" && (
              <p className="text-[11px] text-muted-foreground/90">
                Complemento · {complemento.label}: mantida a média, o semestre soma{" "}
                {fmtBRL(complemento.projecao)} (piso {fmtBRL(complemento.piso)}) — estimativa.
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 sm:self-center">
          <div
            className={cn(
              "flex flex-col items-start rounded-lg border px-3.5 py-1.5 sm:items-end",
              tema.tag,
            )}
          >
            <span className="text-sm font-extrabold tabular-nums tracking-tight">{t.valor}</span>
            <span className="text-[10px] font-medium text-muted-foreground/90">{t.rotulo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
