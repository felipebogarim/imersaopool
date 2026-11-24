// Portal do representante → metas de um cliente da própria carteira.
// Mostra meta oficial, atingimento (com a origem quando não é venda realizada) e a sugestão
// do representante; nunca meta padrão, comentário do gestor ou sugestões da IA.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Lightbulb,
  Loader2,
  PencilLine,
  Search,
  Send,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FAROL_CELL_CLASS, statusFromRatio } from "@/lib/performance-farol";
import type { CanonicalFamily } from "@/lib/client-bi-familias";
import {
  BASE_FONTE_LABEL,
  METAS_FAMILIES,
  METAS_FAMILY_LABEL,
  fmtBRL,
  fmtPct,
  parseMetaInput,
} from "@/lib/performance-metas";
import { cycleInfo, type RepGoalsView } from "@/lib/performance-metas-persistence";
import {
  repGetMetasGoals,
  repListMetas,
  repRequestMetasReopen,
  repSaveMetasSuggestions,
} from "@/lib/performance-metas.functions";
import type { GoalReviewStatus } from "@/lib/performance-metas-persistence";
import { RepMetasPerformanceChart, RepSuggestionHistory } from "./RepMetasClientVisuals";

type Sugestao = { valor: number | null; justificativa: string };
type Sugestoes = Record<CanonicalFamily, Sugestao>;

const fromView = (v: RepGoalsView | null): Sugestoes =>
  Object.fromEntries(
    METAS_FAMILIES.map((f) => {
      const s = v?.rep_suggestions.find((x) => x.familia === f);
      return [f, { valor: s?.valor ?? null, justificativa: s?.justificativa ?? "" }];
    }),
  ) as Sugestoes;

export function RepMetasCliente({ rowId }: { rowId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(repGetMetasGoals);
  const saveFn = useServerFn(repSaveMetasSuggestions);
  const reopenFn = useServerFn(repRequestMetasReopen);
  const { data, isLoading, error } = useQuery({
    queryKey: ["rep-metas", rowId],
    queryFn: () => getFn({ data: { rowId } }),
  });
  const view = data?.available ? data.view : null;
  const [salvo, setSalvo] = useState<Sugestoes>(() => fromView(null));
  const [edit, setEdit] = useState<Sugestoes>(() => fromView(null));
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [reopenNote, setReopenNote] = useState("");
  const [selected, setSelected] = useState<CanonicalFamily>(METAS_FAMILIES[0]);

  useEffect(() => {
    if (!view) return;
    setSalvo(fromView(view));
    setEdit(fromView(view));
  }, [view]);

  const alterados = useMemo(
    () =>
      METAS_FAMILIES.filter(
        (f) => edit[f].valor !== salvo[f].valor || edit[f].justificativa !== salvo[f].justificativa,
      ),
    [edit, salvo],
  );

  async function salvar() {
    setSaving(true);
    try {
      const res = await saveFn({
        data: {
          rowId,
          sugestoes: alterados.map((f) => ({
            familia: f,
            valor: edit[f].valor,
            justificativa: edit[f].justificativa,
          })),
        },
      });
      if (!res.available) throw new Error("Persistência das metas indisponível.");
      qc.setQueryData(["rep-metas", rowId], {
        available: true,
        view: { ...res.view, cliente: view?.cliente },
      });
      void qc.invalidateQueries({ queryKey: ["rep-metas-lista"] });
      void qc.invalidateQueries({ queryKey: ["rep-metas-bi"] });
      toast.success("Sugestões enviadas ao gestor.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function solicitarReabertura() {
    setRequesting(true);
    try {
      await reopenFn({ data: { rowId, justificativa: reopenNote } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["rep-metas", rowId] }),
        qc.invalidateQueries({ queryKey: ["rep-metas-lista"] }),
      ]);
      setShowReopen(false);
      setReopenNote("");
      toast.success("Pedido enviado ao gestor.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível solicitar a reabertura.");
    } finally {
      setRequesting(false);
    }
  }

  const ciclo = view?.cycle ? cycleInfo(view.cycle) : null;
  const canEdit = view?.review.status === "pendente" || view?.review.status === "reaberto";

  return (
    <div className="space-y-4">
      <Link
        to="/portal-rep"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao portal
      </Link>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {error instanceof Error ? error.message : "Não foi possível carregar as metas."}
        </p>
      )}
      {data && !data.available && (
        <p className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
          As metas deste cliente ainda não estão disponíveis.
        </p>
      )}

      {view && (
        <>
          <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-semibold">{view.cliente || "Cliente"}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <PeriodCard
                  label="Período de performance avaliado"
                  value={performancePeriodLabel(view.performance_period)}
                  detail="Período usado no cálculo dos resultados e atingimentos"
                />
                <PeriodCard
                  label="Vigência das metas"
                  value={
                    ciclo ? `${ciclo.label} · ${ciclo.meses} meses` : "Ciclo ainda não iniciado"
                  }
                  detail="Período em que estas metas mensais estarão vigentes"
                />
              </div>
            </div>

            {/* Guia Rápido */}
            <div className="border-b bg-blue-50/70 dark:bg-blue-950/30 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400 shadow-xs">
                  <Lightbulb className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Guia Rápido · Como preencher suas sugestões de metas
                    </h3>
                    <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                      Passo a passo
                    </span>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-3 text-xs text-muted-foreground pt-0.5">
                    <div className="flex items-start gap-1.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-200/70 dark:bg-blue-800 text-[10px] font-bold text-blue-800 dark:text-blue-200">1</span>
                      <span>Mude de portfólio clicando nos <strong>botões em destaque</strong> ou no gráfico.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-200/70 dark:bg-blue-800 text-[10px] font-bold text-blue-800 dark:text-blue-200">2</span>
                      <span>Alimente a <strong>meta mensal (R$)</strong> e sua <strong>justificativa</strong> em cada item.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-200/70 dark:bg-blue-800 text-[10px] font-bold text-blue-800 dark:text-blue-200">3</span>
                      <span>Ao concluir, clique em <strong>Enviar sugestões</strong> para avaliação da gestão.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b p-4 sm:p-5">
              <RepMetasPerformanceChart view={view} selected={selected} onSelect={setSelected} />
            </div>

            {/* Abas com cada item dos portfólios com alto destaque e contraste */}
            <div className="border-b bg-muted/30 p-3 sm:px-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Portfólios · Clique para selecionar e editar
                </p>
                <span className="text-[11px] font-medium text-foreground">
                  Ativo: <strong className="text-primary">{METAS_FAMILY_LABEL[selected]}</strong>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {METAS_FAMILIES.map((family, index) => {
                  const isSelected = selected === family;
                  const isAltered = alterados.includes(family);
                  const hasDraft = edit[family].valor != null && edit[family].valor! > 0;
                  return (
                    <button
                      key={family}
                      type="button"
                      onClick={() => setSelected(family)}
                      className={cn(
                        "group relative flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-xs transition-all cursor-pointer select-none",
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-md ring-2 ring-primary/40 border-transparent"
                          : "bg-card text-foreground/85 hover:text-foreground hover:bg-muted/80 border-2 border-border shadow-xs font-semibold hover:border-foreground/30",
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 shrink-0 rounded-full",
                            FAMILY_SWATCH[index],
                            isSelected ? "ring-2 ring-primary-foreground" : "ring-1 ring-border",
                          )}
                        />
                        <span className="truncate">{METAS_FAMILY_LABEL[family]}</span>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 ml-1">
                        {isAltered && (
                          <span
                            className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-background"
                            title="Sugestão alterada e não enviada"
                          />
                        )}
                        {!isAltered && hasDraft && (
                          <CheckCircle2
                            className={cn(
                              "h-3.5 w-3.5",
                              isSelected ? "text-primary-foreground" : "text-emerald-500",
                            )}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              {[selected].map((f) => {
                const item = view.items.find((i) => i.familia === f);
                const at = view.atingimento[f];
                const status = statusFromRatio(at?.ratio ?? null);
                return (
                  <div key={f} className="grid gap-4 px-5 py-5 sm:grid-cols-[1fr_1.4fr]">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{METAS_FAMILY_LABEL[f]}</p>
                      <p className="text-xs text-muted-foreground">
                        Meta oficial:{" "}
                        <span className="font-medium text-foreground tabular-nums">
                          {fmtBRL(item?.meta_mensal ?? null)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Atingimento:{" "}
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-medium tabular-nums",
                            status && FAROL_CELL_CLASS[status],
                          )}
                        >
                          {fmtPct(at?.ratio ?? null)}
                        </span>
                        {at && at.fonte !== "realizado" && (
                          <span className="ml-1">· {BASE_FONTE_LABEL[at.fonte].toLowerCase()}</span>
                        )}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={50}
                          placeholder="Sua sugestão de meta mensal"
                          value={edit[f].valor ?? ""}
                          onChange={(e) =>
                            setEdit((p) => ({
                              ...p,
                              [f]: { ...p[f], valor: parseMetaInput(e.target.value) },
                            }))
                          }
                          className="pl-9 tabular-nums"
                          disabled={!canEdit}
                        />
                      </div>
                      <Textarea
                        placeholder="Justificativa"
                        value={edit[f].justificativa}
                        maxLength={4000}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            [f]: { ...p[f], justificativa: e.target.value },
                          }))
                        }
                        className="min-h-[60px] text-sm"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t px-5 py-3">
              <span className="text-xs text-muted-foreground">
                {!canEdit
                  ? view.review.status === "reabertura_solicitada"
                    ? "Pedido de reabertura aguardando o gestor"
                    : view.review.status === "respondido"
                      ? "Sugestões enviadas e edição encerrada"
                      : "Aguardando convite do gestor"
                  : alterados.length > 0
                    ? `${alterados.length} portfólio(s) alterado(s)`
                    : "Sugestões em dia"}
              </span>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={() => void salvar()}
                  disabled={saving || !alterados.length}
                >
                  {saving ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-4 w-4" />
                  )}
                  Enviar sugestões
                </Button>
              )}
              {view.review.status === "respondido" && (
                <Button size="sm" variant="outline" onClick={() => setShowReopen((v) => !v)}>
                  <PencilLine className="mr-1.5 h-4 w-4" /> Solicitar reabertura
                </Button>
              )}
            </div>
            {showReopen && view.review.status === "respondido" && (
              <div className="space-y-2 border-t bg-muted/30 px-5 py-4">
                <label className="text-sm font-medium">
                  Por que você precisa alterar a sugestão?
                </label>
                <Textarea
                  value={reopenNote}
                  onChange={(e) => setReopenNote(e.target.value)}
                  maxLength={1000}
                  placeholder="Explique brevemente ao gestor o que precisa ser revisado."
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowReopen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void solicitarReabertura()}
                    disabled={requesting || reopenNote.trim().length < 3}
                  >
                    {requesting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    Enviar pedido
                  </Button>
                </div>
              </div>
            )}
          </div>
          <RepSuggestionHistory history={view.suggestion_history ?? []} />
        </>
      )}
    </div>
  );
}

const FAMILY_SWATCH = [
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
];

function PeriodCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border bg-muted/25 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function performancePeriodLabel(period: RepGoalsView["performance_period"]): string {
  if (!period) return "Período não informado";
  const range = [formatShortDate(period.inicio), formatShortDate(period.fim)].filter(Boolean);
  if (period.label && range.length === 2) return `${period.label} · ${range.join(" a ")}`;
  return period.label || (range.length === 2 ? range.join(" a ") : "Período não informado");
}

function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : null;
}

const STATUS_LABEL: Record<GoalReviewStatus, string> = {
  nao_convidado: "Sem convite",
  pendente: "Aguardando sua revisão",
  respondido: "Sugestão enviada",
  reabertura_solicitada: "Reabertura solicitada",
  reaberto: "Edição reaberta",
};

type Filter = "todos" | "pendentes" | "respondidos" | "top10";

/** Painel de metas de toda a carteira do representante. */
export function RepMetasLista() {
  const listFn = useServerFn(repListMetas);
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["rep-metas-lista"],
    queryFn: () => listFn(),
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    const filtered = data.filter((r) => {
      if (q && !r.cliente.toLocaleLowerCase("pt-BR").includes(q)) return false;
      if (filter === "top10") return r.top10Rank != null;
      if (filter === "pendentes")
        return r.reviewStatus === "pendente" || r.reviewStatus === "reaberto";
      if (filter === "respondidos")
        return r.reviewStatus === "respondido" || r.reviewStatus === "reabertura_solicitada";
      return true;
    });
    return filter === "top10"
      ? [...filtered].sort((a, b) => (a.top10Rank ?? 99) - (b.top10Rank ?? 99))
      : filtered;
  }, [data, filter, search]);
  const pendentes = data.filter(
    (r) => r.reviewStatus === "pendente" || r.reviewStatus === "reaberto",
  ).length;
  const respondidos = data.filter(
    (r) => r.reviewStatus === "respondido" || r.reviewStatus === "reabertura_solicitada",
  ).length;
  const comMetas = data.filter((r) => r.hasGoals).length;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Target className="h-5 w-5 text-primary" /> Gestão de metas da carteira
        </h2>
        <p className="text-sm text-muted-foreground">
          Consulte todos os clientes, acompanhe convites e registre suas sugestões de meta.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Users} label="Clientes na carteira" value={data.length} />
        <Kpi icon={Target} label="Com metas definidas" value={comMetas} />
        <Kpi icon={Clock3} label="Convites pendentes" value={pendentes} highlight />
        <Kpi icon={CheckCircle2} label="Sugestões enviadas" value={respondidos} />
      </div>

      <div className="rounded-xl border bg-background shadow-sm">
        <div className="space-y-3 border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar cliente..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["todos", "Todos"],
                ["pendentes", `Pendentes (${pendentes})`],
                ["respondidos", `Enviados (${respondidos})`],
                ["top10", "Top 10 faturamento"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? "default" : "outline"}
                onClick={() => setFilter(key)}
              >
                {key === "top10" && <Trophy className="mr-1.5 h-3.5 w-3.5" />}
                {label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando carteira…</p>
        ) : error ? (
          <p className="p-6 text-sm text-destructive">Não foi possível carregar os clientes.</p>
        ) : !visible.length ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nenhum cliente encontrado para este filtro.
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map((r) => (
              <li key={r.rowId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                {r.top10Rank != null && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                    {r.top10Rank}º
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.cliente}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.categoria, r.periodo, STATUS_LABEL[r.reviewStatus]]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {r.hasGoals ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/portal-rep/metas/$rowId" params={{ rowId: r.rowId }}>
                      Analisar metas
                    </Link>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Metas não configuradas</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof Target;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border bg-background p-3", highlight && "border-primary/50")}>
      <Icon className={cn("mb-2 h-4 w-4 text-muted-foreground", highlight && "text-primary")} />
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
