// Painel dinâmico do portfólio selecionado.
// Seções: sugestão do representante | sugestão IA (só gestão) | meta do gestor,
// sempre com valor e comentário em campos separados.

import { ClipboardCopy, RotateCcw, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CanonicalFamily } from "@/lib/client-bi-familias";
import { FAROL_CELL_CLASS, FAROL_LABEL, statusFromRatio } from "@/lib/performance-farol";
import {
  AI_TAG_LABEL,
  META_ORIGEM_LABEL,
  METAS_FAMILIES,
  METAS_FAMILY_LABEL,
  fmtBRL,
  fmtPct,
  fmtPoints,
  fmtSignedBRL,
  parseMetaInput,
  type ComparativoPoint,
  type FamilyMetaDraft,
  type MetasVisibility,
} from "@/lib/performance-metas";

export type PortfolioPanelActions = {
  setMetaOficial: (valor: number | null) => void;
  setComentarioGestor: (texto: string) => void;
  setSugestaoRep: (valor: number | null) => void;
  setJustificativaRep: (texto: string) => void;
  gerarIa: () => void;
  usarIa: () => void;
  restaurarPadrao: () => void;
  copiarRep: () => void;
};

export function PortfolioMetaPanel({
  draft,
  point,
  unsaved,
  vis,
  selected,
  onSelect,
  swatches,
  actions,
}: {
  draft: FamilyMetaDraft;
  point: ComparativoPoint;
  /** Portfólios com alterações ainda não salvas. */
  unsaved: readonly CanonicalFamily[];
  vis: MetasVisibility;
  selected: CanonicalFamily;
  onSelect: (familia: CanonicalFamily) => void;
  swatches: string[];
  actions: PortfolioPanelActions;
}) {
  const ratio = point.performancePct == null ? null : point.performancePct / 100;
  const status = statusFromRatio(ratio);
  const diff =
    vis.verMetaPadrao && draft.referencia != null
      ? (draft.metaOficial ?? 0) - draft.referencia
      : null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Seletor de portfólio (sincronizado com o gráfico) */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-3">
        {METAS_FAMILIES.map((f, i) => (
          <button
            key={f}
            onClick={() => onSelect(f)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-xs transition-colors",
              f === selected
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn("h-2 w-2 rounded-sm", swatches[i])} />
            {METAS_FAMILY_LABEL[f]}
            {unsaved.includes(f) && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-amber-500"
                title="Alterações não salvas"
              />
            )}
          </button>
        ))}
      </div>

      {/* Cabeçalho do portfólio */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold">{METAS_FAMILY_LABEL[draft.familia]}</h3>
          {vis.verMetaPadrao && (
            <p className="text-[11px] text-muted-foreground">
              Origem da meta: {META_ORIGEM_LABEL[draft.origem]}
            </p>
          )}
        </div>
        <Stat label="Atingimento s/ meta oficial">
          <span className={cn("rounded px-1.5 py-0.5", status && FAROL_CELL_CLASS[status])}>
            {fmtPct(ratio)}
          </span>
          {status && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {FAROL_LABEL[status]}
              {point.estimado ? " · estimado" : ""}
            </span>
          )}
          {vis.verMetaPadrao && point.performanceOficialPct != null && (
            <span className="block text-[11px] font-normal text-muted-foreground">
              oficial (meta padrão): {fmtPoints(point.performanceOficialPct)}
            </span>
          )}
        </Stat>
        <Stat label="Meta oficial">
          {fmtBRL(draft.metaOficial)}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {fmtPoints(point.metaPct)} do total
          </span>
        </Stat>
        {vis.verMetaPadrao && (
          <Stat label="Diferença vs. padrão">
            <span
              className={cn(
                diff != null && diff > 0 && "text-emerald-600 dark:text-emerald-400",
                diff != null && diff < 0 && "text-red-600 dark:text-red-400",
              )}
            >
              {fmtSignedBRL(diff)}
            </span>
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              padrão {fmtBRL(draft.referencia)}
            </span>
          </Stat>
        )}
      </div>

      <div
        className={cn(
          "grid gap-4 border-t border-border p-5",
          vis.verSugestaoIa ? "lg:grid-cols-3" : "lg:grid-cols-2",
        )}
      >
        {/* 1. Sugestão do representante */}
        <Section title="Sugestão do representante">
          <Field label="Valor sugerido">
            {vis.editarSugestaoRep ? (
              <MoneyInput value={draft.sugestaoRep} onChange={actions.setSugestaoRep} />
            ) : (
              <ValueText value={draft.sugestaoRep} />
            )}
          </Field>
          <Field label="Justificativa">
            {vis.editarSugestaoRep ? (
              <Textarea
                value={draft.justificativaRep}
                onChange={(e) => actions.setJustificativaRep(e.target.value)}
                className="min-h-[72px] text-sm"
              />
            ) : (
              <CommentText text={draft.justificativaRep} />
            )}
          </Field>
        </Section>

        {/* 2. Sugestão IA (interna — só gestão) */}
        {vis.verSugestaoIa && (
          <Section
            title="Sugestão IA"
            aside={
              draft.sugestaoIa ? (
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {AI_TAG_LABEL[draft.sugestaoIa.tag]}
                  </Badge>
                  <Badge variant="secondary" className="text-[9px] uppercase">
                    Simulação
                  </Badge>
                </div>
              ) : null
            }
          >
            {draft.sugestaoIa ? (
              <>
                <Field label="Valor sugerido">
                  <ValueText value={draft.sugestaoIa.valor} />
                </Field>
                <Field label="Justificativa">
                  <CommentText text={draft.sugestaoIa.justificativa} />
                </Field>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={actions.gerarIa}
                disabled={draft.referencia == null}
              >
                <Sparkles className="mr-1.5 h-4 w-4" /> Gerar sugestão IA
              </Button>
            )}
          </Section>
        )}

        {/* 3. Meta do gestor */}
        <Section title={vis.editarMetaOficial ? "Meta do gestor" : "Meta oficial"}>
          <Field label="Valor definido">
            {vis.editarMetaOficial ? (
              <MoneyInput value={draft.metaOficial} onChange={actions.setMetaOficial} />
            ) : (
              <ValueText value={draft.metaOficial} />
            )}
          </Field>
          {vis.editarMetaOficial && (
            <>
              <Field label="Comentário do gestor">
                <Textarea
                  value={draft.comentarioGestor}
                  onChange={(e) => actions.setComentarioGestor(e.target.value)}
                  className="min-h-[72px] text-sm"
                />
              </Field>
              <div className="flex flex-wrap gap-1.5">
                <SmallAction icon={Sparkles} disabled={!draft.sugestaoIa} onClick={actions.usarIa}>
                  Usar IA
                </SmallAction>
                <SmallAction
                  icon={ClipboardCopy}
                  disabled={draft.sugestaoRep == null}
                  onClick={actions.copiarRep}
                >
                  Copiar representante
                </SmallAction>
                <SmallAction
                  icon={RotateCcw}
                  disabled={draft.referencia == null}
                  onClick={actions.restaurarPadrao}
                >
                  Restaurar padrão
                </SmallAction>
              </div>
            </>
          )}
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums">{children}</p>
    </div>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex min-h-[22px] items-center justify-between gap-2 border-b border-border/60 pb-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        R$
      </span>
      <Input
        type="number"
        min={0}
        step={50}
        value={value ?? ""}
        onChange={(e) => onChange(parseMetaInput(e.target.value))}
        className="pl-9 tabular-nums"
      />
    </div>
  );
}

function ValueText({ value }: { value: number | null }) {
  return (
    <p className="flex h-9 items-center rounded-md border border-border/60 bg-muted/30 px-3 text-sm font-semibold tabular-nums">
      {value == null ? <span className="font-normal text-muted-foreground">—</span> : fmtBRL(value)}
    </p>
  );
}

function CommentText({ text }: { text: string }) {
  return (
    <p className="min-h-[72px] whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
      {text || <span className="text-muted-foreground">—</span>}
    </p>
  );
}

function SmallAction({
  icon: Icon,
  disabled,
  onClick,
  children,
}: {
  icon: typeof Sparkles;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2 text-[11px]"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="mr-1 h-3 w-3" /> {children}
    </Button>
  );
}
