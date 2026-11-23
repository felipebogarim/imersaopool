// Card de uma família na matriz de metas (simulação local).

import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FAROL_HEX, FAROL_LABEL, statusFromRatio } from "@/lib/performance-farol";
import {
  AI_ORIGIN_LABEL,
  METAS_FAMILY_LABEL,
  fmtBRL,
  fmtPct,
  parseMetaInput,
  type FamilyMetaDraft,
  type MetasVisibility,
} from "@/lib/performance-metas";

/** Escala da barra de performance: 0–150%, com marcador em 100%. */
const PERF_SCALE = 1.5;

export function FamiliaMetaCard({
  draft,
  swatch,
  vis,
  atingimento,
  share,
  onChange,
}: {
  draft: FamilyMetaDraft;
  swatch: string;
  vis: MetasVisibility;
  atingimento: number | null;
  share: number | null;
  onChange: (patch: Partial<FamilyMetaDraft>) => void;
}) {
  const status = statusFromRatio(atingimento);
  const perfWidth = atingimento == null ? 0 : Math.min(atingimento / PERF_SCALE, 1) * 100;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <span className={cn("h-2.5 w-2.5 rounded-sm", swatch)} />
          {METAS_FAMILY_LABEL[draft.familia]}
        </h3>
        {vis.verMetaPadrao && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            padrão {fmtBRL(draft.referencia)}
          </span>
        )}
      </div>

      {/* 1. Performance atual */}
      <BarRow
        label="Performance atual"
        value={
          atingimento == null
            ? "Sem informação"
            : `${fmtPct(atingimento)} · ${FAROL_LABEL[status!]}`
        }
      >
        <div className="relative h-2.5 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{
              width: `${perfWidth}%`,
              backgroundColor: status ? `#${FAROL_HEX[status]}` : undefined,
            }}
          />
          <div
            className="absolute top-[-3px] h-[16px] w-px bg-foreground/50"
            style={{ left: `${100 / PERF_SCALE}%` }}
            title="100% da meta"
          />
        </div>
      </BarRow>

      {/* 2. Meta definida pelo gestor */}
      <BarRow
        label="Meta do gestor"
        value={`${fmtBRL(draft.metaGestor ?? 0)}${share != null ? ` · ${String(share).replace(".", ",")}% do total` : ""}`}
      >
        <div className="h-2.5 w-full rounded-full bg-muted">
          <div className={cn("h-full rounded-full", swatch)} style={{ width: `${share ?? 0}%` }} />
        </div>
      </BarRow>

      <div className="grid gap-3 sm:grid-cols-3 pt-1">
        {/* 3. Sugestão da IA */}
        <FieldBlock title="Sugestão IA">
          {vis.verSugestaoIa ? (
            draft.sugestaoIa ? (
              <div className="space-y-1">
                <p className="font-semibold tabular-nums">{fmtBRL(draft.sugestaoIa.valor)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {draft.sugestaoIa.justificativa}
                </p>
                <Badge variant="outline" className="text-[9px]">
                  {AI_ORIGIN_LABEL[draft.sugestaoIa.origem]}
                </Badge>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Use “Sugestão IA” para preencher (simulação).
              </p>
            )
          ) : (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" /> Restrita à gestão
            </p>
          )}
        </FieldBlock>

        {/* 4. Sugestão do representante */}
        <FieldBlock title="Sugestão do representante">
          {vis.editarSugestaoRep ? (
            <div className="space-y-1.5">
              <Input
                type="number"
                min={0}
                step={50}
                placeholder="R$ / mês"
                value={draft.sugestaoRep ?? ""}
                onChange={(e) => onChange({ sugestaoRep: parseMetaInput(e.target.value) })}
                className="h-8 text-sm"
              />
              <Textarea
                placeholder="Comentário"
                value={draft.comentarioRep}
                onChange={(e) => onChange({ comentarioRep: e.target.value })}
                className="min-h-[56px] text-xs"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-semibold tabular-nums">
                {draft.sugestaoRep == null ? "—" : fmtBRL(draft.sugestaoRep)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {draft.comentarioRep || "Sem comentário."}
              </p>
            </div>
          )}
        </FieldBlock>

        {/* 5. Meta do gestor (oficial) */}
        <FieldBlock title="Meta oficial (gestor)">
          {vis.editarMetaOficial ? (
            <div className="space-y-1.5">
              <Input
                type="number"
                min={0}
                step={50}
                placeholder="R$ / mês"
                value={draft.metaGestor ?? ""}
                onChange={(e) => onChange({ metaGestor: parseMetaInput(e.target.value) })}
                className="h-8 text-sm tabular-nums"
              />
              <Textarea
                placeholder="Justificativa"
                value={draft.justificativaGestor}
                onChange={(e) => onChange({ justificativaGestor: e.target.value })}
                className="min-h-[56px] text-xs"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-semibold tabular-nums">{fmtBRL(draft.metaGestor)}</p>
              <p className="text-[11px] text-muted-foreground">
                {draft.justificativaGestor || "Sem justificativa."}
              </p>
            </div>
          )}
        </FieldBlock>
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

function FieldBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}
