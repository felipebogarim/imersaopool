// Painel individual de metas do cliente (Etapa 1: simulação local).
// Nenhum valor é persistido; recarregar a página descarta a simulação.

import { useMemo, useState } from "react";
import { FlaskConical, Link2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FAROL_CELL_CLASS, FAROL_LABEL, statusFromRatio } from "@/lib/performance-farol";
import { sanitizeRatio } from "@/lib/performance-metrics";
import {
  METAS_FAMILIES,
  METAS_FAMILY_LABEL,
  buildInitialDrafts,
  displayPercents,
  fmtBRL,
  fmtPct,
  metasVisibility,
  restoreDefaultDrafts,
  simulateAiSuggestions,
  summarizeDrafts,
  type FamilyMetaDraft,
  type MetasViewerRole,
} from "@/lib/performance-metas";
import { FamiliaMetaCard } from "./FamiliaMetaCard";
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
}: {
  cliente: MetasClienteInfo;
  role: MetasViewerRole;
}) {
  const vis = metasVisibility(role);
  const [drafts, setDrafts] = useState<FamilyMetaDraft[]>(() =>
    buildInitialDrafts(cliente.categoria),
  );
  const [vinculoOpen, setVinculoOpen] = useState(false);

  const summary = useMemo(() => summarizeDrafts(drafts), [drafts]);
  const percents = useMemo(() => displayPercents(summary.composicao), [summary.composicao]);
  const semReferencia = drafts.every((d) => d.referencia == null);

  const update = (familia: string, patch: Partial<FamilyMetaDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.familia === familia ? { ...d, ...patch } : d)));

  const totalStatus = statusFromRatio(sanitizeRatio(cliente.totalPct));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        <FlaskConical className="h-4 w-4 shrink-0" />
        <span>
          <strong>Simulação local.</strong> Os valores editados não são salvos e não alteram as
          metas oficiais, os faróis nem o BI de Performance.
        </span>
      </div>

      {semReferencia && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Categoria “{cliente.categoria ?? "—"}” sem referência padrão. Defina as metas manualmente
          na simulação.
        </div>
      )}

      {/* Dashboard */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Meta mensal personalizada" hint="Soma das sete famílias">
          <p className="text-2xl font-semibold tabular-nums">{fmtBRL(summary.total)}</p>
          {vis.verMetaPadrao && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Referência da categoria: {fmtBRL(summary.referenciaTotal)}
            </p>
          )}
        </KpiCard>

        {vis.verMetaPadrao ? (
          <KpiCard label="Variação vs. referência" hint="Meta personalizada ÷ referência − 1">
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                summary.variacaoAbs == null || summary.variacaoAbs === 0
                  ? ""
                  : summary.variacaoAbs > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
              )}
            >
              {summary.variacaoPct == null
                ? "—"
                : `${summary.variacaoPct > 0 ? "+" : ""}${fmtPct(summary.variacaoPct)}`}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
              {summary.variacaoAbs == null
                ? "Sem referência"
                : `${summary.variacaoAbs > 0 ? "+" : ""}${fmtBRL(summary.variacaoAbs)} no mês`}
            </p>
          </KpiCard>
        ) : (
          <KpiCard label="Famílias com meta" hint="Famílias com meta mensal positiva">
            <p className="text-2xl font-semibold tabular-nums">{summary.familiasComMeta} / 7</p>
          </KpiCard>
        )}

        <KpiCard label="Atingimento atual" hint={cliente.periodoLabel ?? "Versão mais recente"}>
          <span
            className={cn(
              "inline-flex rounded-md px-2 py-0.5 text-2xl font-semibold tabular-nums",
              totalStatus && FAROL_CELL_CLASS[totalStatus],
            )}
          >
            {fmtPct(sanitizeRatio(cliente.totalPct))}
          </span>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {totalStatus ? FAROL_LABEL[totalStatus] : "Sem informação"}
          </p>
        </KpiCard>

        <KpiCard label="Composição da meta" hint="Participação de cada família (soma 100%)">
          {percents ? (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                {METAS_FAMILIES.map((f, i) => (
                  <div
                    key={f}
                    className={FAMILY_SWATCH[i]}
                    style={{ width: `${percents[f] ?? 0}%` }}
                    title={`${METAS_FAMILY_LABEL[f]}: ${percents[f]}%`}
                  />
                ))}
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                {METAS_FAMILIES.map((f, i) => (
                  <li key={f} className="flex items-center gap-1 truncate">
                    <span className={cn("h-2 w-2 shrink-0 rounded-sm", FAMILY_SWATCH[i])} />
                    <span className="truncate">{METAS_FAMILY_LABEL[f]}</span>
                    <span className="ml-auto tabular-nums">
                      {String(percents[f] ?? 0).replace(".", ",")}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem meta positiva.</p>
          )}
        </KpiCard>
      </div>

      {/* Controles */}
      {vis.usarControlesGestao && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setDrafts(simulateAiSuggestions)}>
            <Sparkles className="mr-1.5 h-4 w-4" /> Sugestão IA
            <Badge variant="secondary" className="ml-2 text-[9px] uppercase">
              Simulação
            </Badge>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDrafts(restoreDefaultDrafts)}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Restaurar padrão
          </Button>
          <Button variant="outline" size="sm" onClick={() => setVinculoOpen(true)}>
            <Link2 className="mr-1.5 h-4 w-4" /> Revisar vínculo
          </Button>
        </div>
      )}

      {/* Matriz das sete famílias */}
      <div className="grid gap-3 lg:grid-cols-2">
        {drafts.map((d, i) => (
          <FamiliaMetaCard
            key={d.familia}
            draft={d}
            swatch={FAMILY_SWATCH[i]}
            vis={vis}
            atingimento={sanitizeRatio(cliente.familiaPct[d.familia])}
            share={percents?.[d.familia] ?? null}
            onChange={(patch) => update(d.familia, patch)}
          />
        ))}
      </div>

      <RevisarVinculoDialog
        open={vinculoOpen}
        onOpenChange={setVinculoOpen}
        razaoSocial={cliente.razaoSocial}
        categoria={cliente.categoria}
        repId={cliente.repId}
        repName={cliente.repName}
      />
    </div>
  );
}

function KpiCard({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-2 text-[10px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}
