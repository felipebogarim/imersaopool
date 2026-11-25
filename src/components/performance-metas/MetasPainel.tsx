// Painel individual de metas do cliente.
// Três partes: dashboard fixo no topo → gráfico comparativo → painel do portfólio.
// Grava em performance_goal_* (sem tocar nas metas oficiais do BI). A sugestão IA é gerada
// no servidor (imersão → tendência → perfil → comparáveis) e registrada no banco.

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Layers, Link2, Loader2, Mail, Save, Unlock, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { FAROL_CELL_CLASS, statusFromRatio } from "@/lib/performance-farol";
import { sanitizeRatio } from "@/lib/performance-metrics";
import { type CanonicalFamily } from "@/lib/client-bi-familias";
import {
  BASE_FONTE_LABEL,
  META_ORIGEM_LABEL,
  METAS_FAMILIES,
  METAS_FAMILY_LABEL,
  applyAiSuggestion,
  buildComparativo,
  buildSavePayload,
  changedFamilies,
  mergeSaved,
  projectedTotalAttainment,
  realizadoBase,
  buildInitialDrafts,
  copyRepSuggestion,
  displayPercents,
  fmtBRL,
  fmtPct,
  fmtSignedBRL,
  metasVisibility,
  restoreDefault,
  setMetaOficial,
  summarizeDrafts,
  type FamilyMetaDraft,
  type MetaOrigem,
  type MetasViewerRole,
} from "@/lib/performance-metas";
import {
  baseFromBackend,
  competenciasDoCiclo,
  gestorRpcArgs,
  hydrateDrafts,
  type GoalsState,
  type GoalReview,
  type MetasLoadResult,
} from "@/lib/performance-metas-persistence";
import {
  generateMetasAiSuggestions,
  getMetasReview,
  reopenMetasReview,
  saveMetasGoals,
} from "@/lib/performance-metas.functions";
import { CompetenciaSelect, MetasCicloControl } from "./MetasCicloControl";
import { PortfolioMetaPanel } from "./PortfolioMetaPanel";
import { MetasInvestigacaoToggle } from "./MetasInvestigacaoToggle";
import { MetasSecaoTitulo } from "./MetasSecaoTitulo";
import { MetasHistoricoButton } from "./MetasHistoricoDialog";
import { useMetasMinimos } from "./use-metas-minimos";
import { abaixoDoMinimo, minimoPara } from "@/lib/performance-metas-minimos";
import { MetasComparativoChart } from "./MetasComparativoChart";
import { ConviteRepresentanteDialog } from "./ConviteRepresentanteDialog";
import { RevisarVinculoDialog } from "./RevisarVinculoDialog";
import { MetaAtualGaugeCard } from "./MetaAtualGaugeCard";
import { CategoriaTimelineCard } from "./CategoriaTimelineCard";
import { situacaoCategoria } from "@/lib/performance-categoria";
import { acumuladoNoAno, mediaMensalCompras } from "@/lib/performance-media-cliente";
import { AlertaSituacaoCard } from "./AlertaSituacaoCard";
import { MetasShareWhatsapp } from "./MetasShareWhatsapp";

const FAMILY_SWATCH = [
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
];

const STATUS_CLASS: Record<MetaOrigem | "misto", string> = {
  padrao: "bg-muted text-foreground",
  ia: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  representante: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  gestor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  misto: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export type MetasClienteInfo = {
  razaoSocial: string;
  categoria: string | null;
  repId: string | null;
  repName: string;
  periodoLabel: string | null;
  /** Início e fim do período do upload (YYYY-MM-DD): acumulado no ano e semestre (complemento). */
  periodoInicio?: string | null;
  periodoFim?: string | null;
  totalPct: number | null;
  familiaPct: Record<string, number | null>;
  uploadId?: string | null;
};

/** Competência "infinita": hidrata com a última versão gravada de cada portfólio. */
const ULTIMA_VERSAO = "9999-12-01";

export function MetasPainel({
  rowId,
  persisted,
  cliente,
  role,
  canPreview,
  previewRep,
  onPreviewChange,
}: {
  rowId: string;
  persisted: MetasLoadResult;
  cliente: MetasClienteInfo;
  role: MetasViewerRole;
  canPreview: boolean;
  previewRep: boolean;
  onPreviewChange: (v: boolean) => void;
}) {
  const vis = metasVisibility(role);
  const dbEnabled = persisted.available;
  const [goals, setGoals] = useState<GoalsState | null>(
    persisted.available ? persisted.state : null,
  );
  // Rascunho inicial = meta padrão da categoria; o que estiver gravado no banco prevalece,
  // inclusive a última sugestão IA registrada (o gestor decide se adere ou não).
  // Competência escolhida pelo gestor para as metas salvas (padrão: início do próximo semestre).
  const [competencia, setCompetencia] = useState(
    () =>
      competenciasDoCiclo(
        persisted.available ? persisted.state.cycle : null,
        persisted.available ? (persisted.state.proximo ?? null) : null,
      ).padrao,
  );
  // Assim que a meta é definida ela aparece na página: a meta exibida é a última versão gravada
  // (inclusive a programada para o próximo semestre); versões anteriores ficam no histórico.
  const [initialDrafts] = useState<FamilyMetaDraft[]>(() => {
    const base = buildInitialDrafts(cliente.categoria);
    return persisted.available ? hydrateDrafts(base, persisted.state, ULTIMA_VERSAO) : base;
  });
  const [drafts, setDrafts] = useState<FamilyMetaDraft[]>(initialDrafts);
  const [savedDrafts, setSavedDrafts] = useState<FamilyMetaDraft[]>(initialDrafts);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const [gerandoIa, setGerandoIa] = useState(false);
  const [selected, setSelected] = useState<CanonicalFamily>(METAS_FAMILIES[0]);
  const [vinculoOpen, setVinculoOpen] = useState(false);
  const [conviteOpen, setConviteOpen] = useState(false);
  const [review, setReview] = useState<GoalReview | null>(null);
  const [reopening, setReopening] = useState(false);
  const headerCardsRef = useRef<HTMLDivElement>(null);
  const alertaRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!vis.usarControlesGestao) return;
    void getMetasReview({ data: { rowId } })
      .then((result) => result.available && setReview(result.review))
      .catch(() => undefined);
  }, [rowId, vis.usarControlesGestao]);

  async function handleReopen() {
    setReopening(true);
    try {
      const result = await reopenMetasReview({ data: { rowId } });
      if (!result.available) throw new Error("Fluxo de revisão indisponível no banco.");
      setReview(result.review);
      toast.success("Edição reaberta para o representante.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reabrir a edição.");
    } finally {
      setReopening(false);
    }
  }

  const atingimento = useMemo(
    () =>
      Object.fromEntries(
        METAS_FAMILIES.map((f) => [f, sanitizeRatio(cliente.familiaPct[f])]),
      ) as Record<string, number | null>,
    [cliente.familiaPct],
  );
  // Valor vendido real (R$) do backend; sem ele o atingimento é marcado como estimado.
  const base = useMemo(() => baseFromBackend(goals?.base), [goals?.base]);
  const { data: minimosRes } = useMetasMinimos(dbEnabled && role === "gestor");
  const minimos = minimosRes?.available ? minimosRes.itens : null;
  // Média mensal de compras: FONTE ÚNICA (performance-media-cliente) para timeline, alerta e
  // gauge. Vem da base já carregada com a página; nenhuma consulta posterior a substitui.
  const mediaCliente = useMemo(() => mediaMensalCompras(goals?.base), [goals?.base]);
  // Classificação comercial (Silver/Gold/Black) — independe de "Metas Mínimas" e da meta do
  // gestor. Usa a categoria cadastrada do cliente, a mesma do cabeçalho.
  // Fechamento anual (jan–dez): acumulado do ano até o último mês consolidado da base.
  const acumuladoAno = useMemo(
    () => acumuladoNoAno(mediaCliente.total, cliente.periodoFim),
    [mediaCliente.total, cliente.periodoFim],
  );
  const situacaoCat = useMemo(
    () => situacaoCategoria(cliente.categoria, mediaCliente, acumuladoAno),
    [cliente.categoria, mediaCliente, acumuladoAno],
  );
  const summary = useMemo(() => summarizeDrafts(drafts), [drafts]);
  const percents = useMemo(() => displayPercents(summary.composicao), [summary.composicao]);
  const comparativo = useMemo(
    () => buildComparativo(drafts, atingimento, vis, base),
    [drafts, atingimento, vis, base],
  );
  const semReferencia = drafts.every((d) => d.referencia == null);
  const totalOficial = sanitizeRatio(cliente.totalPct);
  const totalProjetado = useMemo(
    () => projectedTotalAttainment(drafts, atingimento, base),
    [drafts, atingimento, base],
  );
  const totalStatus = statusFromRatio(totalProjetado.ratio);
  const unsaved = useMemo(
    () => changedFamilies(savedDrafts, drafts, role),
    [savedDrafts, drafts, role],
  );

  const [visao9mm, setVisao9mm] = useState(false);
  const podeVerVisao9mm = role === "gestor" && !previewRep && vis.verMetaPadrao;

  // Racional do cenário 9MM: proporção sobre o total mensal da empresa (~13.047.100)
  const COMPANY_META_BASE_MENSAL = 13_047_100;
  const RATIO_9MM = 9_000_000 / COMPANY_META_BASE_MENSAL;

  const baseMetaTotal = summary.total > 0 ? summary.total : (summary.referenciaTotal ?? 0);
  const displayedMeta =
    visao9mm && podeVerVisao9mm ? Math.round(baseMetaTotal * RATIO_9MM) : baseMetaTotal;

  // Base do gauge = a mesma média mensal (nunca derivada da meta do gestor).
  const totalRealizado = mediaCliente.total ?? 0;
  const displayedAtingimento =
    mediaCliente.total != null && displayedMeta > 0 ? mediaCliente.total / displayedMeta : null;

  // Aviso ao sair da página com alterações não salvas.
  useEffect(() => {
    if (unsaved.length === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved.length]);

  async function handleSave() {
    if (unsaved.length === 0) return;
    // Bloqueio: meta do gestor abaixo do mínimo da categoria (o banco confere de novo).
    if (role === "gestor" && !previewRep) {
      const abaixo = abaixoDoMinimo(
        drafts.filter((d) => unsaved.includes(d.familia)),
        minimos,
        cliente.categoria,
      );
      if (abaixo.length > 0) {
        setSelected(abaixo[0].familia as CanonicalFamily);
        toast.error("Meta abaixo do mínimo da categoria.", {
          description: abaixo
            .map(
              (a) =>
                `${METAS_FAMILY_LABEL[a.familia as CanonicalFamily]}: ${fmtBRL(a.meta)} < mínimo ${fmtBRL(a.minimo)}`,
            )
            .join(" · "),
        });
        return;
      }
    }
    const payload = buildSavePayload(drafts, role, unsaved);
    // A prévia "ver como representante" não grava nada.
    if (previewRep || payload.perfil !== "gestor") {
      setSavedDrafts((prev) => mergeSaved(prev, drafts, role));
      toast.info("Pré-visualização do representante: nada é gravado.");
      return;
    }
    const indisponivel = () =>
      toast.error("Não foi possível gravar.", {
        description: "Persistência das metas indisponível. Recarregue a página e tente novamente.",
      });
    if (!dbEnabled) return indisponivel();
    setSaving(true);
    try {
      const res = await saveMetasGoals({
        data: { rowId, ...gestorRpcArgs(payload), vigenteDesde: competencia },
      });
      if (!res.available) return indisponivel();
      // Mostra o que vale na competência salva (as demais mudanças seguem como agendadas).
      const hydrated = hydrateDrafts(drafts, res.state, competencia);
      setGoals(res.state);
      setDrafts((prev) => mergeSaved(prev, hydrated, role));
      setSavedDrafts((prev) => mergeSaved(prev, hydrated, role));
      // BI Metas: a "meta atual" reflete a edição na próxima visualização.
      void queryClient.invalidateQueries({ queryKey: ["performance-metas", "bi"] });
      void queryClient.invalidateQueries({ queryKey: ["performance-metas", "historico"] });
      toast.success(`${unsaved.length} portfólio(s) salvo(s).`, {
        description: `Valendo a partir de ${competencia.slice(5, 7)}/${competencia.slice(0, 4)}.`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  /** Gera ou atualiza a sugestão da IA dos 7 portfólios; não altera a meta oficial. */
  async function handleGerarIa(force = false, silent = false) {
    if (!dbEnabled || gerandoIa) return;
    setGerandoIa(true);
    try {
      const res = await generateMetasAiSuggestions({ data: { rowId, force } });
      if (!res.available) throw new Error("Persistência das metas indisponível.");
      setGoals(res.state);
      const ia = new Map(hydrateDrafts(drafts, res.state).map((d) => [d.familia, d.sugestaoIa]));
      setDrafts((prev) => prev.map((d) => ({ ...d, sugestaoIa: ia.get(d.familia) ?? null })));

      if (silent) return;
      if ("hasNewInputs" in res && res.hasNewInputs === false) {
        toast.info("Nenhum novo input identificado no sistema.", {
          description:
            "Não houve novas visitas, imersões ou sugestões que justifiquem reavaliar. As sugestões vigentes foram mantidas.",
          action: {
            label: "Reavaliar mesmo assim",
            onClick: () => void handleGerarIa(true),
          },
        });
      } else {
        const isUpdate = Boolean(temIa);
        toast.success(
          isUpdate
            ? "Sugestão IA atualizada com novos inputs!"
            : "Análise da IA registrada para as 7 famílias.",
          {
            description: "A meta oficial não foi alterada. Use “Aceitar sugestão IA” por família.",
          },
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a sugestão IA.");
    } finally {
      setGerandoIa(false);
    }
  }
  const temIa = drafts.some((d) => d.sugestaoIa);

  // Sugestão IA por padrão: sem sugestão registrada, gera automaticamente ao abrir o cliente
  // (uma vez por abertura). Não altera a meta oficial; o gestor aceita ou não por família.
  const autoIaRef = useRef(false);
  useEffect(() => {
    if (autoIaRef.current || !dbEnabled || !vis.verSugestaoIa) return;
    autoIaRef.current = true;
    if (!initialDrafts.some((d) => d.sugestaoIa)) void handleGerarIa(false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (familia: CanonicalFamily, p: Partial<FamilyMetaDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.familia === familia ? { ...d, ...p } : d)));

  return (
    <div className="space-y-5">
      {review?.status === "reabertura_solicitada" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">O representante solicitou reabertura da edição</p>
            <p className="text-xs opacity-80">
              {review.reopen_request_note || "Nenhuma justificativa informada."}
            </p>
          </div>
          <Button size="sm" onClick={() => void handleReopen()} disabled={reopening}>
            {reopening ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Unlock className="mr-1.5 h-4 w-4" />
            )}
            Reabrir edição
          </Button>
        </div>
      )}
      {/* ================= 1. Dashboard fixo ================= */}
      <div className="sticky top-0 z-30 -mx-3 space-y-3 border-b border-border bg-background/95 px-3 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {/* Resumo discreto; o botão Salvar fica no rodapé do bloco de edição. */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs",
              unsaved.length > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                unsaved.length > 0 ? "bg-amber-500" : "bg-emerald-500",
              )}
            />
            {saving
              ? "Salvando…"
              : unsaved.length > 0
                ? `${unsaved.length} portfólio(s) com alterações não salvas`
                : "Tudo salvo"}
          </span>
          {vis.usarControlesGestao && (
            <>
              {temIa && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDrafts((d) => applyAiSuggestion(d))}
                  title="Usa a sugestão da IA como meta oficial em todos os portfólios"
                >
                  <Wand2 className="mr-1.5 h-4 w-4" /> Aplicar IA
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setConviteOpen(true)}>
                <Mail className="mr-1.5 h-4 w-4" /> Convidar representante
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setVinculoOpen(true)}
              >
                <Link2 className="mr-1.5 h-4 w-4" /> Revisar vínculo
              </Button>
              <MetasShareWhatsapp
                clienteNome={cliente.razaoSocial}
                periodoReferencia={cliente.periodoLabel ?? "nov/26"}
                categoria={cliente.categoria}
                repName={cliente.repName}
                blocks={[headerCardsRef, alertaRef, chartRef]}
              />
            </>
          )}
          <div className="ml-auto flex items-center gap-3">
            <MetasCicloControl
              rowId={rowId}
              cycle={goals?.cycle ?? null}
              proximo={goals?.proximo ?? null}
              enabled={dbEnabled}
              canManage={vis.usarControlesGestao}
              onChange={setGoals}
            />
            {canPreview && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={previewRep} onCheckedChange={onPreviewChange} />
                Ver como representante
              </label>
            )}
          </div>
        </div>

        <MetasSecaoTitulo
          numero={1}
          icon={Gauge}
          titulo="Visão geral do cliente"
          descricao="Meta geral e categoria: soma de todos os portfólios"
        />

        {/* Cabeçalho: Dash de Resultado Geral + Timeline de Categoria */}
        <div ref={headerCardsRef} className="grid gap-3 grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* 1. Dash de resultado geral: Gauge Meta Atual com visão 9MM proporcional */}
          <div className="lg:col-span-4 flex flex-col h-full">
            <MetaAtualGaugeCard
              metaAtual={displayedMeta}
              realizado={totalRealizado}
              metaComBase={displayedMeta}
              atingimento={displayedAtingimento}
              periodo={cliente.periodoLabel ?? "nov/26"}
              hint="Meta individual do cliente; proporcional ao cenário de 9MM quando ativado"
              visao9mm={visao9mm}
              onToggleVisao9mm={podeVerVisao9mm ? setVisao9mm : undefined}
              showVisao9mm={podeVerVisao9mm}
            />
          </div>

          {/* 2. Timeline de Categoria: Faixa preenchida, caminho até a próxima categoria, manutenção e upgrade */}
          <div className="lg:col-span-8 flex flex-col h-full">
            <CategoriaTimelineCard
              situacao={situacaoCat}
              mediaCliente={mediaCliente}
              periodoLabel={cliente.periodoLabel}
            />
          </div>
        </div>

        {/* 3. Destaque separado: Alerta de Situação (degrade, upgrade, consolidação) */}
        <div ref={alertaRef}>
          <AlertaSituacaoCard situacao={situacaoCat} periodoLabel={cliente.periodoLabel} />
        </div>
      </div>

      {semReferencia && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Categoria “{cliente.categoria ?? "—"}” sem referência padrão. Defina as metas manualmente.
        </div>
      )}

      {/* ================= 2. Gráfico principal ================= */}
      <MetasSecaoTitulo
        numero={2}
        icon={Layers}
        tom="violet"
        titulo="Detalhe por portfólio"
        descricao="Atingimento e meta de cada portfólio: clique em um portfólio para editar"
        className="pt-4"
      />
      <div ref={chartRef}>
        <MetasComparativoChart
          data={comparativo}
          vis={vis}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      {/* ================= 3. Painel do portfólio selecionado ================= */}
      {(() => {
        const idx = drafts.findIndex((d) => d.familia === selected);
        const d = drafts[idx];
        const fam = d.familia;
        return (
          <PortfolioMetaPanel
            draft={d}
            point={comparativo[idx]}
            // Só mudanças POSTERIORES à competência selecionada: as que já valem nela estão no campo.
            agendadas={(goals?.agendadas ?? []).filter(
              (a) => a.familia === fam && a.vigente_desde.slice(0, 10) > competencia,
            )}
            unsaved={unsaved}
            minimo={minimoPara(minimos, cliente.categoria, fam)}
            categoria={cliente.categoria}
            investigacao={
              dbEnabled && vis.editarMetaOficial ? (
                <MetasInvestigacaoToggle rowId={rowId} />
              ) : undefined
            }
            gerandoIa={gerandoIa}
            iaDisponivel={dbEnabled}
            saveBar={
              <>
                {dbEnabled && vis.editarMetaOficial && (
                  <CompetenciaSelect
                    cycle={goals?.cycle ?? null}
                    proximo={goals?.proximo ?? null}
                    value={competencia}
                    onChange={setCompetencia}
                  />
                )}
                <Button
                  size="sm"
                  className="h-7 px-3 text-[11px]"
                  onClick={handleSave}
                  disabled={saving || unsaved.length === 0}
                >
                  <Save className="mr-1 h-3 w-3" />
                  {unsaved.length > 0 ? `Salvar (${unsaved.length})` : "Salvo"}
                </Button>
              </>
            }
            vis={vis}
            selected={selected}
            onSelect={setSelected}
            swatches={FAMILY_SWATCH}
            actions={{
              setMetaOficial: (v) => setDrafts((prev) => setMetaOficial(prev, fam, v)),
              setComentarioGestor: (t) => patch(fam, { comentarioGestor: t }),
              setSugestaoRep: (v) => patch(fam, { sugestaoRep: v }),
              setJustificativaRep: (t) => patch(fam, { justificativaRep: t }),
              gerarIa: () => void handleGerarIa(false),
              usarIa: () => setDrafts((prev) => applyAiSuggestion(prev, fam)),
              restaurarPadrao: () => setDrafts((prev) => restoreDefault(prev, fam)),
              copiarRep: () => setDrafts((prev) => copyRepSuggestion(prev, fam)),
              aplicarMinimo:
                role === "gestor"
                  ? () => {
                      const min = minimoPara(minimos, cliente.categoria, fam);
                      if (min != null) setDrafts((prev) => setMetaOficial(prev, fam, min));
                    }
                  : undefined,
            }}
          />
        );
      })()}

      {dbEnabled && role === "gestor" && (
        <MetasHistoricoButton repId={cliente.repId} razaoSocial={cliente.razaoSocial} />
      )}

      <RevisarVinculoDialog
        open={vinculoOpen}
        onOpenChange={setVinculoOpen}
        razaoSocial={cliente.razaoSocial}
        categoria={cliente.categoria}
        repId={cliente.repId}
        repName={cliente.repName}
        rowId={rowId}
        enabled={dbEnabled}
        confirmedClientId={goals?.cycle?.client_id ?? null}
        onConfirmed={setGoals}
      />
      <ConviteRepresentanteDialog
        open={conviteOpen}
        onOpenChange={setConviteOpen}
        rowId={rowId}
        enabled={dbEnabled}
        repName={cliente.repName}
        clienteNome={cliente.razaoSocial}
      />
    </div>
  );
}
