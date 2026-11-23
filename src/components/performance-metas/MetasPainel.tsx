// Painel individual de metas do cliente (simulação local).
// Três partes: dashboard fixo no topo → gráfico comparativo → cards de edição.
// Nenhum valor é persistido; recarregar a página descarta a simulação.

import { useMemo, useState } from "react";
import { FlaskConical, Link2, Mail, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { FAROL_CELL_CLASS, statusFromRatio } from "@/lib/performance-farol";
import { sanitizeRatio } from "@/lib/performance-metrics";
import { type CanonicalFamily } from "@/lib/client-bi-familias";
import {
  META_ORIGEM_LABEL,
  METAS_FAMILIES,
  METAS_FAMILY_LABEL,
  applyAiSuggestion,
  buildComparativo,
  buildInitialDrafts,
  copyRepSuggestion,
  displayPercents,
  fmtBRL,
  fmtPct,
  fmtSignedBRL,
  metasVisibility,
  restoreDefault,
  setMetaOficial,
  simulateAiSuggestions,
  summarizeDrafts,
  type FamilyMetaDraft,
  type MetaOrigem,
  type MetasViewerRole,
} from "@/lib/performance-metas";
import { PortfolioMetaPanel } from "./PortfolioMetaPanel";
import { MetasComparativoChart } from "./MetasComparativoChart";
import { ConviteRepresentanteDialog } from "./ConviteRepresentanteDialog";
import { RevisarVinculoDialog } from "./RevisarVinculoDialog";

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
  totalPct: number | null;
  familiaPct: Record<string, number | null>;
};

export function MetasPainel({
  cliente,
  role,
  canPreview,
  previewRep,
  onPreviewChange,
}: {
  cliente: MetasClienteInfo;
  role: MetasViewerRole;
  canPreview: boolean;
  previewRep: boolean;
  onPreviewChange: (v: boolean) => void;
}) {
  const vis = metasVisibility(role);
  // Sugestões IA já vêm preenchidas (simulação) para o painel não começar vazio.
  const [drafts, setDrafts] = useState<FamilyMetaDraft[]>(() =>
    simulateAiSuggestions(buildInitialDrafts(cliente.categoria)),
  );
  const [selected, setSelected] = useState<CanonicalFamily>(METAS_FAMILIES[0]);
  const [vinculoOpen, setVinculoOpen] = useState(false);
  const [conviteOpen, setConviteOpen] = useState(false);

  const atingimento = useMemo(
    () =>
      Object.fromEntries(
        METAS_FAMILIES.map((f) => [f, sanitizeRatio(cliente.familiaPct[f])]),
      ) as Record<string, number | null>,
    [cliente.familiaPct],
  );
  const summary = useMemo(() => summarizeDrafts(drafts), [drafts]);
  const percents = useMemo(() => displayPercents(summary.composicao), [summary.composicao]);
  const comparativo = useMemo(
    () => buildComparativo(drafts, atingimento, vis),
    [drafts, atingimento, vis],
  );
  const semReferencia = drafts.every((d) => d.referencia == null);
  const totalRatio = sanitizeRatio(cliente.totalPct);
  const totalStatus = statusFromRatio(totalRatio);

  const patch = (familia: CanonicalFamily, p: Partial<FamilyMetaDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.familia === familia ? { ...d, ...p } : d)));

  return (
    <div className="space-y-5">
      {/* ================= 1. Dashboard fixo ================= */}
      <div className="sticky top-0 z-30 -mx-3 space-y-3 border-b border-border bg-background/95 px-3 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {vis.usarControlesGestao && (
            <>
              <Button
                size="sm"
                onClick={() => setDrafts((d) => applyAiSuggestion(simulateAiSuggestions(d)))}
                title="Aplica a sugestão IA (simulada) como meta oficial em todos os portfólios"
              >
                <Sparkles className="mr-1.5 h-4 w-4" /> Sugestão IA
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDrafts((d) => restoreDefault(d))}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" /> Restaurar padrão
              </Button>
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
            </>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 sm:flex">
              <FlaskConical className="h-3.5 w-3.5" /> Simulação local · nada é salvo
            </span>
            {canPreview && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={previewRep} onCheckedChange={onPreviewChange} />
                Ver como representante
              </label>
            )}
          </div>
        </div>

        <div
          className={cn(
            "grid gap-2 sm:grid-cols-2",
            vis.verMetaPadrao ? "lg:grid-cols-5" : "lg:grid-cols-3",
          )}
        >
          <Tile label="Meta mensal personalizada">
            <p className="text-2xl font-semibold tabular-nums">{fmtBRL(summary.total)}</p>
            <p className="text-[10px] text-muted-foreground">Soma dos 7 portfólios</p>
          </Tile>

          {vis.verMetaPadrao && (
            <Tile label="Meta padrão" muted>
              <p className="text-base font-medium tabular-nums text-muted-foreground">
                {fmtBRL(summary.referenciaTotal)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Categoria {cliente.categoria ?? "—"}
              </p>
            </Tile>
          )}

          {vis.verMetaPadrao && (
            <Tile label="Diferença">
              <p
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  (summary.diferencaAbs ?? 0) > 0 && "text-emerald-600 dark:text-emerald-400",
                  (summary.diferencaAbs ?? 0) < 0 && "text-red-600 dark:text-red-400",
                )}
              >
                {fmtSignedBRL(summary.diferencaAbs)}
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {summary.diferencaPct == null
                  ? "Sem referência"
                  : `${summary.diferencaPct > 0 ? "+" : ""}${fmtPct(summary.diferencaPct)} vs. padrão`}
              </p>
            </Tile>
          )}

          <Tile label="Distribuição entre portfólios">
            {percents ? (
              <>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  {METAS_FAMILIES.map((f, i) => (
                    <div
                      key={f}
                      className={FAMILY_SWATCH[i]}
                      style={{ width: `${percents[f] ?? 0}%` }}
                      title={`${METAS_FAMILY_LABEL[f]}: ${String(percents[f]).replace(".", ",")}%`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  100% distribuído · {summary.portfoliosComMeta}/7 com meta
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem meta positiva</p>
            )}
          </Tile>

          {vis.verMetaPadrao ? (
            <Tile label="Status da simulação">
              <span
                className={cn(
                  "inline-flex rounded-md px-2 py-0.5 text-sm font-semibold",
                  STATUS_CLASS[summary.status.origem],
                )}
              >
                {summary.status.origem === "misto"
                  ? "Misto"
                  : META_ORIGEM_LABEL[summary.status.origem]}
              </span>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {(Object.keys(summary.status.contagem) as MetaOrigem[])
                  .filter((k) => summary.status.contagem[k] > 0)
                  .map((k) => `${META_ORIGEM_LABEL[k]} ${summary.status.contagem[k]}`)
                  .join(" · ")}
              </p>
            </Tile>
          ) : (
            <Tile label="Atingimento atual">
              <span
                className={cn(
                  "inline-flex rounded-md px-2 py-0.5 text-xl font-semibold tabular-nums",
                  totalStatus && FAROL_CELL_CLASS[totalStatus],
                )}
              >
                {fmtPct(totalRatio)}
              </span>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {cliente.periodoLabel ?? "Versão mais recente"}
              </p>
            </Tile>
          )}
        </div>
      </div>

      {semReferencia && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Categoria “{cliente.categoria ?? "—"}” sem referência padrão. Defina as metas manualmente
          na simulação.
        </div>
      )}

      {/* ================= 2. Gráfico principal ================= */}
      <MetasComparativoChart
        data={comparativo}
        vis={vis}
        selected={selected}
        onSelect={setSelected}
      />

      {/* ================= 3. Painel do portfólio selecionado ================= */}
      {(() => {
        const idx = drafts.findIndex((d) => d.familia === selected);
        const d = drafts[idx];
        const fam = d.familia;
        return (
          <PortfolioMetaPanel
            draft={d}
            point={comparativo[idx]}
            atingimento={atingimento[fam]}
            vis={vis}
            selected={selected}
            onSelect={setSelected}
            swatches={FAMILY_SWATCH}
            actions={{
              setMetaOficial: (v) => setDrafts((prev) => setMetaOficial(prev, fam, v)),
              setComentarioGestor: (t) => patch(fam, { comentarioGestor: t }),
              setSugestaoRep: (v) => patch(fam, { sugestaoRep: v }),
              setJustificativaRep: (t) => patch(fam, { justificativaRep: t }),
              gerarIa: () =>
                setDrafts((prev) => {
                  const sim = simulateAiSuggestions(prev);
                  return prev.map((x, i) => (x.familia === fam ? sim[i] : x));
                }),
              usarIa: () => setDrafts((prev) => applyAiSuggestion(prev, fam)),
              restaurarPadrao: () => setDrafts((prev) => restoreDefault(prev, fam)),
              copiarRep: () => setDrafts((prev) => copyRepSuggestion(prev, fam)),
            }}
          />
        );
      })()}

      <RevisarVinculoDialog
        open={vinculoOpen}
        onOpenChange={setVinculoOpen}
        razaoSocial={cliente.razaoSocial}
        categoria={cliente.categoria}
        repId={cliente.repId}
        repName={cliente.repName}
      />
      <ConviteRepresentanteDialog
        open={conviteOpen}
        onOpenChange={setConviteOpen}
        repName={cliente.repName}
        clienteNome={cliente.razaoSocial}
      />
    </div>
  );
}

function Tile({
  label,
  muted,
  children,
}: {
  label: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border px-3 py-2",
        muted ? "bg-muted/30" : "bg-card shadow-sm",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
