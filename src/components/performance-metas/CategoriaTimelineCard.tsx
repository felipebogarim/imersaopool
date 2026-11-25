import { useMemo } from "react";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL } from "@/lib/performance-metas";
import {
  MESES_SEMESTRE,
  pisoSemestral,
  posicaoReguaSemestral,
  semestreDeCorte,
  situacaoSemestral,
} from "@/lib/performance-categoria-semestre";

export type CategoryTier = {
  name: "Silver" | "Gold" | "Black";
  /** Piso mensal de referência (R$); no corte semestral vale × 6. */
  target: number;
  label: string;
  rangeLabel: string;
  badgeClass: string;
  activeColor: string;
  glowColor: string;
};

export const CATEGORY_TIERS: CategoryTier[] = [
  {
    name: "Silver",
    target: 3_000,
    label: "Silver",
    rangeLabel: "R$ 3.000 a R$ 5.999",
    badgeClass:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    activeColor: "#94a3b8",
    glowColor: "rgba(148, 163, 184, 0.4)",
  },
  {
    name: "Gold",
    target: 6_000,
    label: "Gold",
    rangeLabel: "R$ 6.000 a R$ 19.999",
    badgeClass:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
    activeColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.4)",
  },
  {
    name: "Black",
    target: 20_000,
    label: "Black",
    rangeLabel: "Acima de R$ 20.000",
    badgeClass: "bg-purple-950/20 text-purple-900 dark:text-purple-200 border-purple-400/40",
    activeColor: "#8b5cf6",
    glowColor: "rgba(139, 92, 246, 0.4)",
  },
];

export type CategoriaTimelineCardProps = {
  categoria: string | null;
  /** Média mensal de compras do cliente no período do upload (R$). */
  realizado: number;
  /** Fim do período dos dados (ex.: "2026-10-31"): define o semestre de corte e os meses decorridos. */
  periodoFim?: string | null;
  /** Acumulado real do semestre, quando conhecido (senão é estimado pela média). */
  acumuladoSemestre?: number | null;
  periodoLabel?: string | null;
  className?: string;
};

const RISCO_BADGE = {
  baixo: {
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300",
    icon: ShieldCheck,
  },
  medio: {
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300",
    icon: AlertTriangle,
  },
  alto: {
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300",
    icon: ShieldAlert,
  },
} as const;

const fmtK = (v: number) => `R$ ${Math.round(v / 1000)}k`;

// A categoria é apurada no CORTE SEMESTRAL (jan–jun / jul–dez): pisos e faltantes são acumulados
// no semestre (piso mensal × 6), não diferenças na média mensal.
export function CategoriaTimelineCard({
  categoria,
  realizado,
  periodoFim,
  acumuladoSemestre,
  periodoLabel,
  className,
}: CategoriaTimelineCardProps) {
  const sit = useMemo(
    () =>
      situacaoSemestral({
        categoria,
        mediaMensal: realizado,
        acumulado: acumuladoSemestre,
        semestre: semestreDeCorte(periodoFim),
      }),
    [categoria, realizado, acumuladoSemestre, periodoFim],
  );
  const { semestre, manter, upgrade, acumulado, projecao } = sit;

  const currentIndex = Math.max(
    0,
    CATEGORY_TIERS.findIndex((t) => t.name === sit.categoria),
  );
  const currentTier = CATEGORY_TIERS[currentIndex];
  const nextTier = CATEGORY_TIERS[currentIndex + 1] ?? null;
  const manutencaoGarantida = manter.atingido;
  const upgradeAlcancado = upgrade ? upgrade.atingido : true;
  const degradeRisk = {
    ...RISCO_BADGE[sit.risco.nivel],
    titulo: sit.risco.titulo,
    descricao: sit.risco.descricao,
  };

  const timelineFillPct = posicaoReguaSemestral(acumulado);
  const projecaoPct = posicaoReguaSemestral(projecao);
  const restantes = semestre.restantesLabel;
  const decorridos = semestre.decorridosLabel || "início do semestre";

  return (
    <div
      className={cn(
        "flex h-full flex-1 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      {/* Topo do Card */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Award className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Evolução e Faixa de Categoria
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tabular-nums",
                currentTier.badgeClass,
              )}
            >
              Categoria Atual: {currentTier.name}
            </span>
            <span
              className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary tabular-nums"
              title={`Categoria apurada no corte semestral (${semestre.mesesLabel})`}
            >
              Corte: {semestre.label} ({semestre.mesesLabel})
            </span>
            {periodoLabel && (
              <span
                className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums"
                title="Período dos dados do upload (base da média mensal)"
              >
                {periodoLabel}
              </span>
            )}
          </div>
        </div>

        {/* ======================= TIMELINE VISUAL ======================= */}
        <div className="mt-4 px-2">
          {/* Marcos das Categorias */}
          <div
            className="relative mb-2 grid grid-cols-3 text-center"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              width: "100%",
            }}
          >
            {CATEGORY_TIERS.map((tier, idx) => {
              const isCurrent = idx === currentIndex;
              const isNext = idx === currentIndex + 1;
              const isAchieved = acumulado >= pisoSemestral(tier.name);

              return (
                <div key={tier.name} className="flex flex-col items-center">
                  <span
                    className={cn(
                      "text-[11px] font-bold tracking-tight transition-colors",
                      isCurrent && "text-foreground font-extrabold",
                      !isCurrent && isAchieved && "text-primary",
                      !isCurrent && !isAchieved && "text-muted-foreground",
                    )}
                  >
                    {tier.name}
                  </span>
                  <span className="text-[9px] font-semibold text-muted-foreground/80 tabular-nums">
                    {fmtBRL(pisoSemestral(tier.name))}
                    <span className="font-normal text-muted-foreground/70"> /sem</span>
                  </span>
                  <span className="text-[8px] text-muted-foreground/60 tabular-nums">
                    {fmtBRL(tier.target)}/mês
                  </span>
                  {isCurrent && (
                    <span className="mt-0.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[8px] font-bold text-primary">
                      Atual
                    </span>
                  )}
                  {isNext && (
                    <span className="mt-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.2 text-[8px] font-bold text-amber-600 dark:text-amber-400">
                      Próximo
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Trilho e Barra Preenchida Contínua */}
          <div className="relative my-2 h-3 w-full rounded-full bg-muted/50 p-0.5">
            {/* Faixa preenchida com gradiente de acordo com a posição */}
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${timelineFillPct}%`,
                background:
                  timelineFillPct >= 66
                    ? "linear-gradient(90deg, #94a3b8 0%, #f59e0b 50%, #8b5cf6 100%)"
                    : timelineFillPct >= 33
                      ? "linear-gradient(90deg, #94a3b8 0%, #f59e0b 100%)"
                      : "linear-gradient(90deg, #64748b 0%, #94a3b8 100%)",
              }}
            />

            {/* Marcadores dos 3 patamares na barra */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-4 w-1 bg-border rounded-full"
              style={{ left: "33.3%" }}
              title="Piso Silver no semestre: R$ 18.000 (R$ 3.000/mês × 6)"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-4 w-1 bg-border rounded-full"
              style={{ left: "66.6%" }}
              title="Piso Gold no semestre: R$ 36.000 (R$ 6.000/mês × 6)"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-4 w-1 bg-border rounded-full"
              style={{ right: "0%" }}
              title="Piso Black no semestre: R$ 120.000 (R$ 20.000/mês × 6)"
            />

            {/* Projeção de fechamento do semestre (média atual nos meses restantes) */}
            {restantes && projecaoPct > timelineFillPct && (
              <div
                className="absolute top-1/2 -translate-y-1/2 -ml-1.5 h-3 w-3 rounded-full border-2 border-dashed bg-background"
                style={{ left: `${projecaoPct}%`, borderColor: currentTier.activeColor }}
                title={`Projeção de fechamento do semestre: ${fmtBRL(projecao)}`}
              />
            )}

            {/* Marcador luminoso do acumulado no semestre */}
            {timelineFillPct > 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 -ml-2 h-4 w-4 rounded-full border-2 border-background shadow-md transition-all duration-700 ease-out"
                style={{
                  left: `${timelineFillPct}%`,
                  backgroundColor: currentTier.activeColor,
                  boxShadow: `0 0 10px ${currentTier.glowColor}`,
                }}
                title={`Acumulado no semestre (${decorridos}): ${fmtBRL(acumulado)}`}
              />
            )}
          </div>

          {/* Legenda do marcador atual */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
            <span>R$ 0</span>
            <span className="text-center tabular-nums">
              <span className="font-semibold text-foreground">
                Acumulado {decorridos}: {fmtBRL(acumulado)}
              </span>
              {restantes && <> · projeção do semestre {fmtBRL(projecao)}</>}
            </span>
            <span>{fmtK(pisoSemestral("Black"))}+</span>
          </div>
        </div>
      </div>

      {/* ======================= 3 BLOCOS DE INFORMAÇÃO ======================= */}
      <div
        className="mt-3 grid gap-2.5 grid-cols-1 sm:grid-cols-3"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", width: "100%" }}
      >
        {/* Bloco 1: Manutenção da Categoria */}
        <div className="rounded-lg border border-border/70 bg-card/60 p-2.5 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground whitespace-nowrap">
              Manter {currentTier.name}
            </span>
            {manutencaoGarantida ? (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0 whitespace-nowrap">
                <CheckCircle2 className="h-2.5 w-2.5" /> Garantida
              </span>
            ) : (
              <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 whitespace-nowrap">
                {manter.atingimentoPct.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="mt-1">
            {manutencaoGarantida ? (
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{fmtBRL(manter.sobra)}
              </p>
            ) : (
              <p className="text-sm font-bold text-foreground tabular-nums">
                Faltam {fmtBRL(manter.falta)}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              {manutencaoGarantida
                ? `Acima do piso semestral de ${fmtBRL(manter.piso)}`
                : manter.necessarioMes != null
                  ? `Acumulado no semestre · ${fmtBRL(manter.necessarioMes)}/mês em ${restantes} (piso ${fmtBRL(manter.piso)})`
                  : `Semestre encerrado abaixo do piso de ${fmtBRL(manter.piso)}`}
            </p>
          </div>
        </div>

        {/* Bloco 2: Caminho para Upgrade */}
        <div className="rounded-lg border border-border/70 bg-card/60 p-2.5 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground whitespace-nowrap">
              {nextTier ? `Upgrade para ${nextTier.name}` : "Categoria Máxima"}
            </span>
            {nextTier && (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-primary/10 text-primary shrink-0 whitespace-nowrap">
                <TrendingUp className="h-2.5 w-2.5" />
                {nextTier.name}
              </span>
            )}
          </div>
          <div className="mt-1">
            {nextTier ? (
              upgradeAlcancado ? (
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  Qualificado!
                </p>
              ) : (
                <p className="text-sm font-bold text-foreground tabular-nums">
                  Faltam {fmtBRL(upgrade?.falta ?? 0)}
                </p>
              )
            ) : (
              <p className="text-sm font-bold text-primary tabular-nums">Elite Black</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              {!upgrade
                ? "Cliente no patamar mais elevado"
                : upgrade.atingido
                  ? `Acumulado acima de ${fmtBRL(upgrade.piso)} no semestre`
                  : upgrade.necessarioMes != null
                    ? `Acumulado no semestre · ${fmtBRL(upgrade.necessarioMes)}/mês em ${restantes} (alvo ${fmtBRL(upgrade.piso)})`
                    : `Alvo semestral: ${fmtBRL(upgrade.piso)}`}
            </p>
          </div>
        </div>

        {/* Bloco 3: Risco de Degrade */}
        <div className="rounded-lg border border-border/70 bg-card/60 p-2.5 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground whitespace-nowrap">
              Risco de Degrade
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded border px-1.5 py-0.2 text-[9px] font-bold shrink-0 whitespace-nowrap",
                degradeRisk.badgeClass,
              )}
            >
              <degradeRisk.icon className="h-2.5 w-2.5" />
              {degradeRisk.titulo}
            </span>
          </div>
          <div className="mt-1">
            <p className="text-[11px] leading-snug font-medium text-foreground">
              {degradeRisk.descricao}
            </p>
          </div>
        </div>
      </div>

      {/* Rodapé compacto */}
      <div className="mt-3 border-t border-border/50 pt-2 text-[10px] text-muted-foreground flex flex-wrap items-center justify-between gap-1">
        <span>
          Corte semestral (jan–jun · jul–dez), pisos acumulados: Silver{" "}
          {fmtK(pisoSemestral("Silver"))} · Gold {fmtK(pisoSemestral("Gold"))} · Black{" "}
          {fmtK(pisoSemestral("Black"))} (piso mensal × {MESES_SEMESTRE})
          {sit.acumuladoEstimado && (
            <span className="opacity-75"> · acumulado estimado pela média mensal do período</span>
          )}
        </span>
        <span className="font-medium">
          {nextTier && upgrade
            ? `Próximo salto: +${fmtBRL(upgrade.piso - manter.piso)} no semestre`
            : "Topo da carteira"}
        </span>
      </div>
    </div>
  );
}
