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

export type CategoryTier = {
  name: "Silver" | "Gold" | "Black";
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
    badgeClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    activeColor: "#94a3b8",
    glowColor: "rgba(148, 163, 184, 0.4)",
  },
  {
    name: "Gold",
    target: 6_000,
    label: "Gold",
    rangeLabel: "R$ 6.000 a R$ 19.999",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
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

/** Mapeamento proporcional contínuo para os 3 patamares na timeline */
function getTimelinePositionPct(valor: number): number {
  if (valor <= 0) return 0;
  if (valor < 3_000) {
    // 0% a 33.3%
    return Math.max(2, (valor / 3_000) * 33.3);
  }
  if (valor < 6_000) {
    // 33.3% a 66.6%
    return 33.3 + ((valor - 3_000) / (6_000 - 3_000)) * 33.3;
  }
  if (valor < 20_000) {
    // 66.6% a 98%
    return 66.6 + ((valor - 6_000) / (20_000 - 6_000)) * 31.4;
  }
  return 100;
}

export type CategoriaTimelineCardProps = {
  categoria: string | null;
  realizado: number;
  periodoLabel?: string | null;
  className?: string;
};

export function CategoriaTimelineCard({
  categoria,
  realizado,
  periodoLabel,
  className,
}: CategoriaTimelineCardProps) {
  const catNorm = (categoria ?? "Silver").trim().toLowerCase();
  const currentIndex = useMemo(() => {
    const idx = CATEGORY_TIERS.findIndex((t) => t.name.toLowerCase() === catNorm);
    return idx >= 0 ? idx : 0;
  }, [catNorm]);

  const currentTier = CATEGORY_TIERS[currentIndex];
  const hasNextTier = currentIndex < CATEGORY_TIERS.length - 1;
  const nextTier = hasNextTier ? CATEGORY_TIERS[currentIndex + 1] : null;
  const prevTier = currentIndex > 0 ? CATEGORY_TIERS[currentIndex - 1] : null;

  // 1. Manutenção da categoria atual
  const metaManutencao = currentTier.target;
  const atingimentoManutencaoPct = metaManutencao > 0 ? (realizado / metaManutencao) * 100 : 0;
  const manutencaoGarantida = realizado >= metaManutencao;
  const faltaManutencao = Math.max(0, metaManutencao - realizado);
  const sobraManutencao = Math.max(0, realizado - metaManutencao);

  // 2. Caminho até a próxima categoria (Upgrade)
  const metaUpgrade = nextTier ? nextTier.target : metaManutencao;
  const faltaUpgrade = nextTier ? Math.max(0, metaUpgrade - realizado) : 0;
  const upgradeAlcancado = nextTier ? realizado >= metaUpgrade : true;

  // 3. Risco de Degrade (regras fixas: Silver 3k a 6k, Gold 6k a 20k, Black > 20k)
  const degradeRisk = useMemo(() => {
    if (currentIndex === 0) {
      // Silver (piso R$ 3.000)
      if (manutencaoGarantida) {
        return {
          level: "baixo" as const,
          titulo: "Risco Baixo",
          descricao: `Piso Silver de ${fmtBRL(metaManutencao)} garantido (+${fmtBRL(sobraManutencao)} acima).`,
          badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300",
          icon: ShieldCheck,
        };
      }
      if (atingimentoManutencaoPct >= 50) {
        return {
          level: "medio" as const,
          titulo: "Atenção ao Ritmo",
          descricao: `Faltam ${fmtBRL(faltaManutencao)} para assegurar o piso Silver de ${fmtBRL(metaManutencao)}.`,
          badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300",
          icon: AlertTriangle,
        };
      }
      return {
        level: "alto" as const,
        titulo: "Alto Risco de Inativação",
        descricao: `Faltam ${fmtBRL(faltaManutencao)} para atingir o piso mínimo Silver de ${fmtBRL(metaManutencao)}.`,
        badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300",
        icon: ShieldAlert,
      };
    }

    // Gold (piso R$ 6.000) ou Black (piso R$ 20.000)
    if (manutencaoGarantida) {
      return {
        level: "baixo" as const,
        titulo: "Risco Baixo",
        descricao: `Categoria ${currentTier.name} consolidada (+${fmtBRL(sobraManutencao)} acima do piso de ${fmtBRL(metaManutencao)}).`,
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300",
        icon: ShieldCheck,
      };
    }

    const pisoAnterior = prevTier ? prevTier.target : 0;
    if (realizado < pisoAnterior) {
      return {
        level: "alto" as const,
        titulo: "Alto Risco de Degrade",
        descricao: `Faturamento abaixo de ${prevTier?.name ?? "piso"} (${fmtBRL(pisoAnterior)}). Faltam ${fmtBRL(faltaManutencao)} para manter ${currentTier.name}.`,
        badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300",
        icon: ShieldAlert,
      };
    }

    return {
      level: "medio" as const,
      titulo: "Risco Moderado de Degrade",
      descricao: `Acima de ${prevTier?.name}, mas faltam ${fmtBRL(faltaManutencao)} para manter ${currentTier.name} (${fmtBRL(metaManutencao)}).`,
      badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300",
      icon: AlertTriangle,
    };
  }, [
    currentIndex,
    atingimentoManutencaoPct,
    manutencaoGarantida,
    faltaManutencao,
    sobraManutencao,
    currentTier.name,
    prevTier,
    realizado,
    metaManutencao,
  ]);

  const timelineFillPct = getTimelinePositionPct(realizado);

  return (
    <div
      className={cn(
        "flex h-full flex-1 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      {/* Topo do Card */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Award className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Evolução e Faixa de Categoria
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tabular-nums",
                currentTier.badgeClass,
              )}
            >
              Categoria Atual: {currentTier.name}
            </span>
            {periodoLabel && (
              <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                {periodoLabel}
              </span>
            )}
          </div>
        </div>

        {/* ======================= TIMELINE VISUAL ======================= */}
        <div className="mt-4 px-2">
          {/* Marcos das Categorias */}
          <div className="relative mb-2 grid grid-cols-3 text-center">
            {CATEGORY_TIERS.map((tier, idx) => {
              const isPast = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              const isNext = idx === currentIndex + 1;
              const isAchieved = realizado >= tier.target;

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
                    {fmtBRL(tier.target)}
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
              title="Piso Silver: R$ 3.000 (faixa de R$ 3.000 a R$ 5.999)"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-4 w-1 bg-border rounded-full"
              style={{ left: "66.6%" }}
              title="Piso Gold: R$ 6.000 (faixa de R$ 6.000 a R$ 19.999)"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-4 w-1 bg-border rounded-full"
              style={{ right: "0%" }}
              title="Piso Black: R$ 20.000 (acima de R$ 20.000)"
            />

            {/* Marcador luminoso da posição atual do cliente */}
            {timelineFillPct > 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 -ml-2 h-4 w-4 rounded-full border-2 border-background shadow-md transition-all duration-700 ease-out"
                style={{
                  left: `${timelineFillPct}%`,
                  backgroundColor: currentTier.activeColor,
                  boxShadow: `0 0 10px ${currentTier.glowColor}`,
                }}
                title={`Faturamento Realizado: ${fmtBRL(realizado)}`}
              />
            )}
          </div>

          {/* Legenda do marcador atual */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
            <span>R$ 0</span>
            <span className="font-semibold text-foreground tabular-nums">
              Realizado: {fmtBRL(realizado)}
            </span>
            <span>R$ 20k+</span>
          </div>
        </div>
      </div>

      {/* ======================= 3 BLOCOS DE INFORMAÇÃO ======================= */}
      <div className="mt-3 grid gap-2.5 grid-cols-1 sm:grid-cols-3">
        {/* Bloco 1: Manutenção da Categoria */}
        <div className="rounded-lg border border-border/70 bg-card/60 p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              Manter {currentTier.name}
            </span>
            {manutencaoGarantida ? (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-2.5 w-2.5" /> Garantida
              </span>
            ) : (
              <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                {atingimentoManutencaoPct.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="mt-1">
            {manutencaoGarantida ? (
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{fmtBRL(sobraManutencao)}
              </p>
            ) : (
              <p className="text-sm font-bold text-foreground tabular-nums">
                Faltam {fmtBRL(faltaManutencao)}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {manutencaoGarantida
                ? `Acima do piso de ${fmtBRL(metaManutencao)}`
                : `Para atingir piso de ${fmtBRL(metaManutencao)}`}
            </p>
          </div>
        </div>

        {/* Bloco 2: Caminho para Upgrade */}
        <div className="rounded-lg border border-border/70 bg-card/60 p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              {nextTier ? `Upgrade para ${nextTier.name}` : "Categoria Máxima"}
            </span>
            {nextTier && (
              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-primary/10 text-primary">
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
                  Faltam {fmtBRL(faltaUpgrade)}
                </p>
              )
            ) : (
              <p className="text-sm font-bold text-primary tabular-nums">
                Elite Black
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {nextTier
                ? `Alvo da categoria: ${fmtBRL(metaUpgrade)}`
                : "Cliente no patamar mais elevado"}
            </p>
          </div>
        </div>

        {/* Bloco 3: Risco de Degrade */}
        <div className="rounded-lg border border-border/70 bg-card/60 p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              Risco de Degrade
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded border px-1.5 py-0.2 text-[9px] font-bold",
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
      <div className="mt-3 border-t border-border/50 pt-2 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>Faixas de compras: Silver (3k - 6k) · Gold (6k - 20k) · Black (&gt; 20k)</span>
        <span className="font-medium">
          {nextTier ? `Próximo salto: +${fmtBRL(metaUpgrade - metaManutencao)}` : "Topo da carteira"}
        </span>
      </div>
    </div>
  );
}
