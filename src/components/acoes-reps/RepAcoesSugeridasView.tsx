import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  Loader2,
  PackageOpen,
  Paperclip,
  Search,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ACTION_STATUS_LABEL,
  daysUntil,
  formatPrazo,
  type ActionStatus,
} from "@/lib/action-tracking";
import { repRespondSuggestion } from "@/lib/rep-portal.functions";
import type { PortalAction } from "@/lib/rep-portal.server";

export function RepAcoesSugeridasView({
  actions,
  onNavigateToCalendar,
  onSolicitarApoio,
  topo,
}: {
  actions: PortalAction[];
  onNavigateToCalendar: () => void;
  /** Abre a solicitação de apoio (materiais/trade) vinculada à ação. */
  onSolicitarApoio?: (action: PortalAction) => void;
  /** Conteúdo exibido acima da lista (atalhos "Ações úteis"). */
  topo?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const respondFn = useServerFn(repRespondSuggestion);
  const [q, setQ] = useState("");
  const [filterMode, setFilterMode] = useState<"pendentes" | "todas" | "recusadas">("pendentes");
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [selectedDetailAction, setSelectedDetailAction] = useState<PortalAction | null>(null);

  const respondMutation = useMutation({
    mutationFn: (v: { cardId: string; decision: "aceita" | "recusada"; note?: string }) =>
      respondFn({ data: v }),
    onSuccess: (_, vars) => {
      setDecliningId(null);
      setDeclineNote("");
      setSelectedDetailAction(null);
      void qc.invalidateQueries({ queryKey: ["rep-portal"] });
      if (vars.decision === "aceita") {
        toast.success("Sugestão aceita! Ação agendada no seu Calendário de Ações.");
      } else {
        toast.info("Sugestão recusada.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filtra as ações de acordo com o modo
  const filtered = useMemo(() => {
    return actions.filter((a) => {
      // Por padrão, "pendentes" são sugestões que ainda não foram aceitas nem recusadas
      if (
        filterMode === "pendentes" &&
        (a.acceptance === "aceita" || a.acceptance === "recusada")
      ) {
        return false;
      }
      if (filterMode === "recusadas" && a.acceptance !== "recusada") {
        return false;
      }
      if (q.trim()) {
        const query = q.toLowerCase();
        const matchTitle = a.title.toLowerCase().includes(query);
        const matchClient = (a.client || "").toLowerCase().includes(query);
        if (!matchTitle && !matchClient) return false;
      }
      return true;
    });
  }, [actions, filterMode, q]);

  const pendentesCount = actions.filter(
    (a) => a.acceptance !== "aceita" && a.acceptance !== "recusada",
  ).length;

  return (
    <div className="space-y-6">
      {topo}
      {/* Cabeçalho explicativo */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Ações Sugeridas pela Gestão</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Avalie as propostas desenhadas para a sua carteira. Clique no card para ver todos os
                detalhes ou clique diretamente em{" "}
                <strong className="text-foreground">Aceitar sugestão</strong> para agendar no seu{" "}
                <strong>Calendário de Ações</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToCalendar}
              className="gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <CalendarCheck className="h-3.5 w-3.5 text-primary" />
              Ver Calendário de Ações
            </Button>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant={filterMode === "pendentes" ? "default" : "outline"}
              onClick={() => setFilterMode("pendentes")}
              className="h-8 text-xs font-semibold"
            >
              Pendentes ({pendentesCount})
            </Button>
            <Button
              size="sm"
              variant={filterMode === "todas" ? "default" : "outline"}
              onClick={() => setFilterMode("todas")}
              className="h-8 text-xs"
            >
              Todas as Sugestões ({actions.length})
            </Button>
            <Button
              size="sm"
              variant={filterMode === "recusadas" ? "default" : "outline"}
              onClick={() => setFilterMode("recusadas")}
              className="h-8 text-xs"
            >
              Recusadas ({actions.filter((a) => a.acceptance === "recusada").length})
            </Button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar ação ou cliente…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Lista de Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 p-12 text-center shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            {filterMode === "pendentes"
              ? "Tudo em dia! Nenhuma sugestão pendente."
              : "Nenhuma ação encontrada com os filtros atuais."}
          </h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            {filterMode === "pendentes"
              ? "Todas as sugestões foram avaliadas ou já estão disponíveis no seu Calendário de Ações para acompanhamento de prazos e evidências."
              : "Tente ajustar o termo de busca ou limpar os filtros para visualizar outros registros."}
          </p>
          {filterMode === "pendentes" && (
            <Button
              size="sm"
              onClick={onNavigateToCalendar}
              className="mt-4 gap-2 text-xs font-semibold"
            >
              <CalendarCheck className="h-4 w-4" />
              Abrir Calendário de Ações
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((action) => {
            const d = daysUntil(action.due_date);
            const open = action.status !== "concluido";
            const late = open && d !== null && d < 0;
            const soon = open && d !== null && d >= 0 && d <= 5;
            const isAccepted = action.acceptance === "aceita";
            const isDeclined = action.acceptance === "recusada";
            const isPending = !isAccepted && !isDeclined;
            const isDecliningThis = decliningId === action.id;

            return (
              <div
                key={action.id}
                className={cn(
                  "group relative flex flex-col justify-between rounded-xl border bg-card p-4.5 shadow-sm transition-all hover:shadow-md",
                  isAccepted && "border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10",
                  isDeclined && "opacity-75 bg-muted/40",
                  isPending && "border-primary/25 hover:border-primary/60",
                )}
              >
                {/* Área Clicável para abrir Detalhes */}
                <div
                  onClick={() => setSelectedDetailAction(action)}
                  className="cursor-pointer space-y-2 select-none"
                  title="Clique para ver todos os detalhes desta ação"
                >
                  {/* Topo do card: badges */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className="max-w-[170px] truncate text-[11px] font-semibold bg-muted/50"
                    >
                      {action.client || "Cliente não informado"}
                    </Badge>

                    {isAccepted ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Aceita
                      </Badge>
                    ) : isDeclined ? (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <XCircle className="h-3 w-3" /> Recusada
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] gap-1 shadow-xs">
                        <Sparkles className="h-2.5 w-2.5" /> Sugestão
                      </Badge>
                    )}
                  </div>

                  {/* Título da ação */}
                  <div className="group-hover:text-primary transition-colors flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-foreground leading-snug tracking-tight">
                      {action.title}
                    </h3>
                    <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                  </div>

                  {/* Prazo */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        late && "text-destructive",
                        soon && "text-amber-500",
                      )}
                    />
                    <span
                      className={cn(
                        late && "font-semibold text-destructive",
                        soon && "font-semibold text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {action.due_date ? `Prazo ${formatPrazo(action.due_date)}` : "Sem prazo"}
                      {soon ? (d === 0 ? " · vence hoje!" : ` · em ${d} dia(s)`) : ""}
                      {late ? ` · atrasada ${Math.abs(d!)} dia(s)` : ""}
                    </span>
                  </div>

                  {/* Prévia da Descrição se houver */}
                  {action.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed pt-1">
                      {action.description}
                    </p>
                  )}

                  {/* Botão de Ver Detalhes + apoio */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                      <FileText className="h-3 w-3" /> Ver todos os detalhes
                    </span>
                    {onSolicitarApoio && action.acceptance !== "recusada" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSolicitarApoio(action);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <PackageOpen className="h-3 w-3" /> Solicitar apoio
                      </button>
                    )}
                  </div>
                </div>

                {/* Rodapé interativo do card */}
                <div className="mt-4 border-t pt-3">
                  {isDecliningThis ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Motivo da recusa (opcional)…"
                        value={declineNote}
                        onChange={(e) => setDeclineNote(e.target.value)}
                        className="text-xs min-h-[60px]"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={respondMutation.isPending}
                          onClick={() =>
                            respondMutation.mutate({
                              cardId: action.id,
                              decision: "recusada",
                              note: declineNote,
                            })
                          }
                          className="h-8 flex-1 text-xs font-semibold"
                        >
                          {respondMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Confirmar recusa"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDecliningId(null);
                            setDeclineNote("");
                          }}
                          className="h-8 text-xs"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : isPending ? (
                    <div className="flex items-center gap-2">
                      {/* BOTÃO INTUITIVO PARA ACEITAR SUGESTÃO */}
                      <Button
                        size="sm"
                        disabled={respondMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          respondMutation.mutate({
                            cardId: action.id,
                            decision: "aceita",
                          });
                        }}
                        className="h-9 flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer transition-transform active:scale-[0.98]"
                      >
                        {respondMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CalendarPlus className="h-4 w-4" />
                        )}
                        Aceitar sugestão
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDecliningId(action.id);
                          setDeclineNote("");
                        }}
                        className="h-9 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Recusar sugestão"
                      >
                        Recusar
                      </Button>
                    </div>
                  ) : isAccepted ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> No Calendário
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={onNavigateToCalendar}
                        className="h-7 text-xs text-primary font-semibold hover:underline"
                      >
                        Ver no Calendário →
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Sugestão recusada</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          respondMutation.mutate({
                            cardId: action.id,
                            decision: "aceita",
                          });
                        }}
                        className="h-7 text-xs text-primary font-medium hover:underline"
                      >
                        Reconsiderar e aceitar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DIÁLOGO COM TODOS OS DETALHES DO CARD */}
      {selectedDetailAction && (
        <AcaoSugeridaDetailDialog
          action={selectedDetailAction}
          open={!!selectedDetailAction}
          onClose={() => setSelectedDetailAction(null)}
          onAccept={() =>
            respondMutation.mutate({
              cardId: selectedDetailAction.id,
              decision: "aceita",
            })
          }
          onDecline={(note) =>
            respondMutation.mutate({
              cardId: selectedDetailAction.id,
              decision: "recusada",
              note,
            })
          }
          isPending={respondMutation.isPending}
          onNavigateToCalendar={onNavigateToCalendar}
        />
      )}
    </div>
  );
}

function AcaoSugeridaDetailDialog({
  action,
  open,
  onClose,
  onAccept,
  onDecline,
  isPending,
  onNavigateToCalendar,
}: {
  action: PortalAction;
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  onDecline: (note?: string) => void;
  isPending: boolean;
  onNavigateToCalendar: () => void;
}) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");

  const d = daysUntil(action.due_date);
  const isAccepted = action.acceptance === "aceita";
  const isDeclined = action.acceptance === "recusada";
  const isPendingAcceptance = !isAccepted && !isDeclined;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge variant="outline" className="text-xs font-semibold bg-muted/40">
              {action.client || "Cliente Geral"}
            </Badge>
            {isAccepted ? (
              <Badge className="bg-emerald-600 text-white text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" /> Ação Aceita (No Calendário)
              </Badge>
            ) : isDeclined ? (
              <Badge variant="secondary" className="text-xs gap-1">
                <XCircle className="h-3 w-3" /> Sugestão Recusada
              </Badge>
            ) : (
              <Badge className="bg-amber-500 text-white text-xs gap-1 shadow-xs">
                <Sparkles className="h-3 w-3" /> Sugestão Pendente
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg font-bold leading-tight text-foreground">
            {action.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            Prazo limite:{" "}
            <strong className="text-foreground">
              {action.due_date ? formatPrazo(action.due_date) : "Sem data limite"}
            </strong>
            {d !== null && (
              <span
                className={cn(d < 0 ? "text-destructive font-semibold" : "text-muted-foreground")}
              >
                (
                {d < 0
                  ? `atrasada há ${Math.abs(d)} dia(s)`
                  : d === 0
                    ? "vence hoje"
                    : `em ${d} dia(s)`}
                )
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Descrição Completa da Ação */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Descrição e Objetivo da Ação
            </h4>
            <div className="rounded-lg border bg-muted/30 p-3.5 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {action.description ? (
                action.description
              ) : (
                <span className="italic text-muted-foreground text-xs">
                  Nenhuma descrição detalhada cadastrada para esta ação.
                </span>
              )}
            </div>
          </div>

          {/* Histórico de Andamentos e Instruções da Equipe */}
          {action.updates && action.updates.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Instruções da Equipe & Histórico ({action.updates.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {action.updates.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-lg border bg-muted/20 p-2.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-bold text-foreground">
                        {u.author || "Equipe de Gestão"}
                      </span>
                      <span>{new Date(u.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    {u.status && (
                      <Badge variant="outline" className="text-[10px]">
                        Status: {ACTION_STATUS_LABEL[u.status]}
                      </Badge>
                    )}
                    {u.note && <p className="text-foreground/90 leading-relaxed">{u.note}</p>}
                    {u.files && u.files.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {u.files.map((file) => (
                          <a
                            key={file.id}
                            href={file.url ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-[10px] text-primary hover:underline border shadow-2xs"
                          >
                            <Paperclip className="h-3 w-3" />
                            {file.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Área de Recusa */}
          {declining && (
            <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
              <p className="font-semibold text-foreground">
                Explique o motivo da recusa (opcional):
              </p>
              <Textarea
                placeholder="Ex.: Cliente em negociação prévia, ação inviável neste trimestre…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-xs min-h-[60px]"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => onDecline(note)}
                  className="h-8 text-xs font-semibold"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Confirmar recusa"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeclining(false)}
                  className="h-8 text-xs"
                >
                  Voltar
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 border-t pt-3">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Fechar
          </Button>

          {isPendingAcceptance && !declining && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeclining(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Recusar
              </Button>
              <Button
                size="sm"
                disabled={isPending}
                onClick={onAccept}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex-1 sm:flex-none shadow-sm cursor-pointer"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarPlus className="h-4 w-4" />
                )}
                Aceitar sugestão & Agendar
              </Button>
            </div>
          )}

          {isAccepted && (
            <Button
              size="sm"
              onClick={() => {
                onClose();
                onNavigateToCalendar();
              }}
              className="text-xs font-semibold gap-1.5"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Abrir no Calendário de Ações
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
