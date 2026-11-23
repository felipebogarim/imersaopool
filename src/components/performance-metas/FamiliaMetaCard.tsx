// Card de edição de um portfólio (simulação local).
// Cabeçalho → mini comparativo → representante | IA (só gestão) | definição do gestor.

import { ClipboardCopy, RotateCcw, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FAROL_CELL_CLASS, FAROL_HEX, FAROL_LABEL, statusFromRatio } from "@/lib/performance-farol";
import {
  AI_TAG_LABEL,
  META_ORIGEM_LABEL,
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

export type FamiliaCardActions = {
  setMetaOficial: (valor: number | null) => void;
  setComentarioGestor: (texto: string) => void;
  setSugestaoRep: (valor: number | null) => void;
  setJustificativaRep: (texto: string) => void;
  usarIa: () => void;
  restaurarPadrao: () => void;
  copiarRep: () => void;
};

export function FamiliaMetaCard({
  draft,
  point,
  atingimento,
  scaleMax,
  swatch,
  vis,
  actions,
}: {
  draft: FamilyMetaDraft;
  point: ComparativoPoint;
  atingimento: number | null;
  scaleMax: number;
  swatch: string;
  vis: MetasVisibility;
  actions: FamiliaCardActions;
}) {
  const status = statusFromRatio(atingimento);
  const diff =
    vis.verMetaPadrao && draft.referencia != null
      ? (draft.metaOficial ?? 0) - draft.referencia
      : null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* 1. Cabeçalho */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-4 py-3">
        <div className="flex min-w-[180px] items-center gap-2">
          <span className={cn("h-3 w-3 rounded-sm", swatch)} />
          <h3 className="font-semibold">{METAS_FAMILY_LABEL[draft.familia]}</h3>
          {vis.verMetaPadrao && (
            <Badge variant="outline" className="text-[9px] uppercase">
              {META_ORIGEM_LABEL[draft.origem]}
            </Badge>
          )}
        </div>
        <HeaderStat label="Performance atual">
          <span
            className={cn("rounded px-1.5 py-0.5 tabular-nums", status && FAROL_CELL_CLASS[status])}
          >
            {fmtPct(atingimento)}
          </span>
        </HeaderStat>
        <HeaderStat label="Meta oficial">
          <span className="tabular-nums">{fmtBRL(draft.metaOficial)}</span>
        </HeaderStat>
        {vis.verMetaPadrao && (
          <HeaderStat label="Diferença vs. padrão">
            <span
              className={cn(
                "tabular-nums",
                diff != null && diff > 0 && "text-emerald-600 dark:text-emerald-400",
                diff != null && diff < 0 && "text-red-600 dark:text-red-400",
              )}
            >
              {diff == null ? "—" : fmtSignedBRL(diff)}
            </span>
          </HeaderStat>
        )}
      </div>

      <div className="space-y-4 p-4">
        {/* 2. Mini comparativo */}
        <div className="space-y-1.5">
          <MiniBar
            label="Performance atual"
            value={
              point.performancePct == null ? "Sem informação" : fmtPoints(point.performancePct)
            }
            pct={point.performancePct}
            scaleMax={scaleMax}
            color={status ? `#${FAROL_HEX[status]}` : undefined}
            marker={vis.verMetaPadrao ? 100 : null}
            hint={status ? FAROL_LABEL[status] : undefined}
          />
          <MiniBar
            label="Meta oficial"
            value={`${fmtPoints(point.metaPct)} ${vis.verMetaPadrao ? "da padrão" : "do total"}`}
            pct={point.metaPct}
            scaleMax={scaleMax}
            className="bg-primary"
            marker={vis.verMetaPadrao ? 100 : null}
          />
        </div>

        <div className={cn("grid gap-3", vis.verSugestaoIa ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {/* 3. Representante */}
          <Area title="Sugestão do representante">
            {vis.editarSugestaoRep ? (
              <>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  placeholder="R$ / mês"
                  value={draft.sugestaoRep ?? ""}
                  onChange={(e) => actions.setSugestaoRep(parseMetaInput(e.target.value))}
                  className="h-8 text-sm tabular-nums"
                />
                <Textarea
                  placeholder="Justificativa"
                  value={draft.justificativaRep}
                  onChange={(e) => actions.setJustificativaRep(e.target.value)}
                  className="min-h-[60px] text-xs"
                />
              </>
            ) : (
              <>
                <p className="font-semibold tabular-nums">
                  {draft.sugestaoRep == null ? "Sem sugestão" : fmtBRL(draft.sugestaoRep)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {draft.justificativaRep || "Sem justificativa."}
                </p>
              </>
            )}
          </Area>

          {/* 4. IA — interna, só gestão */}
          {vis.verSugestaoIa && (
            <Area
              title="Sugestão da IA"
              badge={
                draft.sugestaoIa ? (
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-[9px]">
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
                  <p className="font-semibold tabular-nums">{fmtBRL(draft.sugestaoIa.valor)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {draft.sugestaoIa.justificativa}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Clique em “Sugestão IA” no topo para gerar (simulação).
                </p>
              )}
            </Area>
          )}

          {/* 5. Definição do gestor */}
          <Area title={vis.editarMetaOficial ? "Definição do gestor" : "Meta oficial"}>
            {vis.editarMetaOficial ? (
              <>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  placeholder="Meta oficial R$ / mês"
                  value={draft.metaOficial ?? ""}
                  onChange={(e) => actions.setMetaOficial(parseMetaInput(e.target.value))}
                  className="h-8 text-sm tabular-nums"
                />
                <Textarea
                  placeholder="Comentário"
                  value={draft.comentarioGestor}
                  onChange={(e) => actions.setComentarioGestor(e.target.value)}
                  className="min-h-[60px] text-xs"
                />
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    disabled={!draft.sugestaoIa}
                    onClick={actions.usarIa}
                  >
                    <Sparkles className="mr-1 h-3 w-3" /> Usar IA
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    disabled={draft.referencia == null}
                    onClick={actions.restaurarPadrao}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" /> Padrão
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    disabled={draft.sugestaoRep == null}
                    onClick={actions.copiarRep}
                  >
                    <ClipboardCopy className="mr-1 h-3 w-3" /> Copiar rep.
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-lg font-semibold tabular-nums">{fmtBRL(draft.metaOficial)}</p>
            )}
          </Area>
        </div>
      </div>
    </div>
  );
}

function HeaderStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-semibold">{children}</p>
    </div>
  );
}

function MiniBar({
  label,
  value,
  pct,
  scaleMax,
  color,
  className,
  marker,
  hint,
}: {
  label: string;
  value: string;
  pct: number | null;
  scaleMax: number;
  color?: string;
  className?: string;
  marker: number | null;
  hint?: string;
}) {
  const width = pct == null ? 0 : Math.min(pct / scaleMax, 1) * 100;
  return (
    <div className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <div className="relative h-2.5 rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", className)}
          style={{ width: `${width}%`, backgroundColor: color }}
        />
        {marker != null && (
          <div
            className="absolute -top-1 h-[18px] w-0.5 rounded bg-foreground/60"
            style={{ left: `${Math.min(marker / scaleMax, 1) * 100}%` }}
            title="Meta padrão"
          />
        )}
      </div>
      <span className="min-w-[120px] text-right font-medium tabular-nums">
        {value}
        {hint ? <span className="ml-1 text-muted-foreground">· {hint}</span> : null}
      </span>
    </div>
  );
}

function Area({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {badge}
      </div>
      {children}
    </div>
  );
}
