// Painel dinâmico do portfólio selecionado.
// Seções: sugestão do representante | sugestão IA (só gestão) | meta do gestor,
// sempre com valor e comentário em campos separados.

import { useState } from "react";
import { ClipboardCopy, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { CanonicalFamily } from "@/lib/client-bi-familias";
import { FAROL_CELL_CLASS, FAROL_LABEL, statusFromRatio } from "@/lib/performance-farol";
import {
  AI_CONFIANCA_LABEL,
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
import { monthLabel } from "@/lib/performance-metas-persistence";

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
  agendadas = [],
  unsaved,
  gerandoIa = false,
  iaDisponivel = true,
  saveBar,
  vis,
  selected,
  onSelect,
  swatches,
  actions,
  investigacao,
}: {
  /** Flag "Em investigação" do cliente, exibido no bloco da meta do gestor. */
  investigacao?: React.ReactNode;
  gerandoIa?: boolean;
  iaDisponivel?: boolean;
  /** Competência + botão Salvar, no rodapé do bloco editável (gestor ou representante). */
  saveBar?: React.ReactNode;
  draft: FamilyMetaDraft;
  point: ComparativoPoint;
  /** Metas deste portfólio já gravadas para competências futuras. */
  agendadas?: Array<{ meta_mensal: number | null; vigente_desde: string }>;
  /** Portfólios com alterações ainda não salvas. */
  unsaved: readonly CanonicalFamily[];
  vis: MetasVisibility;
  selected: CanonicalFamily;
  onSelect: (familia: CanonicalFamily) => void;
  swatches: string[];
  actions: PortfolioPanelActions;
}) {
  const [confirmIaOpen, setConfirmIaOpen] = useState(false);
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
              {point.fonte === "media" ? " · média histórica" : ""}
              {point.fonte === "estimado" ? " · estimado" : ""}
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
          {(draft.sugestaoRep != null || Boolean(draft.justificativaRep?.trim())) &&
            draft.sugestaoRepEnviadaEm && (
              <p className="text-[11px] text-muted-foreground">
                Enviada em {fmtDataHora(draft.sugestaoRepEnviadaEm)}
              </p>
            )}
          {!vis.editarMetaOficial && vis.editarSugestaoRep && saveBar && (
            <div className="flex flex-wrap items-center justify-end gap-1.5">{saveBar}</div>
          )}
        </Section>

        {/* 2. Sugestão IA (interna — só gestão) */}
        {vis.verSugestaoIa && (
          <Section
            title="Sugestão IA"
            aside={
              draft.sugestaoIa ? (
                <div className="flex gap-1">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", TAG_CLASS[draft.sugestaoIa.tag])}
                  >
                    {AI_TAG_LABEL[draft.sugestaoIa.tag]}
                  </Badge>
                  {draft.sugestaoIa.confianca && (
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {AI_CONFIANCA_LABEL[draft.sugestaoIa.confianca]}
                    </Badge>
                  )}
                </div>
              ) : null
            }
          >
            {draft.sugestaoIa ? (
              <>
                <Field
                  label={
                    draft.sugestaoIa.participacao != null
                      ? `Valor sugerido · ${fmtPct(draft.sugestaoIa.participacao)} do total sugerido`
                      : "Valor sugerido"
                  }
                >
                  <ValueText value={draft.sugestaoIa.valor} />
                </Field>
                <Field label="Justificativa">
                  <CommentText text={draft.sugestaoIa.justificativa} />
                </Field>
                <div className="space-y-0.5 text-[11px] text-muted-foreground">
                  {draft.sugestaoIa.resumo && <p>Análise do cliente: {draft.sugestaoIa.resumo}</p>}
                  {draft.sugestaoIa.fundamento && <p>Fundamento: {draft.sugestaoIa.fundamento}</p>}
                  {draft.sugestaoIa.geradaEm && (
                    <p>Gerada em {fmtDataHora(draft.sugestaoIa.geradaEm)}</p>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  {gerandoIa
                    ? "Gerando a sugestão IA das 7 famílias com base, prioritariamente, nos dados da imersão do cliente…"
                    : "Sugestão IA ainda não disponível. Clique em “Gerar sugestão IA” para analisar as 7 famílias com base, prioritariamente, nos dados da imersão do cliente."}
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <SmallAction
                icon={gerandoIa ? Loader2 : Sparkles}
                spin={gerandoIa}
                disabled={gerandoIa || !iaDisponivel}
                onClick={actions.gerarIa}
              >
                {gerandoIa
                  ? draft.sugestaoIa
                    ? "Consultando novos dados…"
                    : "Analisando…"
                  : draft.sugestaoIa
                    ? "Atualizar sugestão IA"
                    : "Gerar sugestão IA"}
              </SmallAction>
            </div>
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
          {vis.editarMetaOficial && agendadas.length > 0 && (
            <p className="text-[11px] text-sky-700 dark:text-sky-400">
              {agendadas
                .map(
                  (a) =>
                    `Mudança programada: ${fmtBRL(a.meta_mensal)} a partir de ${monthLabel(a.vigente_desde)}`,
                )
                .join(" · ")}
            </p>
          )}
          {vis.editarMetaOficial && (
            <>
              <Field label="Comentário do gestor">
                <Textarea
                  value={draft.comentarioGestor}
                  onChange={(e) => actions.setComentarioGestor(e.target.value)}
                  className="min-h-[72px] text-sm"
                />
              </Field>
              {investigacao}
              <div className="flex flex-wrap gap-1.5">
                <SmallAction
                  icon={Sparkles}
                  disabled={!draft.sugestaoIa}
                  onClick={() => setConfirmIaOpen(true)}
                >
                  Aceitar sugestão IA
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
                {saveBar && (
                  <div className="ml-auto flex flex-wrap items-center gap-1.5">{saveBar}</div>
                )}
              </div>

              <AlertDialog open={confirmIaOpen} onOpenChange={setConfirmIaOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Aceitar sugestão da IA?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A meta do gestor para <strong>{METAS_FAMILY_LABEL[selected]}</strong> será
                      alterada de acordo com a sugestão da IA
                      {draft.sugestaoIa?.valor != null && (
                        <>
                          {" "}
                          para <strong>{fmtBRL(draft.sugestaoIa.valor)}</strong>
                        </>
                      )}
                      . Deseja confirmar a alteração?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        actions.usarIa();
                      }}
                    >
                      Aceitar sugestão
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </Section>
      </div>
    </div>
  );
}

const TAG_CLASS: Record<string, string> = {
  imersao: "border-violet-500/40 text-violet-700 dark:text-violet-300",
  tendencia: "border-sky-500/40 text-sky-700 dark:text-sky-300",
  limitado: "border-amber-500/50 text-amber-700 dark:text-amber-300",
};

const fmtDataHora = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

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
  spin,
  disabled,
  onClick,
  children,
}: {
  icon: typeof Sparkles;
  spin?: boolean;
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
      <Icon className={cn("mr-1 h-3 w-3", spin && "animate-spin")} /> {children}
    </Button>
  );
}
