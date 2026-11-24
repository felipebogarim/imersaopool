// Convite em massa ao representante: avalia se o gestor já gravou as metas dos 7 portfólios de
// cada cliente. Faltando algo, pergunta se aceita a sugestão IA nos faltantes, se envia só os
// clientes já revisados ou se cancela. O representante recebe um único e-mail com todos.

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

type Cliente = { id: string; razao_social: string };

const CAT_INFO: Record<BulkCategoria, { label: string; className: string }> = {
  completo: { label: "Revisado pelo gestor", className: "text-emerald-700 dark:text-emerald-400" },
  parcial: { label: "Revisão parcial", className: "text-amber-700 dark:text-amber-400" },
  pendente: { label: "Sem metas do gestor", className: "text-muted-foreground" },
  erro: { label: "Erro ao consultar", className: "text-destructive" },
};

export function ConviteMassaDialog({
  open,
  onOpenChange,
  repName,
  clientes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repName: string;
  clientes: Cliente[];
}) {
  const [mensagem, setMensagem] = useState("");
  const [statuses, setStatuses] = useState<BulkRowStatus[] | null>(null);
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [fase, setFase] = useState<"idle" | "ia" | "enviando">("idle");
  const [progresso, setProgresso] = useState({ feito: 0, total: 0 });

  const rowIds = useMemo(() => clientes.map((c) => c.id), [clientes]);
  const nomes = useMemo(() => new Map(clientes.map((c) => [c.id, c.razao_social])), [clientes]);

  useEffect(() => {
    if (!open) return;
    setMensagem(
      `Olá, ${repName}! Gostaríamos da sua colaboração na revisão das metas mensais dos clientes da sua carteira. ` +
        "Registre sua sugestão por portfólio e deixe sua justificativa.",
    );
    setStatuses(null);
    setErroStatus(null);
    setFase("idle");
    if (rowIds.length === 0) return;
    let vivo = true;
    getMetasBulkStatus({ data: { rowIds } })
      .then((r) => vivo && setStatuses(r))
      .catch((e) => vivo && setErroStatus(e instanceof Error ? e.message : "Falha ao avaliar."));
    return () => {
      vivo = false;
    };
  }, [open, rowIds, repName]);

  const resumo = useMemo(() => (statuses ? bulkResumo(statuses) : null), [statuses]);
  const incompletos = resumo ? [...resumo.parcial, ...resumo.pendente] : [];
  const ocupado = fase !== "idle";

  async function enviar(ids: string[], extra?: string) {
    if (ids.length === 0) {
      toast.error("Nenhum cliente com metas revisadas para enviar.");
      return;
    }
    setFase("enviando");
    try {
      const r = await inviteRepToMetasBulk({ data: { rowIds: ids, mensagem } });
      toast.success(`Convite em massa enviado para ${r.email}.`, {
        description:
          `${r.enviados} cliente(s) no e-mail.` +
          (extra ? ` ${extra}` : "") +
          (r.revisaoNaoIniciada ? ` ${r.revisaoNaoIniciada} sem fluxo de revisão iniciado.` : ""),
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o convite.");
    } finally {
      setFase("idle");
    }
  }

  async function aceitarIaEEnviar() {
    if (!resumo) return;
    setFase("ia");
    setProgresso({ feito: 0, total: incompletos.length });
    const prontos = [...resumo.completo];
    const falhas: string[] = [];
    const atualizados = new Map<string, BulkRowStatus>();
    // Sequencial: cada cliente pode exigir uma análise da IA.
    for (const rowId of incompletos) {
      try {
        const s = await completeMetasWithAi({ data: { rowId } });
        atualizados.set(rowId, s);
        if (bulkCategoria(s) === "completo") prontos.push(rowId);
        else falhas.push(rowId);
      } catch (e) {
        falhas.push(rowId);
        atualizados.set(rowId, {
          ...(statuses?.find((x) => x.rowId === rowId) as BulkRowStatus),
          erro: e instanceof Error ? e.message : "Falha na IA.",
        });
      }
      setProgresso((p) => ({ ...p, feito: p.feito + 1 }));
    }
    setStatuses((prev) => prev?.map((s) => atualizados.get(s.rowId) ?? s) ?? prev);
    await enviar(
      prontos,
      falhas.length > 0
        ? `${falhas.length} cliente(s) ficaram de fora (sem sugestão IA completa).`
        : undefined,
    );
  }

  const todosProntos = resumo != null && incompletos.length === 0 && resumo.erro.length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !ocupado && onOpenChange(v)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Enviar convite em massa
          </DialogTitle>
          <DialogDescription>
            {repName} recebe um único e-mail com todos os clientes enviados, cada um com o link para
            revisar as metas no portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {erroStatus ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {erroStatus}
            </p>
          ) : !statuses ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Avaliando as metas de{" "}
              {clientes.length} cliente(s)…
            </p>
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
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-xs">
                {statuses.map((s) => {
                  const cat = bulkCategoria(s);
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
                        <span className="truncate">{nomes.get(s.rowId) ?? s.rowId}</span>
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
                </p>
              )}
              {resumo && resumo.erro.length > 0 && (
                <p className="text-[11px] text-destructive">
                  {resumo.erro.length} cliente(s) com erro na consulta não serão enviados.
                </p>
              )}
            </>
          )}

          {fase === "ia" && (
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Aplicando sugestão IA: {progresso.feito}/
                {progresso.total}
              </p>
              <Progress value={(progresso.feito / Math.max(progresso.total, 1)) * 100} />
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Para: <span className="font-medium text-foreground">{repName}</span>
            </p>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              maxLength={2000}
              className="min-h-[96px] text-sm"
              disabled={ocupado}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={ocupado}>
            Cancelar
          </Button>
          {todosProntos ? (
            <Button
              onClick={() => void enviar(resumo.completo)}
              disabled={ocupado || !mensagem.trim()}
            >
              {fase === "enviando" ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-1.5 h-4 w-4" />
              )}
              Enviar convite ({resumo.completo.length})
            </Button>
          ) : (
            resumo && (
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
                  {ocupado ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-4 w-4" />
                  )}
                  Aceitar sugestão IA e enviar ({resumo.completo.length + incompletos.length})
                </Button>
              </>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
