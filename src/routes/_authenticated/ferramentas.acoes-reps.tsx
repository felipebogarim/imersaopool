import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarClock,
  Inbox,
  Loader2,
  MoreVertical,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTION_BOARD_COLUMNS,
  acceptanceOrDefault,
  boardColumnFor,
  daysUntil,
  formatPrazo,
  readActionMeta,
  statusOrDefault,
  type ActionAcceptance,
  type ActionStatus,
} from "@/lib/action-tracking";
import { sendActionSuggestions } from "@/lib/action-tracking.functions";
import { RepsPanel } from "@/components/acoes-reps/RepsPanel";
import { ExtensionsDialog, type PendingExtension } from "@/components/acoes-reps/ExtensionsDialog";
import {
  SolicitacoesRepsDialog,
  useStaffSolicitacoes,
} from "@/components/acoes-reps/SolicitacoesRepsDialog";
import { solicitacaoEmAberto } from "@/lib/rep-solicitacoes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ferramentas/acoes-reps")({
  head: () => ({ meta: [{ title: "Ações Reps | PoolFlux" }] }),
  component: AcoesRepsPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

type Row = {
  id: string;
  title: string;
  due_date: string | null;
  rep_id?: string;
  rep: string;
  client: string;
  status: ActionStatus;
  acceptance: ActionAcceptance;
};

const REASON: Record<string, string> = {
  rep_without_email: "representante sem e-mail cadastrado",
  no_actions: "nenhuma ação encontrada",
  email_suppressed: "e-mail bloqueado (descadastrado)",
  token_insert_failed: "falha ao gerar o link",
};

function AcoesRepsPage() {
  const qc = useQueryClient();
  const sendFn = useServerFn(sendActionSuggestions);
  const [rep, setRep] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [repsOpen, setRepsOpen] = useState(false);
  const [extOpen, setExtOpen] = useState(false);
  const [solOpen, setSolOpen] = useState(false);
  const { data: solData } = useStaffSolicitacoes();
  const solAbertas = solData?.available
    ? solData.items.filter((x) => solicitacaoEmAberto(x.status)).length
    : 0;
  const [highlightRep, setHighlightRep] = useState<string | null>(null);

  const {
    data: rows = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["acoes-reps"],
    queryFn: async (): Promise<Row[]> => {
      const { data: cards, error: e1 } = await supabase
        .from("kanban_cards")
        .select("id, title, due_date, metadata")
        .not("metadata->>rep_id", "is", null)
        .is("archived_at", null)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (e1) throw e1;
      const ids = (cards ?? []).map((c) => c.id);
      const st = new Map<string, { status: ActionStatus; acceptance: ActionAcceptance }>();
      if (ids.length) {
        let res = await db()
          .from("kanban_action_tracking")
          .select("card_id, status, acceptance")
          .in("card_id", ids);
        // Migration das sugestões ainda não aplicada: segue só com o status.
        if (res.error)
          res = await db()
            .from("kanban_action_tracking")
            .select("card_id, status")
            .in("card_id", ids);
        if (res.error) throw res.error;
        for (const r of res.data ?? [])
          st.set(r.card_id, {
            status: statusOrDefault(r.status),
            acceptance: acceptanceOrDefault(r.acceptance),
          });
      }
      return (cards ?? []).map((c) => {
        const m = readActionMeta(c.metadata);
        const s = st.get(c.id);
        return {
          id: c.id,
          title: c.title,
          due_date: c.due_date,
          rep_id: m.rep_id,
          rep: m.rep_name ?? "—",
          client: m.client_name ?? "—",
          status: s?.status ?? "nao_iniciado",
          acceptance: s?.acceptance ?? "nao_enviada",
        };
      });
    },
  });

  // Pedidos de prorrogação pendentes (tabela criada na Fase 2; sem ela, a lista fica vazia).
  const { data: pendingExt = [] } = useQuery({
    queryKey: ["acoes-reps-ext"],
    queryFn: async (): Promise<Omit<PendingExtension, "title" | "rep">[]> => {
      const { data, error: e } = await db()
        .from("kanban_action_extension_requests")
        .select("id, card_id, current_due, requested_due, justification, created_at")
        .eq("status", "pendente")
        .order("created_at");
      return e ? [] : (data ?? []);
    },
  });
  const extItems: PendingExtension[] = pendingExt.map((x) => {
    const r = rows.find((c) => c.id === x.card_id);
    return { ...x, title: r?.title ?? "Ação", rep: r?.rep ?? "—" };
  });
  const extCards = new Set(pendingExt.map((x) => x.card_id));

  const repOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.rep_id) m.set(r.rep_id, r.rep);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (rep === "all" || r.rep_id === rep) &&
        (!t || `${r.title} ${r.client} ${r.rep}`.toLowerCase().includes(t)),
    );
  }, [rows, rep, q]);

  const columns = useMemo(
    () =>
      ACTION_BOARD_COLUMNS.map((c) => ({
        ...c,
        items: visible.filter((r) => boardColumnFor(r.status, r.acceptance) === c.key),
      })),
    [visible],
  );

  const setAcceptance = useMutation({
    mutationFn: async ({ id, acceptance }: { id: string; acceptance: ActionAcceptance }) => {
      const now = new Date().toISOString();
      const { error: e } = await db()
        .from("kanban_action_tracking")
        .upsert({
          card_id: id,
          acceptance,
          responded_at: acceptance === "aceita" || acceptance === "recusada" ? now : null,
          updated_at: now,
        });
      if (e) throw e;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["acoes-reps"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () => sendFn({ data: { cardIds: [...selected] } }),
    onSuccess: (r) => {
      if (r.sent) toast.success(`Sugestões enviadas a ${r.sent} representante(s).`);
      for (const s of r.skipped) {
        const name = rows.find((x) => x.rep_id === s.repId)?.rep ?? "Representante";
        toast.error(`${name}: ${REASON[s.reason] ?? s.reason}`);
        if (s.reason === "rep_without_email") {
          setHighlightRep(s.repId);
          setRepsOpen(true);
        }
      }
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ["acoes-reps"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const repCount = new Set(rows.filter((r) => selected.has(r.id)).map((r) => r.rep_id)).size;

  return (
    <div>
      <PageHeader
        title="Ações Reps"
        subtitle="Ações sugeridas aos representantes e a evolução de cada uma. O representante decide se aceita."
        actions={
          <>
            {extItems.length > 0 && (
              <Button variant="outline" onClick={() => setExtOpen(true)}>
                <CalendarClock className="mr-1 h-4 w-4" />
                Prorrogações ({extItems.length})
              </Button>
            )}
            {solData?.available && (
              <Button variant="outline" onClick={() => setSolOpen(true)}>
                <Inbox className="mr-1 h-4 w-4" />
                Solicitações dos reps{solAbertas ? ` (${solAbertas})` : ""}
              </Button>
            )}
            <Button variant="outline" onClick={() => setRepsOpen(true)}>
              <Users className="mr-1 h-4 w-4" />
              Representantes
            </Button>
            <Button
              disabled={!selected.size || send.isPending}
              onClick={() => {
                if (
                  confirm(
                    `Enviar ${selected.size} ação(ões) como sugestão para ${repCount} representante(s)?`,
                  )
                )
                  send.mutate();
              }}
            >
              {send.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              Enviar sugestão{selected.size ? ` (${selected.size})` : ""}
            </Button>
          </>
        }
      />
      <div className="space-y-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap gap-2">
          <div className="w-64">
            <Select value={rep} onValueChange={setRep}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os representantes</SelectItem>
                {repOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            className="w-64"
            placeholder="Buscar ação ou cliente…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">Não foi possível carregar as ações.</p>}
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && !rows.length && (
          <p className="text-sm text-muted-foreground">
            Nenhuma ação vinculada a representantes ainda. Ao atribuir um representante a uma ação
            (nas imersões ou na Gestão de Tarefas), ela aparece aqui.
          </p>
        )}

        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((col) => (
            <section key={col.key} className="w-72 shrink-0 rounded-xl border bg-muted/30">
              <header className="border-b px-3 py-2" title={col.hint}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <Badge variant="secondary">{col.items.length}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{col.hint}</p>
              </header>
              <div className="max-h-[68vh] space-y-2 overflow-y-auto p-2">
                {col.items.map((r) => {
                  const d = daysUntil(r.due_date);
                  const open = r.status !== "concluido";
                  const late = open && d !== null && d < 0;
                  const soon = open && d !== null && d >= 0 && d <= 5;
                  const selectable = col.key === "sugerida" || col.key === "aguardando";
                  return (
                    <article key={r.id} className="rounded-lg border bg-card p-3 text-sm shadow-sm">
                      <div className="flex items-start gap-2">
                        {selectable && (
                          <Checkbox
                            checked={selected.has(r.id)}
                            onCheckedChange={() => toggle(r.id)}
                            aria-label="Selecionar para envio"
                            className="mt-0.5"
                          />
                        )}
                        <Link
                          to="/ferramentas/evolucao-acoes/$cardId"
                          params={{ cardId: r.id }}
                          className="flex-1 font-medium leading-snug hover:underline"
                        >
                          {r.title}
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              aria-label="Ações"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setAcceptance.mutate({ id: r.id, acceptance: "aceita" })
                              }
                            >
                              Registrar aceite
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setAcceptance.mutate({ id: r.id, acceptance: "recusada" })
                              }
                            >
                              Registrar recusa
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setAcceptance.mutate({ id: r.id, acceptance: "nao_enviada" })
                              }
                            >
                              Voltar para “Sugerida”
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.client !== "—" ? `${r.client} · ` : ""}
                        {rep === "all" ? r.rep : ""}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span
                          className={cn(
                            late && "font-semibold text-destructive",
                            soon && "font-semibold text-amber-600",
                          )}
                        >
                          {late && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                          {r.due_date ? `Prazo ${formatPrazo(r.due_date)}` : "Sem prazo"}
                          {soon ? (d === 0 ? " · vence hoje" : ` · em ${d} dia(s)`) : ""}
                          {late ? ` · atrasada ${Math.abs(d!)} dia(s)` : ""}
                        </span>
                        {extCards.has(r.id) && (
                          <Badge variant="outline" className="text-[10px]">
                            Prorrogação pedida
                          </Badge>
                        )}
                      </div>
                    </article>
                  );
                })}
                {!col.items.length && (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">Vazio</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
      <ExtensionsDialog open={extOpen} onOpenChange={setExtOpen} items={extItems} />
      <SolicitacoesRepsDialog open={solOpen} onOpenChange={setSolOpen} />
      <RepsPanel open={repsOpen} onOpenChange={setRepsOpen} highlightRepId={highlightRep} />
    </div>
  );
}
