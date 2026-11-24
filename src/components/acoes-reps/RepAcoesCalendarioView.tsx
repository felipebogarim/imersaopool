import { useState, useMemo, useRef } from "react";
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  ListTodo,
  Loader2,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Upload,
  User,
  X,
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
  ACTION_FILES_BUCKET,
  ACTION_MAX_FILE_BYTES,
  ACTION_STATUSES,
  ACTION_STATUS_LABEL,
  daysUntil,
  formatPrazo,
  type ActionStatus,
} from "@/lib/action-tracking";
import {
  repCreateUpload,
  repRequestExtension,
  repSubmitUpdate,
} from "@/lib/rep-portal.functions";
import type { PortalAction } from "@/lib/rep-portal.server";
import { supabase } from "@/integrations/supabase/client";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function RepAcoesCalendarioView({
  actions,
  onNavigateToSuggestions,
}: {
  actions: PortalAction[];
  onNavigateToSuggestions: () => void;
}) {
  const qc = useQueryClient();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [q, setQ] = useState("");
  const [selectedAction, setSelectedAction] = useState<PortalAction | null>(null);

  // Consideramos no calendário as ações aceitas pelo representante
  const acceptedActions = useMemo(
    () => actions.filter((a) => a.acceptance === "aceita"),
    [actions],
  );

  const filtered = useMemo(() => {
    return acceptedActions.filter((a) => {
      if (!q.trim()) return true;
      const query = q.toLowerCase();
      return (
        a.title.toLowerCase().includes(query) ||
        (a.client || "").toLowerCase().includes(query)
      );
    });
  }, [acceptedActions, q]);

  // Contadores
  const stats = useMemo(() => {
    const total = acceptedActions.length;
    const concluidas = acceptedActions.filter((a) => a.status === "concluido").length;
    const emAndamento = acceptedActions.filter((a) => a.status === "em_andamento").length;
    const atrasadas = acceptedActions.filter((a) => {
      const d = daysUntil(a.due_date);
      return a.status !== "concluido" && d !== null && d < 0;
    }).length;
    return { total, concluidas, emAndamento, atrasadas };
  }, [acceptedActions]);

  // Gera dias para a grade do mês selecionado
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { locale: ptBR });
    const endDate = endOfWeek(monthEnd, { locale: ptBR });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  // Mapeia ações por dia YYYY-MM-DD
  const actionsByDate = useMemo(() => {
    const map = new Map<string, PortalAction[]>();
    for (const a of filtered) {
      if (!a.due_date) continue;
      const key = a.due_date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return map;
  }, [filtered]);

  // Próximas entregas agrupadas para a visão em lista
  const groupedList = useMemo(() => {
    const atrasadas: PortalAction[] = [];
    const estaSemana: PortalAction[] = [];
    const proximas: PortalAction[] = [];
    const concluidas: PortalAction[] = [];

    for (const a of filtered) {
      if (a.status === "concluido") {
        concluidas.push(a);
        continue;
      }
      const d = daysUntil(a.due_date);
      if (d !== null && d < 0) {
        atrasadas.push(a);
      } else if (d !== null && d <= 7) {
        estaSemana.push(a);
      } else {
        proximas.push(a);
      }
    }

    return { atrasadas, estaSemana, proximas, concluidas };
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Calendário de Ações da Carteira</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cronograma de ações aceitas. Acompanhe prazos de entrega, anexe evidências e
                atualize o status diretamente em cada compromisso.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border bg-background p-1">
              <Button
                size="sm"
                variant={viewMode === "calendar" ? "default" : "ghost"}
                onClick={() => setViewMode("calendar")}
                className="h-7 text-xs font-semibold gap-1.5"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Mês
              </Button>
              <Button
                size="sm"
                variant={viewMode === "list" ? "default" : "ghost"}
                onClick={() => setViewMode("list")}
                className="h-7 text-xs font-semibold gap-1.5"
              >
                <ListTodo className="h-3.5 w-3.5" />
                Prazos
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToSuggestions}
              className="gap-1.5 text-xs font-medium cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Ver Novas Sugestões
            </Button>
          </div>
        </div>

        {/* Linha de KPIs & Busca */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 border-t pt-4">
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <p className="text-[11px] text-muted-foreground">Total Agendadas</p>
            <p className="text-lg font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <p className="text-[11px] text-muted-foreground">Em Andamento</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {stats.emAndamento}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <p className="text-[11px] text-muted-foreground">Concluídas</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {stats.concluidas}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <p className="text-[11px] text-muted-foreground">Atrasadas</p>
            <p
              className={cn(
                "text-lg font-bold",
                stats.atrasadas > 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {stats.atrasadas}
            </p>
          </div>
        </div>
      </div>

      {/* Visualização: Calendário Mensal */}
      {viewMode === "calendar" ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {/* Navegação do Mês */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate((d) => subMonths(d, 1))}
                className="h-8 w-8 cursor-pointer"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-sm font-bold capitalize text-foreground min-w-[160px] text-center">
                {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </h3>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate((d) => addMonths(d, 1))}
                className="h-8 w-8 cursor-pointer"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
                className="h-8 text-xs font-semibold"
              >
                Hoje
              </Button>
            </div>

            <div className="relative w-full sm:w-64">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar por ação ou cliente…"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Cabeçalho dos Dias da Semana */}
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-bold text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-2.5">
                {day}
              </div>
            ))}
          </div>

          {/* Grade de Dias */}
          <div className="grid grid-cols-7 divide-x divide-y border-b text-xs">
            {calendarDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const isCurrMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);
              const dayActions = actionsByDate.get(dateKey) ?? [];

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "min-h-[110px] p-1.5 transition-colors flex flex-col justify-between",
                    !isCurrMonth && "bg-muted/15 text-muted-foreground/60",
                    isCurrentDay && "bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-inset ring-primary/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                        isCurrentDay
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : isCurrMonth
                            ? "text-foreground"
                            : "text-muted-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>

                    {dayActions.length > 0 && (
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {dayActions.length} ação(ões)
                      </span>
                    )}
                  </div>

                  <div className="mt-1 space-y-1 flex-1 overflow-y-auto max-h-[85px]">
                    {dayActions.map((action) => {
                      const d = daysUntil(action.due_date);
                      const isDone = action.status === "concluido";
                      const isLate = !isDone && d !== null && d < 0;

                      return (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => setSelectedAction(action)}
                          className={cn(
                            "w-full text-left truncate rounded px-1.5 py-1 text-[11px] font-semibold transition-all shadow-2xs border cursor-pointer",
                            isDone && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25",
                            isLate && "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/25",
                            !isDone && !isLate && "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/25",
                          )}
                          title={`${action.client ? `${action.client} · ` : ""}${action.title}`}
                        >
                          <span className="block truncate">
                            {action.client ? `${action.client} · ` : ""}
                            {action.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Visualização: Lista de Prazos */
        <div className="space-y-6">
          {/* Atrasadas */}
          {groupedList.atrasadas.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-destructive">
                <AlertTriangle className="h-4 w-4" /> Atrasadas ({groupedList.atrasadas.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {groupedList.atrasadas.map((action) => (
                  <ActionListItem
                    key={action.id}
                    action={action}
                    onOpen={() => setSelectedAction(action)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Esta semana */}
          {groupedList.estaSemana.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" /> Vencem nos próximos 7 dias ({groupedList.estaSemana.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {groupedList.estaSemana.map((action) => (
                  <ActionListItem
                    key={action.id}
                    action={action}
                    onOpen={() => setSelectedAction(action)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Próximas */}
          {groupedList.proximas.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <CalendarIcon className="h-4 w-4 text-primary" /> Próximas Semanas ({groupedList.proximas.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {groupedList.proximas.map((action) => (
                  <ActionListItem
                    key={action.id}
                    action={action}
                    onOpen={() => setSelectedAction(action)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Concluídas */}
          {groupedList.concluidas.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Concluídas ({groupedList.concluidas.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {groupedList.concluidas.map((action) => (
                  <ActionListItem
                    key={action.id}
                    action={action}
                    onOpen={() => setSelectedAction(action)}
                  />
                ))}
              </div>
            </div>
          )}

          {acceptedActions.length === 0 && (
            <div className="rounded-xl border border-dashed p-12 text-center bg-card">
              <CalendarCheck className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <h4 className="text-sm font-bold text-foreground">Nenhuma ação aceita ainda</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Vá até a aba de Ações Sugeridas para aceitar os planos propostos pela gestão.
              </p>
              <Button
                size="sm"
                onClick={onNavigateToSuggestions}
                className="mt-4 gap-2 text-xs font-semibold"
              >
                <Sparkles className="h-4 w-4" />
                Explorar Ações Sugeridas
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalhes, Andamento e Evidências da Ação */}
      {selectedAction && (
        <ActionDetailDialog
          action={selectedAction}
          open={!!selectedAction}
          onClose={() => setSelectedAction(null)}
          onRefresh={() => void qc.invalidateQueries({ queryKey: ["rep-portal"] })}
        />
      )}
    </div>
  );
}

function ActionListItem({ action, onOpen }: { action: PortalAction; onOpen: () => void }) {
  const d = daysUntil(action.due_date);
  const isDone = action.status === "concluido";
  const late = !isDone && d !== null && d < 0;
  const soon = !isDone && d !== null && d >= 0 && d <= 5;

  return (
    <div className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-xs hover:border-primary/50 transition-all">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <Badge variant="outline" className="text-[10px] font-semibold">
            {action.client || "Geral"}
          </Badge>
          <Badge
            variant={isDone ? "default" : "secondary"}
            className={cn("text-[10px]", isDone && "bg-emerald-600 text-white")}
          >
            {ACTION_STATUS_LABEL[action.status]}
          </Badge>
        </div>
        <h4 className="text-sm font-bold text-foreground leading-snug">{action.title}</h4>
        <p
          className={cn(
            "mt-2 flex items-center gap-1 text-xs text-muted-foreground",
            late && "font-semibold text-destructive",
            soon && "font-semibold text-amber-600 dark:text-amber-400",
          )}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          {action.due_date ? `Prazo: ${formatPrazo(action.due_date)}` : "Sem prazo"}
          {soon ? (d === 0 ? " · vence hoje!" : ` · em ${d} dia(s)`) : ""}
          {late ? ` · atrasada ${Math.abs(d!)} dia(s)` : ""}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-end border-t pt-2.5">
        <Button size="sm" variant="ghost" onClick={onOpen} className="h-8 text-xs font-semibold gap-1 text-primary">
          Atualizar Andamento & Evidências →
        </Button>
      </div>
    </div>
  );
}

function ActionDetailDialog({
  action,
  open,
  onClose,
  onRefresh,
}: {
  action: PortalAction;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const submitFn = useServerFn(repSubmitUpdate);
  const uploadFn = useServerFn(repCreateUpload);
  const extFn = useServerFn(repRequestExtension);

  const [status, setStatus] = useState<ActionStatus>(action.status);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<
    { path: string; name: string; mime: string | null; size: number }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [showExt, setShowExt] = useState(false);
  const [extDate, setExtDate] = useState("");
  const [extJust, setExtJust] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submitMutation = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          cardId: action.id,
          status: status !== action.status ? status : null,
          note: note.trim() || null,
          files,
        },
      }),
    onSuccess: () => {
      toast.success("Andamento registrado com sucesso!");
      setNote("");
      setFiles([]);
      onRefresh();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const extMutation = useMutation({
    mutationFn: () =>
      extFn({
        data: {
          cardId: action.id,
          requestedDue: extDate,
          justification: extJust,
        },
      }),
    onSuccess: () => {
      toast.success("Pedido de prorrogação enviado à gestão.");
      setShowExt(false);
      setExtDate("");
      setExtJust("");
      onRefresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleAddFiles(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    try {
      const added: typeof files = [];
      for (const file of Array.from(list)) {
        if (file.size > ACTION_MAX_FILE_BYTES) throw new Error(`"${file.name}" tem mais de 25MB.`);
        const { path, uploadToken } = await uploadFn({
          data: { cardId: action.id, fileName: file.name, size: file.size },
        });
        const { error } = await supabase.storage
          .from(ACTION_FILES_BUCKET)
          .uploadToSignedUrl(path, uploadToken, file, { contentType: file.type || undefined });
        if (error) throw new Error(`Falha ao enviar "${file.name}".`);
        added.push({ path, name: file.name, mime: file.type || null, size: file.size });
      }
      setFiles((f) => [...f, ...added]);
      toast.success(`${added.length} arquivo(s) anexado(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar arquivo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const canSave = note.trim().length > 0 || files.length > 0 || status !== action.status;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {action.client || "Cliente"}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {ACTION_STATUS_LABEL[action.status]}
            </Badge>
          </div>
          <DialogTitle className="text-base font-bold leading-tight">
            {action.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5" />
            Prazo: <strong>{formatPrazo(action.due_date)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Seletor de Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Atualizar Status</label>
            <div className="grid grid-cols-3 gap-2">
              {ACTION_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-semibold transition-all cursor-pointer",
                    status === s
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {ACTION_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Anotação de Andamento */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              Registrar Andamento / Relato de Campo
            </label>
            <Textarea
              placeholder="Descreva as ações realizadas, alinhamentos feitos com o cliente ou pendências…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-xs min-h-[75px]"
            />
          </div>

          {/* Anexos e Evidências */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Evidências e Arquivos</label>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void handleAddFiles(e.target.files)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="h-7 text-xs gap-1 cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Paperclip className="h-3 w-3" />
                )}
                Anexar foto/arquivo
              </Button>
            </div>

            {files.length > 0 && (
              <div className="space-y-1 rounded-lg border bg-muted/20 p-2 text-xs">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                      className="text-destructive hover:underline text-[10px]"
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prorrogação de Prazo */}
          <div className="border-t pt-3">
            {!showExt ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowExt(true)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Precisa de mais prazo? Solicitar prorrogação
              </Button>
            ) : (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Solicitar Prorrogação</span>
                  <button
                    type="button"
                    onClick={() => setShowExt(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  type="date"
                  value={extDate}
                  onChange={(e) => setExtDate(e.target.value)}
                  className="h-8 text-xs"
                />
                <Textarea
                  placeholder="Justifique o motivo da prorrogação…"
                  value={extJust}
                  onChange={(e) => setExtJust(e.target.value)}
                  className="text-xs min-h-[50px]"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!extDate || extJust.trim().length < 5 || extMutation.isPending}
                  onClick={() => extMutation.mutate()}
                  className="h-7 text-xs font-semibold"
                >
                  {extMutation.isPending ? "Enviando…" : "Enviar pedido de prazo"}
                </Button>
              </div>
            )}
          </div>

          {/* Histórico Anterior */}
          {action.updates && action.updates.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <h4 className="text-xs font-bold text-foreground">Histórico de Andamentos</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {action.updates.map((u) => (
                  <div key={u.id} className="rounded-lg border bg-muted/20 p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="font-semibold">{u.author || "Representante"}</span>
                      <span>{new Date(u.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    {u.status && (
                      <Badge variant="outline" className="text-[10px]">
                        Status: {ACTION_STATUS_LABEL[u.status]}
                      </Badge>
                    )}
                    {u.note && <p className="text-foreground/90">{u.note}</p>}
                    {u.files && u.files.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {u.files.map((file) => (
                          <a
                            key={file.id}
                            href={file.url ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-[10px] text-primary hover:underline border"
                          >
                            <Paperclip className="h-2.5 w-2.5" />
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
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!canSave || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
            className="text-xs font-bold gap-1.5"
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Salvar Andamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
