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
  Filter,
  Loader2,
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
}: {
  actions: PortalAction[];
  onNavigateToCalendar: () => void;
}) {
  const qc = useQueryClient();
  const respondFn = useServerFn(repRespondSuggestion);
  const [q, setQ] = useState("");
  const [filterMode, setFilterMode] = useState<"pendentes" | "todas" | "recusadas">("pendentes");
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState("");

  const respondMutation = useMutation({
    mutationFn: (v: { cardId: string; decision: "aceita" | "recusada"; note?: string }) =>
      respondFn({ data: v }),
    onSuccess: (_, vars) => {
      setDecliningId(null);
      setDeclineNote("");
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
      if (filterMode === "pendentes" && (a.acceptance === "aceita" || a.acceptance === "recusada")) {
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
                Avalie as propostas desenhadas para a sua carteira. Ao clicar em{" "}
                <strong className="text-foreground">Aceitar Sugestão</strong>, a ação é
                automaticamente agendada no seu <strong>Calendário de Ações</strong>.
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
                <div>
                  {/* Topo do card: badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
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
                  <h3 className="text-sm font-bold text-foreground leading-snug tracking-tight">
                    {action.title}
                  </h3>

                  {/* Prazo */}
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
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

                  {/* Última atualização / instrução da equipe */}
                  {action.updates && action.updates.length > 0 && (
                    <div className="mt-3 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground border border-border/50">
                      <p className="line-clamp-2 italic">
                        "{action.updates[0].note || "Sem observações adicionais."}"
                      </p>
                      <span className="mt-1 block text-[10px] text-muted-foreground/80">
                        {action.updates[0].author || "Gestão"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Rodapé interativo do card */}
                <div className="mt-5 border-t pt-3">
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
                        onClick={() =>
                          respondMutation.mutate({
                            cardId: action.id,
                            decision: "aceita",
                          })
                        }
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
                        onClick={() => {
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
                        onClick={() =>
                          respondMutation.mutate({
                            cardId: action.id,
                            decision: "aceita",
                          })
                        }
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
    </div>
  );
}
