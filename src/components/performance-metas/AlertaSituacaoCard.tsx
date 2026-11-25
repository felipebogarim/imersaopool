// Destaque visual separado para alerta de situação do cliente:
// Risco de degrade, proximidade de upgrade, manutenção garantida ou ativação.
// Design suave, moderno e com comunicação provocativa (positivamente / comercialmente inspiradora).

import { useMemo } from "react";
import {
  AlertTriangle,
  Award,
  Crown,
  Flame,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL } from "@/lib/performance-metas";
import { semestreDeCorte, situacaoSemestral } from "@/lib/performance-categoria-semestre";

export type AlertaSituacaoCardProps = {
  categoria: string | null;
  /** Média mensal de compras no período do upload (R$). */
  realizado: number;
  /** Fim do período dos dados: define o semestre de corte (categoria é apurada por semestre). */
  periodoFim?: string | null;
  /** Acumulado real do semestre, quando conhecido. */
  acumuladoSemestre?: number | null;
  periodoLabel?: string | null;
  clienteNome?: string;
  className?: string;
};

type AlertaConfig = {
  tipo:
    | "degrade_critico"
    | "degrade_moderado"
    | "upgrade_proximo"
    | "upgrade_conquistado"
    | "manutencao_segura"
    | "silver_consolidacao";
  badge: string;
  titulo: string;
  mensagem: string;
  destaqueValor: string;
  destaqueRotulo: string;
  icon: typeof AlertTriangle;
  themeClasses: {
    container: string;
    iconWrapper: string;
    icon: string;
    badge: string;
    title: string;
    tagBg: string;
    tagText: string;
  };
};

export function AlertaSituacaoCard({
  categoria,
  realizado,
  periodoFim,
  acumuladoSemestre,
  periodoLabel,
  className,
}: AlertaSituacaoCardProps) {
  const config = useMemo<AlertaConfig>(() => {
    // Corte semestral: tudo em acumulado no semestre (piso mensal × 6).
    const sit = situacaoSemestral({
      categoria,
      mediaMensal: realizado,
      acumulado: acumuladoSemestre,
      semestre: semestreDeCorte(periodoFim),
    });
    const { manter, upgrade, acumulado, projecao, semestre } = sit;
    const tierIndex = ["Silver", "Gold", "Black"].indexOf(sit.categoria);
    const currentTier = { name: sit.categoria };
    const nextTier = upgrade ? { name: upgrade.categoria } : null;
    const metaManutencao = manter.piso;
    const atingimentoManutencaoPct = manter.atingimentoPct;
    const faltaManutencao = manter.falta;
    const sobraManutencao = manter.sobra;
    const metaUpgrade = upgrade?.piso ?? metaManutencao;
    const faltaUpgrade = upgrade?.falta ?? 0;
    const upgradeAlcancado = upgrade?.atingido ?? false;
    const quando = semestre.restantesLabel ? ` em ${semestre.restantesLabel}` : "";
    const porMes = (v: number | null | undefined) =>
      v != null ? ` (${fmtBRL(v)}/mês${quando})` : "";
    const ritmo = semestre.restantesLabel
      ? ` Mantida a média de ${fmtBRL(realizado)}/mês, o semestre fecha em ${fmtBRL(projecao)}.`
      : "";
    const mediaTxt = `média de ${fmtBRL(realizado)}/mês`;

    // 1. Upgrade Conquistado
    if (upgradeAlcancado && nextTier) {
      return {
        tipo: "upgrade_conquistado",
        badge: `Salto de Categoria Conquistado · ${semestre.label}`,
        titulo: `Parabéns! Cliente qualificado para Categoria ${nextTier.name}`,
        mensagem: `Com ${mediaTxt}, o cliente supera o piso ${nextTier.name} de ${fmtBRL(upgrade?.pisoMensal ?? 0)}/mês e fecha o ${semestre.label} em ${fmtBRL(projecao)} (piso ${fmtBRL(metaUpgrade)}). Momento ideal para consolidar a parceria no novo patamar e expandir linhas de portfólio!`,
        destaqueValor: `+${fmtBRL(upgrade?.sobra ?? 0)}`,
        destaqueRotulo: `acima de ${nextTier.name} no semestre`,
        icon: Crown,
        themeClasses: {
          container:
            "from-emerald-500/12 via-emerald-500/5 to-card border-emerald-300 dark:border-emerald-800/60",
          iconWrapper:
            "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-500/10",
          icon: "text-emerald-600 dark:text-emerald-400",
          badge:
            "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
          title: "text-emerald-950 dark:text-emerald-100",
          tagBg: "bg-emerald-500/10 border-emerald-300/40",
          tagText: "text-emerald-700 dark:text-emerald-300",
        },
      };
    }

    // 2. Muito Próximo do Upgrade (projeção do semestre a partir de 85% do piso da próxima categoria)
    if (nextTier && upgrade && !sit.encerrado && upgrade.atingimentoPct >= 85) {
      return {
        tipo: "upgrade_proximo",
        badge: `Oportunidade de Upgrade · Rumo a ${nextTier.name}`,
        titulo: `Ao alcance do patamar ${nextTier.name}! Faltam ${fmtBRL(faltaUpgrade)} no acumulado do semestre`,
        mensagem: `Com ${mediaTxt}, o cliente está a ${upgrade.atingimentoPct.toFixed(0)}% do piso ${nextTier.name} (${fmtBRL(upgrade.pisoMensal)}/mês = ${fmtBRL(metaUpgrade)} no semestre).${ritmo} Para subir no corte faltam ${fmtBRL(faltaUpgrade)}${porMes(upgrade.necessarioMes)} — um pedido de reposição ou novos portfólios garante a promoção!`,
        destaqueValor: `Faltam ${fmtBRL(faltaUpgrade)}`,
        destaqueRotulo: `alvo semestral ${fmtBRL(metaUpgrade)}`,
        icon: Rocket,
        themeClasses: {
          container:
            "from-purple-500/12 via-purple-500/5 to-card border-purple-300 dark:border-purple-800/60",
          iconWrapper:
            "bg-purple-500/15 text-purple-600 dark:text-purple-400 ring-4 ring-purple-500/10",
          icon: "text-purple-600 dark:text-purple-400",
          badge:
            "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
          title: "text-purple-950 dark:text-purple-100",
          tagBg: "bg-purple-500/10 border-purple-300/40",
          tagText: "text-purple-700 dark:text-purple-300",
        },
      };
    }

    // 3. Risco Crítico de Degrade (Gold/Black abaixo do piso da categoria anterior ou < 50% da manutenção)
    if (tierIndex > 0 && !manter.atingido && sit.risco.nivel === "alto") {
      return {
        tipo: "degrade_critico",
        badge: `Blindagem de Categoria · ${semestre.label}`,
        titulo: sit.encerrado
          ? `Semestre fechou ${fmtBRL(faltaManutencao)} abaixo do piso ${currentTier.name}`
          : `Atenção: faltam ${fmtBRL(faltaManutencao)} no acumulado do semestre para defender a Categoria ${currentTier.name}`,
        mensagem: sit.encerrado
          ? `O cliente acumulou ${fmtBRL(acumulado)} no ${semestre.label}, abaixo do piso semestral de ${fmtBRL(metaManutencao)}. Plano de recuperação no próximo semestre é prioridade!`
          : `Com ${mediaTxt}, abaixo do piso ${currentTier.name} de ${fmtBRL(manter.pisoMensal)}/mês.${ritmo} Faltam ${fmtBRL(faltaManutencao)} para o piso de ${fmtBRL(metaManutencao)}${porMes(manter.necessarioMes)} — uma ativação concentrada nos portfólios com menor compra protege o cliente no corte!`,
        destaqueValor: `Faltam ${fmtBRL(faltaManutencao)}`,
        destaqueRotulo: `piso semestral ${fmtBRL(metaManutencao)}`,
        icon: Flame,
        themeClasses: {
          container:
            "from-rose-500/12 via-rose-500/5 to-card border-rose-300 dark:border-rose-800/60",
          iconWrapper: "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-4 ring-rose-500/10",
          icon: "text-rose-600 dark:text-rose-400",
          badge:
            "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700",
          title: "text-rose-950 dark:text-rose-100",
          tagBg: "bg-rose-500/10 border-rose-300/40",
          tagText: "text-rose-700 dark:text-rose-300",
        },
      };
    }

    // 4. Risco Moderado de Degrade (Gold/Black acima do piso anterior, mas sem garantir o patamar atual)
    if (tierIndex > 0 && !manter.atingido) {
      return {
        tipo: "degrade_moderado",
        badge: `Atenção ao Ritmo · Manutenção no ${semestre.label}`,
        titulo: `Falta pouco para carimbar a permanência em ${currentTier.name}`,
        mensagem: `Com ${mediaTxt}, o cliente está a ${atingimentoManutencaoPct.toFixed(0)}% do piso ${currentTier.name} (${fmtBRL(manter.pisoMensal)}/mês = ${fmtBRL(metaManutencao)} no semestre).${ritmo} Faltam ${fmtBRL(faltaManutencao)} no acumulado${porMes(manter.necessarioMes)} para blindar a categoria no corte!`,
        destaqueValor: `Faltam ${fmtBRL(faltaManutencao)}`,
        destaqueRotulo: `piso semestral ${fmtBRL(metaManutencao)}`,
        icon: AlertTriangle,
        themeClasses: {
          container:
            "from-amber-500/12 via-amber-500/5 to-card border-amber-300 dark:border-amber-800/60",
          iconWrapper:
            "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/10",
          icon: "text-amber-600 dark:text-amber-400",
          badge:
            "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
          title: "text-amber-950 dark:text-amber-100",
          tagBg: "bg-amber-500/10 border-amber-300/40",
          tagText: "text-amber-700 dark:text-amber-300",
        },
      };
    }

    // 5. Categoria Silver em Construção de Base (abaixo do piso semestral)
    if (tierIndex === 0 && !manter.atingido) {
      return {
        tipo: "silver_consolidacao",
        badge: "Ritmo de Ativação · Categoria Silver",
        titulo: `Faltam ${fmtBRL(faltaManutencao)} no acumulado do semestre para o piso Silver`,
        mensagem: `Com ${mediaTxt}, abaixo do piso Silver de ${fmtBRL(manter.pisoMensal)}/mês.${ritmo} Com compras regulares${porMes(manter.necessarioMes)} e mix diversificado nos 7 portfólios, o cliente atinge os ${fmtBRL(metaManutencao)} do semestre e mira o salto até Gold!`,
        destaqueValor: `Faltam ${fmtBRL(faltaManutencao)}`,
        destaqueRotulo: `piso semestral ${fmtBRL(metaManutencao)}`,
        icon: Zap,
        themeClasses: {
          container:
            "from-amber-500/12 via-amber-500/5 to-card border-amber-300 dark:border-amber-800/60",
          iconWrapper:
            "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/10",
          icon: "text-amber-600 dark:text-amber-400",
          badge:
            "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
          title: "text-amber-950 dark:text-amber-100",
          tagBg: "bg-amber-500/10 border-amber-300/40",
          tagText: "text-amber-700 dark:text-amber-300",
        },
      };
    }

    // 6. Manutenção Garantida com Segurança
    return {
      tipo: "manutencao_segura",
      badge: `Patamar ${currentTier.name} ${manter.garantido ? "Garantido" : "Mantido"} · ${semestre.label}`,
      titulo: `Categoria ${currentTier.name} mantida: ${mediaTxt}, acima do piso de ${fmtBRL(manter.pisoMensal)}/mês`,
      mensagem: nextTier
        ? `No ritmo atual o semestre fecha em ${fmtBRL(projecao)}, +${fmtBRL(sobraManutencao)} acima do piso ${currentTier.name} (${fmtBRL(metaManutencao)}). Agora o objetivo é o salto para ${nextTier.name} — faltam ${fmtBRL(faltaUpgrade)} no acumulado${porMes(upgrade?.necessarioMes)}!`
        : `Excelente performance! No ritmo atual o semestre fecha em ${fmtBRL(projecao)}, +${fmtBRL(sobraManutencao)} acima do piso Black (${fmtBRL(metaManutencao)}). O cliente se mantém no patamar máximo da carteira.`,
      destaqueValor: `+${fmtBRL(sobraManutencao)}`,
      destaqueRotulo: `acima de ${currentTier.name} no semestre`,
      icon: ShieldCheck,
      themeClasses: {
        container: "from-sky-500/12 via-sky-500/5 to-card border-sky-300 dark:border-sky-800/60",
        iconWrapper: "bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-4 ring-sky-500/10",
        icon: "text-sky-600 dark:text-sky-400",
        badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700",
        title: "text-sky-950 dark:text-sky-100",
        tagBg: "bg-sky-500/10 border-sky-300/40",
        tagText: "text-sky-700 dark:text-sky-300",
      },
    };
  }, [categoria, realizado, acumuladoSemestre, periodoFim]);

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-r p-4 shadow-sm transition-all",
        config.themeClasses.container,
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Lado esquerdo: Ícone com halo + Badge + Título + Mensagem */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform",
              config.themeClasses.iconWrapper,
            )}
          >
            <Icon className={cn("h-5 w-5", config.themeClasses.icon)} />
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-tight uppercase",
                  config.themeClasses.badge,
                )}
              >
                {config.badge}
              </span>
              {periodoLabel && (
                <span className="text-[10px] text-muted-foreground/80 font-medium tabular-nums">
                  {periodoLabel}
                </span>
              )}
            </div>

            <h3
              className={cn(
                "text-sm font-bold tracking-tight leading-snug",
                config.themeClasses.title,
              )}
            >
              {config.titulo}
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed">{config.mensagem}</p>
          </div>
        </div>

        {/* Lado direito: Tag de Destaque Numérico */}
        <div className="sm:self-center shrink-0">
          <div
            className={cn(
              "flex flex-col items-start sm:items-end rounded-lg border px-3.5 py-1.5 backdrop-blur-xs",
              config.themeClasses.tagBg,
            )}
          >
            <span
              className={cn(
                "text-sm font-extrabold tracking-tight tabular-nums",
                config.themeClasses.tagText,
              )}
            >
              {config.destaqueValor}
            </span>
            <span className="text-[10px] text-muted-foreground/90 font-medium">
              {config.destaqueRotulo}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
