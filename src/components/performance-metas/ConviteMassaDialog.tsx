// Convite em massa aos representantes: o gestor escolhe um, vários ou todos os representantes;
// o sistema avalia se ele já gravou as metas dos 7 portfólios de cada cliente. Faltando algo,
// pergunta se aceita a sugestão IA nos faltantes, se envia só os clientes já revisados ou se
// cancela. Cada representante recebe um único e-mail com todos os seus clientes.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  completeMetasWithAi,
  getMetasBulkStatus,
  inviteRepToMetasBulk,
} from "@/lib/performance-metas.functions";
import {
  bulkCategoria,
  bulkResumo,
  type BulkCategoria,
  type BulkRowStatus,
} from "@/lib/performance-metas-bulk";
import { MultiFilter } from "./MetasBiTables";

export type ConviteMassaCliente = {
  id: string;
  razao_social: string;
  repId: string;
  repName: string;
};

const CAT_INFO: Record<BulkCategoria, { label: string; className: string }> = {
  completo: { label: "Revisado pelo gestor", className: "text-emerald-700 dark:text-emerald-400" },
  parcial: { label: "Revisão parcial", className: "text-amber-700 dark:text-amber-400" },
  pendente: { label: "Sem metas do gestor", className: "text-muted-foreground" },
  erro: { label: "Erro ao consultar", className: "text-destructive" },
};

/** Lotes da consulta de situação (o servidor aceita até 500 linhas por chamada). */
const STATUS_CHUNK = 200;

export function ConviteMassaDialog({
  open,
  onOpenChange,
  clientes,
  initialRepIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Clientes elegíveis (filtro atual da lista), já com o representante. */
  clientes: ConviteMassaCliente[];
  /** Representantes pré-selecionados; vazio = todos. */
  initialRepIds: string[];
}) {
  const reps = useMemo(() => {
    const m = new Map<string, { key: string; label: string; n: number }>();
    for (const c of clientes) {
      const r = m.get(c.repId) ?? { key: c.repId, label: c.repName, n: 0 };
      r.n += 1;
      m.set(c.repId, r);
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [clientes]);

  const [repIds, setRepIds] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [statuses, setStatuses] = useState<BulkRowStatus[] | null>(null);
  const [avaliando, setAvaliando] = useState(false);
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [fase, setFase] = useState<"idle" | "ia" | "enviando">("idle");
  const [progresso, setProgresso] = useState({ feito: 0, total: 0, rotulo: "" });

  const selecionados = useMemo(() => {
    const set = new Set(repIds);
    return clientes.filter((c) => set.has(c.repId));
  }, [clientes, repIds]);
  const info = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const umRep = repIds.length === 1 ? reps.find((r) => r.key === repIds[0]) : undefined;

  // Abrir: pré-seleção (rep filtrado) ou todos; um único rep já é avaliado direto.
  useEffect(() => {
    if (!open) return;
    const ini = initialRepIds.filter((id) => reps.some((r) => r.key === id));
    const ids = ini.length > 0 ? ini : reps.map((r) => r.key);
    setRepIds(ids);
    setStatuses(null);
    setErroStatus(null);
    setFase("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setMensagem(
      `Olá${umRep ? `, ${umRep.label}` : ""}! Gostaríamos da sua colaboração na revisão das metas mensais dos clientes da sua carteira. ` +
        "Registre sua sugestão por portfólio e deixe sua justificativa.",
    );
  }, [open, umRep]);

  // Mudou a seleção: a avaliação anterior deixa de valer.
  useEffect(() => {
    setStatuses(null);
    setErroStatus(null);
  }, [repIds]);

  async function avaliar() {
    const ids = selecionados.map((c) => c.id);
    if (ids.length === 0) return;
    setAvaliando(true);
    setErroStatus(null);
    setProgresso({ feito: 0, total: ids.length, rotulo: "Avaliando metas" });
    try {
      const out: BulkRowStatus[] = [];
      for (let i = 0; i < ids.length; i += STATUS_CHUNK) {
        const parte = await getMetasBulkStatus({
          data: { rowIds: ids.slice(i, i + STATUS_CHUNK) },
        });
        out.push(...parte);
        setProgresso((p) => ({ ...p, feito: out.length }));
      }
      setStatuses(out);
    } catch (e) {
      setErroStatus(e instanceof Error ? e.message : "Falha ao avaliar.");
    } finally {
      setAvaliando(false);
    }
  }

  // Um único representante pré-selecionado: avalia ao abrir (como antes).
  useEffect(() => {
    if (open && repIds.length === 1 && !statuses && !avaliando && !erroStatus) void avaliar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, repIds]);

  const resumo = useMemo(() => (statuses ? bulkResumo(statuses) : null), [statuses]);
  const incompletos = resumo ? [...resumo.parcial, ...resumo.pendente] : [];
  const ocupado = fase !== "idle" || avaliando;
  const repsNoEnvio = (ids: string[]) => new Set(ids.map((id) => info.get(id)?.repId)).size;

  /** Envia um e-mail por representante, com todos os clientes prontos dele. */
  async function enviar(ids: string[], extra?: string) {
    if (ids.length === 0) {
      toast.error("Nenhum cliente com metas revisadas para enviar.");
      return;
    }
    const porRep = new Map<string, string[]>();
    for (const id of ids) {
      const repId = info.get(id)?.repId;
      if (!repId) continue;
      porRep.set(repId, [...(porRep.get(repId) ?? []), id]);
    }
    setFase("enviando");
    setProgresso({ feito: 0, total: porRep.size, rotulo: "Enviando e-mails" });
    const ok: string[] = [];
    const falhas: string[] = [];
    let clientesEnviados = 0;
    for (const [repId, rowIds] of porRep) {
      const nome = reps.find((r) => r.key === repId)?.label ?? repId;
      try {
        const r = await inviteRepToMetasBulk({ data: { rowIds, mensagem } });
        ok.push(nome);
        clientesEnviados += r.enviados;
      } catch (e) {
        falhas.push(`${nome}: ${e instanceof Error ? e.message : "falha no envio"}`);
      }
      setProgresso((p) => ({ ...p, feito: p.feito + 1 }));
    }
    setFase("idle");
    if (ok.length > 0) {
      toast.success(
        ok.length === 1
          ? `Convite em massa enviado para ${ok[0]}.`
          : `Convites enviados para ${ok.length} representantes.`,
        {
          description: `${clientesEnviados} cliente(s) nos e-mails.${extra ? ` ${extra}` : ""}`,
        },
      );
    }
    if (falhas.length > 0) {
      toast.error(`${falhas.length} representante(s) não receberam o convite.`, {
        description: falhas.slice(0, 5).join(" · "),
      });
    }
    if (falhas.length === 0) onOpenChange(false);
  }

  async function aceitarIaEEnviar() {
    if (!resumo) return;
    setFase("ia");
    setProgresso({ feito: 0, total: incompletos.length, rotulo: "Aplicando sugestão IA" });
    const prontos = [...resumo.completo];
    let falhas = 0;
    const atualizados = new Map<string, BulkRowStatus>();
    // Sequencial: cada cliente pode exigir uma análise da IA.
    for (const rowId of incompletos) {
      try {
        const s = await completeMetasWithAi({ data: { rowId } });
        atualizados.set(rowId, s);
        if (bulkCategoria(s) === "completo") prontos.push(rowId);
        else falhas += 1;
      } catch (e) {
        falhas += 1;
        const antes = statuses?.find((x) => x.rowId === rowId);
        if (antes)
          atualizados.set(rowId, {
            ...antes,
            erro: e instanceof Error ? e.message : "Falha na IA.",
          });
      }
      setProgresso((p) => ({ ...p, feito: p.feito + 1 }));
    }
    setStatuses((prev) => prev?.map((s) => atualizados.get(s.rowId) ?? s) ?? prev);
    await enviar(
      prontos,
      falhas > 0 ? `${falhas} cliente(s) ficaram de fora (sem sugestão IA completa).` : undefined,
    );
  }

  const todosProntos = resumo != null && incompletos.length === 0 && resumo.erro.length === 0;
  const destino =
    repIds.length === 1
      ? (umRep?.label ?? "")
      : repIds.length === reps.length
        ? `todos os ${reps.length} representantes`
        : `${repIds.length} representantes`;

  return (
    <Dialog open={open} onOpenChange={(v) => !ocupado && onOpenChange(v)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Enviar convite em massa
          </DialogTitle>
          <DialogDescription>
            Cada representante recebe um único e-mail com todos os clientes dele enviados, cada um
            com o link para revisar as metas no portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Representantes:</span>
            <MultiFilter
              label={
                repIds.length === 0
                  ? "Nenhum"
                  : repIds.length === reps.length
                    ? `Todos (${reps.length})`
                    : umRep
                      ? umRep.label
                      : `${repIds.length} selecionados`
              }
              options={reps.map((r) => ({ key: r.key, label: `${r.label} (${r.n})` }))}
              value={repIds}
              onChange={(v) => !ocupado && setRepIds(v)}
            />
            <span className="text-xs text-muted-foreground">
              {selecionados.length} cliente(s) no filtro atual
            </span>
          </div>

          {erroStatus ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {erroStatus}
            </p>
          ) : !statuses ? (
            avaliando ? null : (
              <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Avalie se o gestor já revisou as metas dos 7 portfólios de cada cliente antes de
                  enviar.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void avaliar()}
                  disabled={selecionados.length === 0}
                >
                  Avaliar metas ({selecionados.length})
                </Button>
              </div>
            )
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                {(["completo", "parcial", "pendente"] as const).map((c) => (
                  <div key={c} className="rounded-md border border-border p-2">
                    <p className="text-lg font-semibold tabular-nums">{resumo?.[c].length ?? 0}</p>
                    <p className={cn("text-[11px]", CAT_INFO[c].className)}>{CAT_INFO[c].label}</p>
                  </div>
                ))}
              </div>
              <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-xs">
                {statuses.map((s) => {
                  const cat = bulkCategoria(s);
                  const c = info.get(s.rowId);
                  const Icon =
                    cat === "completo"
                      ? CheckCircle2
                      : cat === "erro"
                        ? AlertTriangle
                        : CircleDashed;
                  return (
                    <li key={s.rowId} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Icon className={cn("h-3.5 w-3.5 shrink-0", CAT_INFO[cat].className)} />
                        <span className="truncate">{c?.razao_social ?? s.rowId}</span>
                        {repIds.length > 1 && (
                          <span className="shrink-0 text-muted-foreground">· {c?.repName}</span>
                        )}
                      </span>
                      <span className={cn("shrink-0", CAT_INFO[cat].className)}>
                        {cat === "parcial"
                          ? `${s.salvas.length}/7 portfólios`
                          : cat === "erro"
                            ? s.erro
                            : CAT_INFO[cat].label}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {incompletos.length > 0 && (
                <p className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  {incompletos.length} cliente(s) ainda não têm todas as metas revisadas pelo
                  gestor. Você pode aceitar a sugestão IA nos portfólios que faltam (o que você já
                  revisou não muda), enviar só os clientes já revisados ou cancelar.
                  {incompletos.length > 50 &&
                    " Aceitar a IA em muitos clientes leva alguns minutos (uma análise por cliente)."}
                </p>
              )}
              {resumo && resumo.erro.length > 0 && (
                <p className="text-[11px] text-destructive">
                  {resumo.erro.length} cliente(s) com erro na consulta não serão enviados.
                </p>
              )}
            </>
          )}

          {(avaliando || fase !== "idle") && (
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                {fase === "ia" ? (
                  <Sparkles className="h-3.5 w-3.5" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {progresso.rotulo}: {progresso.feito}/{progresso.total}
              </p>
              <Progress value={(progresso.feito / Math.max(progresso.total, 1)) * 100} />
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Para: <span className="font-medium text-foreground">{destino || "—"}</span>
            </p>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              maxLength={2000}
              className="min-h-[88px] text-sm"
              disabled={ocupado}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={ocupado}>
            Cancelar
          </Button>
          {resumo &&
            (todosProntos ? (
              <Button
                onClick={() => void enviar(resumo.completo)}
                disabled={ocupado || !mensagem.trim()}
              >
                <Mail className="mr-1.5 h-4 w-4" />
                Enviar convite ({resumo.completo.length} clientes · {repsNoEnvio(resumo.completo)}{" "}
                rep.)
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => void enviar(resumo.completo)}
                  disabled={ocupado || resumo.completo.length === 0 || !mensagem.trim()}
                >
                  Enviar só os revisados ({resumo.completo.length})
                </Button>
                <Button
                  onClick={() => void aceitarIaEEnviar()}
                  disabled={ocupado || incompletos.length === 0 || !mensagem.trim()}
                >
                  {fase === "ia" ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-4 w-4" />
                  )}
                  Aceitar sugestão IA e enviar ({resumo.completo.length + incompletos.length})
                </Button>
              </>
            ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
