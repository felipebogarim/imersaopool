// Evolução e faixa de categoria (corte semestral). Recebe a situação já apurada
// (`situacaoCategoria`), a mesma usada no alerta de situação, para manter tudo consistente.
// Régua: MÉDIA MENSAL contra os pisos de R$ 3.000 / 6.000 / 20.000; acumulado é complementar.

import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Info,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL } from "@/lib/performance-metas";
import {
  ESTADO_LABEL,
  MESES_SEMESTRE,
  posicaoReguaMensal,
  type MetaCategoria,
  type SituacaoCategoria,
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

const ESTADO_BADGE = {
  garantida: {
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300",
    icon: ShieldCheck,
  },
  manutencao: {
    cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300",
    icon: CheckCircle2,
  },
  risco: {
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300",
    icon: AlertTriangle,
  },
} as const;

const RISCO_BADGE = {
  baixo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300",
  medio: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300",
  alto: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300",
} as const;

const FONTE_LABEL = {
  semestre: "real do semestre",
  semestre_parcial: "parcial do semestre",
  estimada: "estimada",
} as const;

/** Marca "estimado" ao lado de um indicador derivado de estimativa. */
function Est({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="ml-1 rounded bg-amber-500/15 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
      estimado
    </span>
  );
}

function Linha({
  rotulo,
  valor,
  estimado = false,
  destaque,
}: {
  rotulo: string;
  valor: string;
  estimado?: boolean;
  destaque?: "bom" | "ruim";
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[10px] leading-snug">
      <span className="text-muted-foreground">{rotulo}</span>
      <span
        className={cn(
          "whitespace-nowrap font-semibold tabular-nums text-foreground",
          destaque === "bom" && "text-emerald-600 dark:text-emerald-400",
          destaque === "ruim" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {valor}
        <Est on={estimado} />
      </span>
    </div>
  );
}

/** Indicadores de uma categoria-alvo (manter a atual ou alcançar a próxima). */
function Indicadores({ meta, sit }: { meta: MetaCategoria; sit: SituacaoCategoria }) {
  const restantes = sit.semestre.restantesLabel;
  const saldo = meta.saldoProjetado;
  return (
    <div className="mt-1.5 space-y-0.5">
      <Linha rotulo="Piso mensal" valor={`${fmtBRL(meta.pisoMensal)}/mês`} />
      <Linha
        rotulo="Atingimento"
        valor={`${meta.atingimentoPct.toFixed(0)}%`}
        estimado={sit.mediaEstimada}
        destaque={meta.atingido ? "bom" : "ruim"}
      />
      <Linha
        rotulo={saldo >= 0 ? "Excedente no fechamento" : "Déficit no fechamento"}
        valor={`${saldo >= 0 ? "+" : "−"}${fmtBRL(Math.abs(saldo))}`}
        estimado={sit.mediaEstimada || sit.acumuladoEstimado}
        destaque={saldo >= 0 ? "bom" : "ruim"}
      />
      {!sit.encerrado && (
        <>
          <Linha
            rotulo={`Compras necessárias até ${sit.semestre.mesesLabel.split("–")[1] ?? "o fim"}`}
            valor={fmtBRL(meta.volumeNecessario)}
            estimado={sit.acumuladoEstimado}
          />
          <Linha
            rotulo={`Média necessária ${restantes ? `(${restantes})` : ""}`}
            valor={meta.necessarioMes != null ? `${fmtBRL(meta.necessarioMes)}/mês` : "—"}
            estimado={sit.acumuladoEstimado && meta.necessarioMes != null}
          />
        </>
      )}
    </div>
  );
}

export function CategoriaTimelineCard({
  situacao: sit,
  periodoLabel,
  className,
}: {
  situacao: SituacaoCategoria;
  periodoLabel?: string | null;
  className?: string;
}) {
  const { semestre, manter, proxima, base } = sit;
  const currentIndex = Math.max(
    0,
    CATEGORY_TIERS.findIndex((t) => t.name === sit.categoria),
  );
  const currentTier = CATEGORY_TIERS[currentIndex];
  const estado = ESTADO_BADGE[sit.estado];
  const fill = posicaoReguaMensal(sit.mediaMensal);

  return (
    <div
      className={cn(
        "flex h-full flex-1 flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div>
        {/* Topo */}
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
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold",
                currentTier.badgeClass,
              )}
            >
              Categoria Atual: {currentTier.name}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold",
                estado.cls,
              )}
            >
              <estado.icon className="h-3 w-3" />
              {ESTADO_LABEL[sit.estado]}
            </span>
            {sit.evolucaoProjetada && proxima && (
              <span className="inline-flex items-center gap-1 rounded-md border border-purple-300 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                <TrendingUp className="h-3 w-3" /> Evolução projetada: {proxima.categoria}
              </span>
            )}
            <span
              className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
              title="Categoria apurada no corte semestral"
            >
              Corte: {semestre.label} ({semestre.mesesLabel})
            </span>
          </div>
        </div>

        {/* Régua: média mensal × pisos mensais */}
        <div className="mt-4 px-2">
          <div
            className="relative mb-2 grid grid-cols-3 text-center"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
          >
            {CATEGORY_TIERS.map((tier, idx) => {
              const isCurrent = idx === currentIndex;
              const isAchieved = sit.mediaMensal >= tier.target;
              return (
                <div key={tier.name} className="flex flex-col items-center">
                  <span
                    className={cn(
                      "text-[11px] font-bold tracking-tight",
                      isCurrent && "font-extrabold text-foreground",
                      !isCurrent && isAchieved && "text-primary",
                      !isCurrent && !isAchieved && "text-muted-foreground",
                    )}
                  >
                    {tier.name}
                  </span>
                  <span className="text-[10px] font-semibold tabular-nums text-foreground/80">
                    {fmtBRL(tier.target)}/mês
                  </span>
                  <span className="text-[8px] tabular-nums text-muted-foreground/60">
                    {fmtBRL(tier.target * MESES_SEMESTRE)} no semestre
                  </span>
                  {isCurrent && (
                    <span className="mt-0.5 rounded-full bg-primary/10 px-1.5 text-[8px] font-bold text-primary">
                      Atual
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="relative my-2 h-3 w-full rounded-full bg-muted/50 p-0.5">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${fill}%`,
                background:
                  fill >= 66
                    ? "linear-gradient(90deg, #94a3b8 0%, #f59e0b 50%, #8b5cf6 100%)"
                    : fill >= 33
                      ? "linear-gradient(90deg, #94a3b8 0%, #f59e0b 100%)"
                      : "linear-gradient(90deg, #64748b 0%, #94a3b8 100%)",
              }}
            />
            {[
              ["33.3%", "Piso Silver: R$ 3.000/mês"],
              ["66.6%", "Piso Gold: R$ 6.000/mês"],
            ].map(([left, title]) => (
              <div
                key={left}
                className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-border"
                style={{ left }}
                title={title}
              />
            ))}
            <div
              className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-border"
              style={{ right: "0%" }}
              title="Piso Black: R$ 20.000/mês"
            />
            {fill > 0 && (
              <div
                className="absolute top-1/2 -ml-2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-background shadow-md transition-all duration-700 ease-out"
                style={{
                  left: `${fill}%`,
                  backgroundColor: currentTier.activeColor,
                  boxShadow: `0 0 10px ${currentTier.glowColor}`,
                }}
                title={`Média mensal: ${fmtBRL(sit.mediaMensal)}`}
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-0.5 text-[10px] text-muted-foreground">
            <span>R$ 0</span>
            <span className="text-center tabular-nums">
              <span className="font-semibold text-foreground">
                Média mensal atual: {fmtBRL(sit.mediaMensal)}
              </span>
              <Est on={sit.mediaEstimada} />
              <span className="ml-1">
                · acumulado {semestre.decorridosLabel || "—"}: {fmtBRL(sit.acumulado)}
              </span>
              <Est on={sit.acumuladoEstimado} />
            </span>
            <span>R$ 20k+/mês</span>
          </div>
        </div>
      </div>

      {/* Blocos */}
      <div
        className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
      >
        <div className="flex min-w-0 flex-col rounded-lg border border-border/70 bg-card/60 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="whitespace-nowrap text-[10px] font-semibold uppercase text-muted-foreground">
              Manter {manter.categoria}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 whitespace-nowrap rounded border px-1.5 text-[9px] font-bold",
                estado.cls,
              )}
            >
              {ESTADO_LABEL[sit.estado]}
            </span>
          </div>
          <p className="mt-1 text-sm font-bold tabular-nums text-foreground">
            {fmtBRL(sit.mediaMensal)}
            <span className="text-[10px] font-normal text-muted-foreground">
              {" "}
              / {fmtBRL(manter.pisoMensal)} por mês
            </span>
            <Est on={sit.mediaEstimada} />
          </p>
          <Indicadores meta={manter} sit={sit} />
        </div>

        <div className="flex min-w-0 flex-col rounded-lg border border-border/70 bg-card/60 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="whitespace-nowrap text-[10px] font-semibold uppercase text-muted-foreground">
              {proxima ? `Evoluir para ${proxima.categoria}` : "Categoria máxima"}
            </span>
            {proxima && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 whitespace-nowrap rounded px-1.5 text-[9px] font-bold",
                  sit.evolucaoProjetada
                    ? "bg-purple-500/15 text-purple-700 dark:text-purple-300"
                    : "bg-primary/10 text-primary",
                )}
              >
                <TrendingUp className="h-2.5 w-2.5" />
                {sit.evolucaoProjetada ? "Projetada" : proxima.categoria}
              </span>
            )}
          </div>
          {proxima ? (
            <>
              <p className="mt-1 text-sm font-bold tabular-nums text-foreground">
                {sit.evolucaoProjetada
                  ? "Média compatível"
                  : `Faltam ${fmtBRL(proxima.pisoMensal - sit.mediaMensal)}/mês`}
                <Est on={sit.mediaEstimada} />
              </p>
              <Indicadores meta={proxima} sit={sit} />
            </>
          ) : (
            <>
              <p className="mt-1 text-sm font-bold text-primary">Elite Black</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Cliente no patamar mais elevado
              </p>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col rounded-lg border border-border/70 bg-card/60 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="whitespace-nowrap text-[10px] font-semibold uppercase text-muted-foreground">
              Situação
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 text-[9px] font-bold",
                RISCO_BADGE[sit.risco.nivel],
              )}
            >
              {sit.risco.nivel === "alto" ? (
                <ShieldAlert className="h-2.5 w-2.5" />
              ) : sit.risco.nivel === "medio" ? (
                <AlertTriangle className="h-2.5 w-2.5" />
              ) : (
                <ShieldCheck className="h-2.5 w-2.5" />
              )}
              {sit.risco.titulo}
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium leading-snug text-foreground">
            {sit.risco.descricao}
          </p>
        </div>
      </div>

      {/* Memória de cálculo: origem, período e composição por portfólio */}
      <details className="mt-3 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[10px]">
        <summary className="cursor-pointer select-none font-semibold text-muted-foreground">
          Memória de cálculo
        </summary>
        <div className="mt-1.5 space-y-1.5">
          {base.composicao.length > 0 && (
            <table className="w-full tabular-nums">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-0.5 font-medium">Portfólio</th>
                  <th className="py-0.5 text-right font-medium">Média mensal</th>
                  <th className="py-0.5 pl-2 font-medium">Origem</th>
                </tr>
              </thead>
              <tbody>
                {base.composicao.map((c) => (
                  <tr key={c.familia} className="border-t border-border/40">
                    <td className="py-0.5">{c.familia}</td>
                    <td className="py-0.5 text-right">{fmtBRL(c.mediaMensal)}</td>
                    <td className="py-0.5 pl-2 text-muted-foreground">{c.origem}</td>
                  </tr>
                ))}
                <tr className="border-t border-border font-semibold">
                  <td className="py-0.5">Total</td>
                  <td className="py-0.5 text-right">{fmtBRL(sit.mediaMensal)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {base.memoria.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
            <li>
              Acumulado {semestre.decorridosLabel || "—"}: {fmtBRL(sit.acumulado)}
              {sit.acumuladoEstimado ? " (estimado = média × meses decorridos)" : " (real)"} ·
              Projeção do fechamento = acumulado + média × {semestre.mesesRestantes} mês(es)
              restante(s) = {fmtBRL(sit.projecao)} · Piso semestral {sit.categoria} ={" "}
              {fmtBRL(manter.pisoMensal)} × {MESES_SEMESTRE} = {fmtBRL(manter.piso)}
            </li>
          </ul>
        </div>
      </details>

      {/* Origem dos dados */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-1 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
        <span className="flex items-start gap-1">
          <Info className="mt-px h-3 w-3 shrink-0" />
          <span>
            Média {FONTE_LABEL[base.fonte]}: <strong>{base.periodoMedia}</strong>
            {base.fonte === "estimada" &&
              ` — o banco não tem dados só de ${semestre.decorridosLabel || "meses do semestre"}; a média do período do upload é usada como estimativa do ${semestre.label}.`}
            {base.fonte === "semestre_parcial" &&
              ` — ${base.mesesObservados} de ${semestre.mesesDecorridos} meses decorridos com dados; acumulado estimado.`}
            {periodoLabel && base.fonte !== "estimada" && ` · upload atual: ${periodoLabel}`}
          </span>
        </span>
        <span>
          Corte semestral: categoria pela média mensal no semestre (piso × {MESES_SEMESTRE})
        </span>
      </div>
    </div>
  );
}
