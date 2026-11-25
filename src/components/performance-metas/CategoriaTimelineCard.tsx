// Evolução e faixa de categoria (padrão visual original): barra por faixas com o marcador na
// MÉDIA MENSAL de compras, pisos vindos de "Mínimos por categoria", e três blocos — manter a
// categoria cadastrada, evoluir para a próxima e situação. Recebe a apuração pronta
// (`situacaoCategoria`), a mesma do alerta, para os dois nunca divergirem.

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
import { fmtBRL, METAS_FAMILY_LABEL } from "@/lib/performance-metas";
import {
  CATEGORIAS,
  posicaoNaRegua,
  type CategoriaNome,
  type EstadoCategoria,
  type SituacaoCategoria,
} from "@/lib/performance-categoria";
import type { PisosCategoria } from "@/lib/performance-metas-minimos";
import { FONTE_MEDIA_LABEL, type MediaCliente } from "@/lib/performance-media-cliente";
import { MinimosCategoriaButton } from "./MinimosCategoriaDialog";

const TIER_STYLE: Record<
  CategoriaNome,
  { badgeClass: string; activeColor: string; glowColor: string }
> = {
  Silver: {
    badgeClass:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    activeColor: "#94a3b8",
    glowColor: "rgba(148, 163, 184, 0.4)",
  },
  Gold: {
    badgeClass:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
    activeColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.4)",
  },
  Black: {
    badgeClass: "bg-purple-950/20 text-purple-900 dark:text-purple-200 border-purple-400/40",
    activeColor: "#8b5cf6",
    glowColor: "rgba(139, 92, 246, 0.4)",
  },
};

const ESTADO_INFO: Record<
  EstadoCategoria,
  { titulo: string; cls: string; icon: typeof ShieldCheck }
> = {
  evolucao: {
    titulo: "Desempenho superior",
    cls: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300",
    icon: TrendingUp,
  },
  proximo_evoluir: {
    titulo: "Próximo de evoluir",
    cls: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300",
    icon: TrendingUp,
  },
  manutencao: {
    titulo: "Categoria mantida",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300",
    icon: ShieldCheck,
  },
  atencao: {
    titulo: "Pouca folga",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300",
    icon: AlertTriangle,
  },
  risco_queda: {
    titulo: "Risco de queda",
    cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300",
    icon: ShieldAlert,
  },
  sem_base: {
    titulo: "Sem base de compras",
    cls: "bg-muted text-muted-foreground border-border",
    icon: Info,
  },
};

function Est({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span
      className="ml-1 rounded bg-amber-500/15 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300"
      title={FONTE_MEDIA_LABEL.estimado}
    >
      estimado
    </span>
  );
}

function descricaoSituacao(s: SituacaoCategoria): string {
  switch (s.estado) {
    case "evolucao":
      return `Média compatível com ${s.enquadrada}, acima da categoria cadastrada (${s.cadastrada}).`;
    case "risco_queda":
      return `Média abaixo do piso ${s.cadastrada}; enquadra-se em ${s.enquadrada ?? "faixa abaixo de Silver"}.`;
    case "proximo_evoluir":
      return `Média a ${Math.round(((s.media ?? 0) / (s.pisoProxima ?? 1)) * 100)}% do piso ${s.proxima}.`;
    case "atencao":
      return `Folga de ${fmtBRL(s.saldoManutencao ?? 0)}/mês sobre o piso: menos de 10%.`;
    case "manutencao":
      return `Média em ${Math.round((s.pctPiso ?? 0) * 100)}% do piso ${s.cadastrada}.`;
    default:
      return "Sem dados de compra na importação.";
  }
}

export function CategoriaTimelineCard({
  situacao: sit,
  mediaCliente,
  pisos,
  pisosAviso,
  acumulado,
  complemento,
  periodoLabel,
  className,
}: {
  situacao: SituacaoCategoria | null;
  mediaCliente: MediaCliente;
  pisos: PisosCategoria | null;
  /** Mensagem quando os pisos não estão configurados (ou são inválidos). */
  pisosAviso?: string | null;
  acumulado: { valor: number; meses: number; ano: number } | null;
  complemento: { label: string; projecao: number; piso: number } | null;
  periodoLabel?: string | null;
  className?: string;
}) {
  const media = mediaCliente.total;
  const cad = sit?.cadastrada ?? null;
  const fill = pisos ? posicaoNaRegua(media, pisos) : 0;
  const marcador = TIER_STYLE[sit?.enquadrada ?? cad ?? "Silver"];
  const estado = sit ? ESTADO_INFO[sit.estado] : null;
  const mostrarBlocos = !!(pisos && sit && sit.estado !== "sem_base" && sit.cadastrada);

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
                cad ? TIER_STYLE[cad].badgeClass : "border-border text-muted-foreground",
              )}
              title="Categoria cadastrada do cliente (não é alterada automaticamente)"
            >
              Categoria Atual: {cad ?? "não informada"}
            </span>
            {pisos && sit && sit.media != null && (
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold",
                  sit.enquadrada
                    ? TIER_STYLE[sit.enquadrada].badgeClass
                    : "border-border text-muted-foreground",
                )}
                title="Categoria em que a média mensal de compras se enquadra"
              >
                Pela média: {sit.enquadrada ?? "abaixo de Silver"}
              </span>
            )}
            {periodoLabel && (
              <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                {periodoLabel}
              </span>
            )}
          </div>
        </div>

        {!pisos ? (
          <div className="mt-4 flex flex-col items-start gap-2 rounded-lg border border-amber-300 bg-amber-500/10 p-3 text-xs">
            <p className="font-semibold text-amber-800 dark:text-amber-200">
              Pisos de categoria não configurados.
            </p>
            <p className="text-muted-foreground">
              {pisosAviso ??
                'Defina o piso de média mensal de Silver, Gold e Black em "Mínimos por categoria" (coluna "Piso da categoria").'}
            </p>
            <MinimosCategoriaButton />
            <p className="tabular-nums text-foreground">
              Média mensal de compras: <strong>{media != null ? fmtBRL(media) : "sem base"}</strong>
              <Est on={mediaCliente.estimado} />
            </p>
          </div>
        ) : (
          <div className="mt-4 px-2">
            {/* Marcos das categorias */}
            <div
              className="relative mb-2 grid grid-cols-3 text-center"
              style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
            >
              {CATEGORIAS.map((c, idx) => {
                const isCurrent = c === cad;
                const isNext = cad != null && idx === CATEGORIAS.indexOf(cad) + 1;
                const isAchieved = media != null && media >= pisos[c];
                return (
                  <div key={c} className="flex flex-col items-center">
                    <span
                      className={cn(
                        "text-[11px] font-bold tracking-tight",
                        isCurrent && "font-extrabold text-foreground",
                        !isCurrent && isAchieved && "text-primary",
                        !isCurrent && !isAchieved && "text-muted-foreground",
                      )}
                    >
                      {c}
                    </span>
                    <span className="text-[9px] font-semibold tabular-nums text-muted-foreground/80">
                      {fmtBRL(pisos[c])}/mês
                    </span>
                    {isCurrent && (
                      <span className="mt-0.5 rounded-full bg-primary/10 px-1.5 text-[8px] font-bold text-primary">
                        Atual
                      </span>
                    )}
                    {isNext && (
                      <span className="mt-0.5 rounded-full bg-amber-500/10 px-1.5 text-[8px] font-bold text-amber-600 dark:text-amber-400">
                        Próximo
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Trilho e barra — sem animação: o valor é calculado uma vez, da mesma fonte */}
            <div className="relative my-2 h-3 w-full rounded-full bg-muted/50 p-0.5">
              <div
                className="h-full rounded-full"
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
              <div
                className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-border"
                style={{ left: "33.3%" }}
                title={`Piso Silver: ${fmtBRL(pisos.Silver)}/mês`}
              />
              <div
                className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-border"
                style={{ left: "66.6%" }}
                title={`Piso Gold: ${fmtBRL(pisos.Gold)}/mês`}
              />
              <div
                className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-border"
                style={{ right: "0%" }}
                title={`Piso Black: ${fmtBRL(pisos.Black)}/mês`}
              />
              {fill > 0 && (
                <div
                  className="absolute top-1/2 -ml-2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-background shadow-md"
                  style={{
                    left: `${fill}%`,
                    backgroundColor: marcador.activeColor,
                    boxShadow: `0 0 10px ${marcador.glowColor}`,
                  }}
                  title={`Média mensal de compras: ${media != null ? fmtBRL(media) : "—"}`}
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px] text-muted-foreground">
              <span>R$ 0</span>
              <span className="text-center tabular-nums">
                <span className="font-semibold text-foreground">
                  Média mensal: {media != null ? fmtBRL(media) : "sem base"}
                </span>
                <Est on={mediaCliente.estimado} />
                {acumulado && (
                  <span className="ml-1">
                    · acumulado {acumulado.ano} ({acumulado.meses}{" "}
                    {acumulado.meses === 1 ? "mês" : "meses"}): {fmtBRL(acumulado.valor)}
                    <Est on />
                  </span>
                )}
              </span>
              <span>{fmtBRL(pisos.Black)}+</span>
            </div>
          </div>
        )}
      </div>

      {/* Três blocos */}
      {mostrarBlocos && sit && (
        <div
          className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
        >
          {/* Manter a categoria cadastrada */}
          <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border/70 bg-card/60 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="whitespace-nowrap text-[10px] font-semibold uppercase text-muted-foreground">
                Manter {sit.cadastrada}
              </span>
              {(sit.saldoManutencao ?? 0) >= 0 ? (
                <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded bg-emerald-500/15 px-1.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Mantida
                </span>
              ) : (
                <span className="whitespace-nowrap rounded bg-amber-500/15 px-1.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                  {Math.round((sit.pctPiso ?? 0) * 100)}%
                </span>
              )}
            </div>
            <div className="mt-1">
              <p
                className={cn(
                  "text-sm font-bold tabular-nums",
                  (sit.saldoManutencao ?? 0) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground",
                )}
              >
                {(sit.saldoManutencao ?? 0) >= 0
                  ? `+${fmtBRL(sit.saldoManutencao ?? 0)}/mês`
                  : `Faltam ${fmtBRL(-(sit.saldoManutencao ?? 0))}/mês`}
                <Est on={sit.estimado} />
              </p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {(sit.saldoManutencao ?? 0) >= 0 ? "Acima do piso de " : "Para o piso de "}
                {fmtBRL(sit.pisoCadastrada ?? 0)}/mês
              </p>
            </div>
          </div>

          {/* Evoluir */}
          <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border/70 bg-card/60 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="whitespace-nowrap text-[10px] font-semibold uppercase text-muted-foreground">
                {sit.proxima ? `Evoluir para ${sit.proxima}` : "Categoria máxima"}
              </span>
              {sit.proxima && (
                <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded bg-primary/10 px-1.5 text-[9px] font-bold text-primary">
                  <TrendingUp className="h-2.5 w-2.5" />
                  {sit.proxima}
                </span>
              )}
            </div>
            <div className="mt-1">
              {sit.proxima ? (
                sit.faltaProxima === 0 ? (
                  <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    Compatível com {sit.enquadrada}
                  </p>
                ) : (
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    Faltam {fmtBRL(sit.faltaProxima ?? 0)}/mês
                    <Est on={sit.estimado} />
                  </p>
                )
              ) : (
                <p className="text-sm font-bold text-primary">Elite Black</p>
              )}
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {sit.proxima
                  ? `Piso ${sit.proxima}: ${fmtBRL(sit.pisoProxima ?? 0)}/mês`
                  : "Cliente no patamar mais elevado"}
              </p>
            </div>
          </div>

          {/* Situação */}
          <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border/70 bg-card/60 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="whitespace-nowrap text-[10px] font-semibold uppercase text-muted-foreground">
                Situação
              </span>
              {estado && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 text-[9px] font-bold",
                    estado.cls,
                  )}
                >
                  <estado.icon className="h-2.5 w-2.5" />
                  {estado.titulo}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] font-medium leading-snug text-foreground">
              {descricaoSituacao(sit)}
            </p>
          </div>
        </div>
      )}

      {/* Rodapé: composição da média e complemento semestral */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-1 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
        <span
          className="cursor-help underline decoration-dotted"
          title={mediaCliente.portfolios
            .map(
              (p) =>
                `${METAS_FAMILY_LABEL[p.familia]}: ${
                  p.valor != null && p.fonte
                    ? `${fmtBRL(p.valor)} — ${FONTE_MEDIA_LABEL[p.fonte]}`
                    : "sem dado (fora da soma)"
                }`,
            )
            .join("\n")}
        >
          Média de {mediaCliente.portfolios.length - mediaCliente.semDado.length} de{" "}
          {mediaCliente.portfolios.length} portfólios
          {mediaCliente.semDado.length > 0 && " · sem dado não entra como zero"}
        </span>
        {complemento && (
          <span>
            Complemento · {complemento.label}: mantida a média, {fmtBRL(complemento.projecao)} vs
            piso {fmtBRL(complemento.piso)} (estimado)
          </span>
        )}
      </div>
    </div>
  );
}
