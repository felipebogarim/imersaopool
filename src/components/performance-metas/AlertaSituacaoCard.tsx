// Destaque visual separado para alerta de situação do cliente:
// Risco de degrade, proximidade de upgrade, manutenção garantida ou ativação.
// Design suave, moderno e com comunicação provocativa (positivamente / comercialmente inspiradora).

import { useMemo } from "react";
import { AlertTriangle, Crown, Flame, Rocket, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL } from "@/lib/performance-metas";
import { ESTADO_LABEL, type SituacaoCategoria } from "@/lib/performance-categoria-semestre";

export type AlertaSituacaoCardProps = {
  /** Situação apurada por `situacaoCategoria` — a mesma do card de categoria. */
  situacao: SituacaoCategoria;
  periodoLabel?: string | null;
  className?: string;
};

type AlertaConfig = {
  tipo:
    | "degrade_critico"
    | "degrade_moderado"
    | "upgrade_proximo"
    | "evolucao_projetada"
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
  situacao: sit,
  periodoLabel,
  className,
}: AlertaSituacaoCardProps) {
  const estimado = sit.mediaEstimada || sit.acumuladoEstimado;
  const config = useMemo<AlertaConfig>(() => {
    const { manter, proxima, semestre } = sit;
    const tierIndex = ["Silver", "Gold", "Black"].indexOf(sit.categoria);
    const currentTier = { name: sit.categoria };
    const nextTier = proxima ? { name: proxima.categoria } : null;
    const est = sit.mediaEstimada ? " estimada" : "";
    const mediaTxt = `média mensal${est} de ${fmtBRL(sit.mediaMensal)}`;
    const quando = semestre.restantesLabel ? ` (${semestre.restantesLabel})` : "";
    const necessario = (m: typeof manter) =>
      m.necessarioMes != null
        ? ` Compras necessárias até o fim do semestre: ${fmtBRL(m.volumeNecessario)} — média de ${fmtBRL(m.necessarioMes)}/mês${quando}.`
        : "";
    const deficit = Math.max(0, -manter.saldoProjetado);
    const excedente = Math.max(0, manter.saldoProjetado);
    const projTxt = `${fmtBRL(sit.projecao)} projetados no fechamento`;

    // 1. Evolução de categoria projetada (média compatível com a próxima categoria)
    if (sit.evolucaoProjetada && nextTier && proxima) {
      return {
        tipo: "evolucao_projetada",
        badge: `Evolução projetada para ${nextTier.name} · ${semestre.label}`,
        titulo: `Média compatível com a Categoria ${nextTier.name}`,
        mensagem: `Com ${mediaTxt}, o cliente supera o piso ${nextTier.name} de ${fmtBRL(proxima.pisoMensal)}/mês (${proxima.atingimentoPct.toFixed(0)}%). Mantido o ritmo: ${projTxt}, excedente projetado de ${fmtBRL(proxima.saldoProjetado)} sobre o piso semestral de ${fmtBRL(proxima.piso)}. A evolução só se confirma no corte — momento de consolidar o novo patamar!`,
        destaqueValor: `+${fmtBRL(proxima.saldoProjetado)}`,
        destaqueRotulo: `excedente projetado (${nextTier.name})`,
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

    // 2. Próximo da evolução: categoria atual em manutenção/garantida e média ≥ 85% da próxima
    if (
      nextTier &&
      proxima &&
      !sit.encerrado &&
      sit.estado !== "risco" &&
      proxima.atingimentoPct >= 85
    ) {
      return {
        tipo: "upgrade_proximo",
        badge: `${ESTADO_LABEL[sit.estado]} · Rumo a ${nextTier.name}`,
        titulo: `Ao alcance do patamar ${nextTier.name}: média a ${proxima.atingimentoPct.toFixed(0)}% do piso de ${fmtBRL(proxima.pisoMensal)}/mês`,
        mensagem: `Com ${mediaTxt}, déficit projetado de ${fmtBRL(-proxima.saldoProjetado)} para o piso ${nextTier.name} de ${fmtBRL(proxima.piso)} no semestre.${necessario(proxima)}`,
        destaqueValor: `−${fmtBRL(-proxima.saldoProjetado)}`,
        destaqueRotulo: `déficit projetado (${nextTier.name})`,
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

    // 3. Em risco, nível alto (abaixo do piso da categoria anterior ou semestre encerrado)
    if (tierIndex > 0 && sit.estado === "risco" && sit.risco.nivel === "alto") {
      return {
        tipo: "degrade_critico",
        badge: `Em risco · ${sit.risco.titulo} · ${semestre.label}`,
        titulo: sit.encerrado
          ? `Semestre fechou com média abaixo do piso ${currentTier.name} de ${fmtBRL(manter.pisoMensal)}/mês`
          : `Média mensal a ${manter.atingimentoPct.toFixed(0)}% do piso ${currentTier.name}: déficit projetado de ${fmtBRL(deficit)}`,
        mensagem: sit.encerrado
          ? `Com ${mediaTxt} no ${semestre.label}, abaixo do piso de ${fmtBRL(manter.pisoMensal)}/mês (${fmtBRL(manter.piso)} no semestre). Plano de recuperação no próximo semestre é prioridade!`
          : `Com ${mediaTxt}, abaixo do piso ${currentTier.name} de ${fmtBRL(manter.pisoMensal)}/mês.${necessario(manter)} Ativação concentrada nos portfólios com menor compra protege o cliente no corte.`,
        destaqueValor: `−${fmtBRL(deficit)}`,
        destaqueRotulo: `déficit projetado · piso ${fmtBRL(manter.piso)}`,
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

    // 4. Em risco (média abaixo do piso mensal, acima do piso anterior)
    if (tierIndex > 0 && sit.estado === "risco") {
      return {
        tipo: "degrade_moderado",
        badge: `Em risco · ${currentTier.name} · ${semestre.label}`,
        titulo: `Média mensal a ${manter.atingimentoPct.toFixed(0)}% do piso ${currentTier.name} de ${fmtBRL(manter.pisoMensal)}/mês`,
        mensagem: `Com ${mediaTxt}, abaixo do piso. Mantido o ritmo: ${projTxt}, déficit de ${fmtBRL(deficit)} sobre o piso semestral de ${fmtBRL(manter.piso)}.${necessario(manter)}`,
        destaqueValor: `−${fmtBRL(deficit)}`,
        destaqueRotulo: `déficit projetado · piso ${fmtBRL(manter.piso)}`,
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
    if (tierIndex === 0 && sit.estado === "risco") {
      return {
        tipo: "silver_consolidacao",
        badge: `Em risco · ${sit.risco.titulo} · Silver`,
        titulo: `Média mensal a ${manter.atingimentoPct.toFixed(0)}% do piso Silver de ${fmtBRL(manter.pisoMensal)}/mês`,
        mensagem: `Com ${mediaTxt}. Mantido o ritmo: ${projTxt}, déficit de ${fmtBRL(deficit)} sobre o piso semestral de ${fmtBRL(manter.piso)}.${necessario(manter)}`,
        destaqueValor: `−${fmtBRL(deficit)}`,
        destaqueRotulo: `déficit projetado · piso ${fmtBRL(manter.piso)}`,
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
      badge: `${ESTADO_LABEL[sit.estado]} · ${currentTier.name} · ${semestre.label}`,
      titulo:
        sit.estado === "garantida"
          ? `Categoria ${currentTier.name} garantida: acumulado real de ${fmtBRL(sit.acumulado)} ≥ piso semestral de ${fmtBRL(manter.piso)}`
          : `Categoria ${currentTier.name} em manutenção: ${mediaTxt} ≥ piso de ${fmtBRL(manter.pisoMensal)}/mês (${manter.atingimentoPct.toFixed(0)}%)`,
      mensagem:
        (sit.estado === "garantida"
          ? "O piso do semestre já foi atingido com compras reais."
          : `Mantido o ritmo: ${projTxt}, excedente de ${fmtBRL(excedente)} sobre o piso semestral de ${fmtBRL(manter.piso)}. Ainda não é garantia definitiva: faltam ${fmtBRL(manter.volumeNecessario)} em compras até o fim do semestre.`) +
        (nextTier && proxima
          ? ` Para evoluir a ${nextTier.name}: média de ${fmtBRL(proxima.pisoMensal)}/mês (hoje ${proxima.atingimentoPct.toFixed(0)}%).`
          : " Cliente no patamar máximo da carteira."),
      destaqueValor: `+${fmtBRL(excedente)}`,
      destaqueRotulo: `excedente projetado · piso ${fmtBRL(manter.piso)}`,
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
  }, [sit]);

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
              {estimado && (
                <span
                  className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300"
                  title={sit.base.memoria.join("\n")}
                >
                  Valores estimados
                </span>
              )}
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
