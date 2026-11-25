// Evolução e faixa de categoria (padrão visual original): barra por faixas alinhadas aos pisos
// mensais (Silver 3.000 · Gold 6.000 · Black 20.000), marcador na MÉDIA MENSAL de compras e três
// blocos — manter a categoria cadastrada, evoluir para a próxima e situação — pelo FECHAMENTO
// ANUAL (jan–dez). Recebe a apuração pronta (`situacaoCategoria`), a mesma do alerta.

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
  PISOS_CATEGORIA,
  faixasRegua,
  posicaoNaRegua,
  rotuloMesesDecorridos,
  type CategoriaNome,
  type EstadoCategoria,
  type MetaAnual,
  type SituacaoCategoria,
} from "@/lib/performance-categoria";
import { FONTE_MEDIA_LABEL, type MediaCliente } from "@/lib/performance-media-cliente";

const TIER_STYLE: Record<CategoriaNome, { badgeClass: string; color: string; glowColor: string }> =
  {
    Silver: {
      badgeClass:
        "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
      color: "#94a3b8",
      glowColor: "rgba(148, 163, 184, 0.45)",
    },
    Gold: {
      badgeClass:
        "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
      color: "#f59e0b",
      glowColor: "rgba(245, 158, 11, 0.45)",
    },
    Black: {
      badgeClass: "bg-purple-950/20 text-purple-900 dark:text-purple-200 border-purple-400/40",
      color: "#8b5cf6",
      glowColor: "rgba(139, 92, 246, 0.45)",
    },
  };
/** Faixa abaixo de Silver: preenchimento e marcador neutros. */
const NEUTRO = { color: "#cbd5e1", glowColor: "rgba(100, 116, 139, 0.35)" };

const ESTADO_INFO: Record<
  EstadoCategoria,
  { titulo: string; cls: string; icon: typeof ShieldCheck }
> = {
  garantida: {
    titulo: "Categoria garantida",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300",
    icon: ShieldCheck,
  },
  garantida_estimada: {
    titulo: "Piso anual atingido (estimado)",
    cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300",
    icon: ShieldCheck,
  },
  mantida_ritmo: {
    titulo: "Mantida pelo ritmo atual",
    cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-300",
    icon: CheckCircle2,
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
      title="Valor estimado: o acumulado do ano é a média mensal × meses decorridos"
    >
      estimado
    </span>
  );
}

function descricaoSituacao(s: SituacaoCategoria): string {
  const ate = s.mesesRestantes ? "até dezembro" : "no fechamento anual";
  switch (s.estado) {
    case "garantida":
      return `Compras do ano já superam o piso anual ${s.cadastrada}.`;
    case "garantida_estimada":
      return `Pela estimativa, o acumulado do ano já supera o piso anual ${s.cadastrada}. Confirmar com o fechamento real.`;
    case "mantida_ritmo":
      return s.manter
        ? `Média acima do piso mensal; faltam ${fmtBRL(s.manter.totalNecessario)} ${ate} para consolidar ${s.cadastrada}.`
        : `Média acima do piso mensal ${s.cadastrada}.`;
    case "risco_queda":
      return `Média abaixo do piso mensal ${s.cadastrada}; pela média, enquadra-se em ${s.enquadrada ?? "faixa abaixo de Silver"}.`;
    default:
      return "Sem dados de compra na importação.";
  }
}

function BlocoAnual({
  titulo,
  meta,
  estimado,
  rotuloRestantes,
  destaque,
}: {
  titulo: string;
  meta: MetaAnual;
  estimado: boolean;
  rotuloRestantes: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-between rounded-lg border bg-card/60 p-2.5",
        destaque ? "border-border" : "border-border/60",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase text-muted-foreground">
          {titulo}
        </span>
        {meta.atingido ? (
          <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded bg-emerald-500/15 px-1.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" /> {estimado ? "Atingido (est.)" : "Atingido"}
          </span>
        ) : (
          <span className="whitespace-nowrap rounded bg-muted px-1.5 text-[9px] font-bold text-muted-foreground">
            Piso anual {fmtBRL(meta.pisoAnual)}
          </span>
        )}
      </div>
      <div className="mt-1">
        <p
          className={cn(
            "text-sm font-bold tabular-nums",
            meta.atingido ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
          )}
        >
          {meta.atingido ? "R$ 0 até dezembro" : `Faltam ${fmtBRL(meta.totalNecessario)}`}
          <Est on={estimado} />
        </p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {meta.mediaNecessaria != null
            ? `${fmtBRL(meta.mediaNecessaria)}/mês em ${rotuloRestantes}`
            : "Fechamento anual (sem meses restantes)"}
        </p>
      </div>
    </div>
  );
}

export function CategoriaTimelineCard({
  situacao: sit,
  mediaCliente,
  periodoLabel,
  className,
}: {
  situacao: SituacaoCategoria;
  mediaCliente: MediaCliente;
  periodoLabel?: string | null;
  className?: string;
}) {
  const pisos = PISOS_CATEGORIA;
  const faixas = faixasRegua(pisos);
  const media = mediaCliente.total;
  const cad = sit.cadastrada;
  const fill = posicaoNaRegua(media, pisos);
  const marcador = sit.enquadrada ? TIER_STYLE[sit.enquadrada] : NEUTRO;
  const estado = ESTADO_INFO[sit.estado];
  const idxCad = cad ? CATEGORIAS.indexOf(cad) : -1;
  const mostrarBlocos = sit.estado !== "sem_base" && !!cad;

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
            {sit.media != null && (
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

        <div className="mt-4 px-2">
          {/* Nomes das categorias centralizados na própria faixa */}
          <div className="relative mb-1 h-9">
            {faixas.map((f) => {
              if (!f.categoria) return null;
              const idx = CATEGORIAS.indexOf(f.categoria);
              const isCurrent = f.categoria === cad;
              const isNext = idxCad >= 0 && idx === idxCad + 1;
              const isAchieved = media != null && media >= pisos[f.categoria];
              return (
                <div
                  key={f.categoria}
                  className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${(f.inicio + f.fim) / 2}%` }}
                >
                  <span
                    className={cn(
                      "text-[11px] font-bold tracking-tight",
                      isCurrent && "font-extrabold text-foreground",
                      !isCurrent && isAchieved && "text-foreground/80",
                      !isCurrent && !isAchieved && "text-muted-foreground",
                    )}
                  >
                    {f.categoria}
                  </span>
                  {isCurrent && (
                    <span className="mt-0.5 whitespace-nowrap rounded-full bg-primary/10 px-1.5 text-[8px] font-bold text-primary">
                      Atual
                    </span>
                  )}
                  {isNext && (
                    <span className="mt-0.5 whitespace-nowrap rounded-full bg-muted px-1.5 text-[8px] font-bold text-muted-foreground">
                      Próxima categoria
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Trilho neutro + preenchimento por faixa (só a cor das faixas alcançadas) */}
          <div className="relative my-1 h-3 w-full rounded-full bg-muted/60">
            {faixas.map((f) => {
              const largura = Math.max(0, Math.min(fill, f.fim) - f.inicio);
              if (largura <= 0) return null;
              return (
                <div
                  key={`fill-${f.categoria ?? "base"}`}
                  className={cn(
                    "absolute top-0 h-full",
                    f.inicio === 0 && "rounded-l-full",
                    fill >= 100 && f.fim === 100 && "rounded-r-full",
                  )}
                  style={{
                    left: `${f.inicio}%`,
                    width: `${largura}%`,
                    backgroundColor: f.categoria ? TIER_STYLE[f.categoria].color : NEUTRO.color,
                  }}
                />
              );
            })}
            {/* Marcos de entrada de cada categoria */}
            {faixas.slice(1).map((f) => (
              <div
                key={`tick-${f.categoria}`}
                className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/25"
                style={{ left: `${f.inicio}%` }}
                title={`Entrada ${f.categoria}: ${fmtBRL(f.de)}/mês`}
              />
            ))}
            {fill > 0 && (
              <div
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-md"
                style={{
                  left: `${Math.min(fill, 99)}%`,
                  backgroundColor: marcador.color,
                  boxShadow: `0 0 10px ${marcador.glowColor}`,
                }}
                title={`Média mensal de compras: ${fmtBRL(media)}`}
              />
            )}
          </div>

          {/* Valores de entrada sob cada marco */}
          <div className="relative h-4 text-[9px] font-semibold tabular-nums text-muted-foreground/80">
            <span className="absolute left-0">R$ 0</span>
            {faixas.slice(1).map((f) => (
              <span
                key={`val-${f.categoria}`}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${f.inicio}%` }}
              >
                {fmtBRL(f.de)}
              </span>
            ))}
          </div>

          <p className="pt-1 text-center text-[10px] tabular-nums text-muted-foreground">
            <span className="font-semibold text-foreground">
              Média mensal: {media != null ? fmtBRL(media) : "sem base"}
            </span>
            <Est on={mediaCliente.estimado} />
            {sit.acumulado != null && sit.ano != null && sit.mesRef != null && (
              <span className="ml-1">
                · acumulado {sit.ano} ({rotuloMesesDecorridos(sit.mesRef)}): {fmtBRL(sit.acumulado)}
                <Est on={sit.acumuladoEstimado} />
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Três blocos — fechamento anual */}
      {mostrarBlocos && (
        <div
          className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
        >
          {sit.manter ? (
            <BlocoAnual
              titulo={`Manter ${sit.cadastrada}`}
              meta={sit.manter}
              estimado={sit.acumuladoEstimado}
              rotuloRestantes={sit.rotuloRestantes}
              destaque
            />
          ) : (
            <div className="rounded-lg border border-border/70 bg-card/60 p-2.5 text-[10px] text-muted-foreground">
              Manter {sit.cadastrada}: sem mês de referência na base para o fechamento anual.
            </div>
          )}

          {sit.evoluir ? (
            <BlocoAnual
              titulo={`Conquistar ${sit.evoluir.categoria}`}
              meta={sit.evoluir}
              estimado={sit.acumuladoEstimado}
              rotuloRestantes={sit.rotuloRestantes}
            />
          ) : (
            <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border/60 bg-card/60 p-2.5">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Categoria máxima
              </span>
              <p className="mt-1 text-sm font-bold text-primary">Elite Black</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                Foco na manutenção da categoria
              </p>
            </div>
          )}

          <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border/70 bg-card/60 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="whitespace-nowrap text-[10px] font-semibold uppercase text-muted-foreground">
                Situação
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 text-[9px] font-bold",
                  estado.cls,
                )}
              >
                <estado.icon className="h-2.5 w-2.5" />
                {estado.titulo}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-medium leading-snug text-foreground">
              {descricaoSituacao(sit)}
            </p>
            {sit.oportunidadeEvolucao && sit.proxima && (
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                <TrendingUp className="h-3 w-3" /> Oportunidade de evolução para {sit.proxima}
              </p>
            )}
            {sit.estado === "risco_queda" && (
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-3 w-3" /> Faltam {fmtBRL(-(sit.saldoManutencao ?? 0))}
                /mês na média atual
              </p>
            )}
          </div>
        </div>
      )}

      {/* Rodapé: composição da média */}
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
        <span>Referência: fechamento anual jan–dez · piso anual = piso mensal × 12</span>
      </div>
    </div>
  );
}
