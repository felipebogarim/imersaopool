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
import { CATEGORY_TIERS } from "./CategoriaTimelineCard";

export type AlertaSituacaoCardProps = {
  categoria: string | null;
  realizado: number;
  periodoLabel?: string | null;
  clienteNome?: string;
  className?: string;
};

type AlertaConfig = {
  tipo: "degrade_critico" | "degrade_moderado" | "upgrade_proximo" | "upgrade_conquistado" | "manutencao_segura" | "silver_consolidacao";
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
  periodoLabel,
  className,
}: AlertaSituacaoCardProps) {
  const config = useMemo<AlertaConfig>(() => {
    const catNorm = (categoria ?? "Silver").trim().toLowerCase();
    const currentIndex = CATEGORY_TIERS.findIndex((t) => t.name.toLowerCase() === catNorm);
    const tierIndex = currentIndex >= 0 ? currentIndex : 0;
    const currentTier = CATEGORY_TIERS[tierIndex];
    const nextTier = tierIndex < CATEGORY_TIERS.length - 1 ? CATEGORY_TIERS[tierIndex + 1] : null;
    const prevTier = tierIndex > 0 ? CATEGORY_TIERS[tierIndex - 1] : null;

    const metaManutencao = currentTier.target;
    const atingimentoManutencaoPct = metaManutencao > 0 ? (realizado / metaManutencao) * 100 : 0;
    const faltaManutencao = Math.max(0, metaManutencao - realizado);
    const sobraManutencao = Math.max(0, realizado - metaManutencao);

    const metaUpgrade = nextTier ? nextTier.target : metaManutencao;
    const faltaUpgrade = nextTier ? Math.max(0, metaUpgrade - realizado) : 0;
    const upgradeAlcancado = nextTier ? realizado >= metaUpgrade : false;
    const percentualParaUpgrade = nextTier && metaUpgrade > 0 ? (realizado / metaUpgrade) * 100 : 0;

    // 1. Upgrade Conquistado
    if (upgradeAlcancado && nextTier) {
      return {
        tipo: "upgrade_conquistado",
        badge: "Salto de Categoria Conquistado",
        titulo: `Parabéns! Cliente qualificado para Categoria ${nextTier.name}`,
        mensagem: `O cliente atingiu ${fmtBRL(realizado)}, superando a meta de ${fmtBRL(metaUpgrade)}. Momento ideal para consolidar a parceria no patamar de elite e expandir linhas de portfólio!`,
        destaqueValor: `+${fmtBRL(realizado - metaUpgrade)}`,
        destaqueRotulo: `acima de ${nextTier.name}`,
        icon: Crown,
        themeClasses: {
          container: "from-emerald-500/12 via-emerald-500/5 to-card border-emerald-300 dark:border-emerald-800/60",
          iconWrapper: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-500/10",
          icon: "text-emerald-600 dark:text-emerald-400",
          badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
          title: "text-emerald-950 dark:text-emerald-100",
          tagBg: "bg-emerald-500/10 border-emerald-300/40",
          tagText: "text-emerald-700 dark:text-emerald-300",
        },
      };
    }

    // 2. Muito Próximo do Upgrade (a partir de 70% do piso da próxima categoria)
    if (nextTier && percentualParaUpgrade >= 70) {
      return {
        tipo: "upgrade_proximo",
        badge: `Oportunidade de Upgrade · Rumo a ${nextTier.name}`,
        titulo: `A um passo do patamar ${nextTier.name}! Faltam apenas ${fmtBRL(faltaUpgrade)}`,
        mensagem: `O cliente já construiu ${percentualParaUpgrade.toFixed(0)}% do caminho para ${nextTier.name}. Um pedido de reposição ou inclusão de novos portfólios garante essa promoção de categoria neste ciclo!`,
        destaqueValor: `Faltam ${fmtBRL(faltaUpgrade)}`,
        destaqueRotulo: `alvo ${fmtBRL(metaUpgrade)}`,
        icon: Rocket,
        themeClasses: {
          container: "from-purple-500/12 via-purple-500/5 to-card border-purple-300 dark:border-purple-800/60",
          iconWrapper: "bg-purple-500/15 text-purple-600 dark:text-purple-400 ring-4 ring-purple-500/10",
          icon: "text-purple-600 dark:text-purple-400",
          badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
          title: "text-purple-950 dark:text-purple-100",
          tagBg: "bg-purple-500/10 border-purple-300/40",
          tagText: "text-purple-700 dark:text-purple-300",
        },
      };
    }

    // 3. Risco Crítico de Degrade (Gold/Black abaixo do piso da categoria anterior ou < 50% da manutenção)
    const pisoAnterior = prevTier ? prevTier.target : 0;
    if (tierIndex > 0 && (realizado < pisoAnterior || atingimentoManutencaoPct < 50)) {
      return {
        tipo: "degrade_critico",
        badge: "Blindagem de Categoria · Risco de Degrade",
        titulo: `Atenção: faltam ${fmtBRL(faltaManutencao)} para defender a Categoria ${currentTier.name}`,
        mensagem: `O faturamento atual (${fmtBRL(realizado)}) exige ação imediata para evitar queda de categoria. Uma ativação concentrada nos portfólios com menor compra já protege o cliente e recupera o ritmo!`,
        destaqueValor: `Faltam ${fmtBRL(faltaManutencao)}`,
        destaqueRotulo: `piso de ${fmtBRL(metaManutencao)}`,
        icon: Flame,
        themeClasses: {
          container: "from-rose-500/12 via-rose-500/5 to-card border-rose-300 dark:border-rose-800/60",
          iconWrapper: "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-4 ring-rose-500/10",
          icon: "text-rose-600 dark:text-rose-400",
          badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700",
          title: "text-rose-950 dark:text-rose-100",
          tagBg: "bg-rose-500/10 border-rose-300/40",
          tagText: "text-rose-700 dark:text-rose-300",
        },
      };
    }

    // 4. Risco Moderado de Degrade (Gold/Black acima do piso anterior, mas sem garantir o patamar atual)
    if (tierIndex > 0 && realizado < metaManutencao) {
      return {
        tipo: "degrade_moderado",
        badge: "Atenção ao Ritmo · Manutenção de Patamar",
        titulo: `Falta pouco para carimbar a permanência em ${currentTier.name}`,
        mensagem: `O cliente já atingiu ${atingimentoManutencaoPct.toFixed(0)}% do piso mínimo. Faltam ${fmtBRL(faltaManutencao)} para blindar 100% da categoria ${currentTier.name} e afastar qualquer risco de rebaixamento!`,
        destaqueValor: `Faltam ${fmtBRL(faltaManutencao)}`,
        destaqueRotulo: `meta ${fmtBRL(metaManutencao)}`,
        icon: AlertTriangle,
        themeClasses: {
          container: "from-amber-500/12 via-amber-500/5 to-card border-amber-300 dark:border-amber-800/60",
          iconWrapper: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/10",
          icon: "text-amber-600 dark:text-amber-400",
          badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
          title: "text-amber-950 dark:text-amber-100",
          tagBg: "bg-amber-500/10 border-amber-300/40",
          tagText: "text-amber-700 dark:text-amber-300",
        },
      };
    }

    // 5. Categoria Silver em Construção de Base (abaixo de 3.000)
    if (tierIndex === 0 && realizado < metaManutencao) {
      return {
        tipo: "silver_consolidacao",
        badge: "Ritmo de Ativação · Categoria Silver",
        titulo: `Faltam ${fmtBRL(faltaManutencao)} para o cliente atingir o ritmo Silver pleno`,
        mensagem: `Com compras regulares e mix diversificado nos 7 portfólios, o cliente atinge os ${fmtBRL(metaManutencao)} e firma sua posição ativa para mirar o salto até Gold!`,
        destaqueValor: `Faltam ${fmtBRL(faltaManutencao)}`,
        destaqueRotulo: `piso de ${fmtBRL(metaManutencao)}`,
        icon: Zap,
        themeClasses: {
          container: "from-amber-500/12 via-amber-500/5 to-card border-amber-300 dark:border-amber-800/60",
          iconWrapper: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/10",
          icon: "text-amber-600 dark:text-amber-400",
          badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
          title: "text-amber-950 dark:text-amber-100",
          tagBg: "bg-amber-500/10 border-amber-300/40",
          tagText: "text-amber-700 dark:text-amber-300",
        },
      };
    }

    // 6. Manutenção Garantida com Segurança
    return {
      tipo: "manutencao_segura",
      badge: `Patamar ${currentTier.name} Assegurado`,
      titulo: `Piso ${currentTier.name} garantido com folga (+${fmtBRL(sobraManutencao)} acima da meta)`,
      mensagem: nextTier
        ? `A permanência neste ciclo está consolidada. Agora o objetivo estratégico é o salto para ${nextTier.name} — faltam ${fmtBRL(faltaUpgrade)} para o novo patamar!`
        : `Excelente performance! O cliente se mantém firme no patamar máximo de elite da carteira.`,
      destaqueValor: `+${fmtBRL(sobraManutencao)}`,
      destaqueRotulo: `acima de ${currentTier.name}`,
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
  }, [categoria, realizado]);

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

            <h3 className={cn("text-sm font-bold tracking-tight leading-snug", config.themeClasses.title)}>
              {config.titulo}
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {config.mensagem}
            </p>
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
