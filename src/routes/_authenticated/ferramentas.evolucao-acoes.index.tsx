import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ACTION_STATUSES,
  ACTION_STATUS_LABEL,
  formatPrazo,
  isOverdue,
  readActionMeta,
  statusOrDefault,
  type ActionStatus,
} from "@/lib/action-tracking";
import { requestActionUpdatesNow } from "@/lib/action-tracking.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ferramentas/evolucao-acoes/")({
  head: () => ({ meta: [{ title: "Evolução das Ações" }] }),
  component: EvolucaoAcoesPage,
});

// Tabelas kanban_action_* ainda não estão no types.ts gerado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

type Row = {
  id: string;
  title: string;
  due_date: string | null;
  board_id: string;
  rep_id?: string;
  rep: string;
  client: string;
  status: ActionStatus;
};

const STATUS_STYLE: Record<ActionStatus, string> = {
  nao_iniciado: "bg-slate-600 text-white border-slate-600",
  em_andamento: "bg-amber-500 text-white border-amber-500",
  concluido: "bg-emerald-600 text-white border-emerald-600",
};

function EvolucaoAcoesPage() {
  const qc = useQueryClient();
  const requestFn = useServerFn(requestActionUpdatesNow);
  const [q, setQ] = useState("");
  const [rep, setRep] = useState("");
  const [client, setClient] = useState("");
  const [status, setStatus] = useState<ActionStatus | "">("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["evolucao-acoes"],
    queryFn: async (): Promise<Row[]> => {
      const { data: cards, error: e1 } = await supabase
        .from("kanban_cards")
        .select("id, title, due_date, board_id, metadata")
        .not("metadata->>rep_id", "is", null)
        .is("archived_at", null)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (e1) throw e1;
      const ids = (cards ?? []).map((c) => c.id);
      const st = new Map<string, ActionStatus>();
      if (ids.length) {
        const { data: rows, error: e2 } = await db()
          .from("kanban_action_tracking")
          .select("card_id, status")
          .in("card_id", ids);
        if (e2) throw e2;
        for (const r of rows ?? []) st.set(r.card_id, statusOrDefault(r.status));
      }
      return (cards ?? []).map((c) => {
        const m = readActionMeta(c.metadata);
        return {
          id: c.id,
          title: c.title,
          due_date: c.due_date,
          board_id: c.board_id,
          rep_id: m.rep_id,
          rep: m.rep_name ?? "—",
          client: m.client_name ?? "—",
          status: st.get(c.id) ?? "nao_iniciado",
        };
      });
    },
  });

  const setStatusMut = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: ActionStatus }) => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      const { data: prof } = uid
        ? await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle()
        : { data: null };
      const name = prof?.full_name ?? u.user?.email ?? "Equipe";
      const { error: e1 } = await db().from("kanban_action_tracking").upsert({
        card_id: id,
        status: next,
        updated_at: new Date().toISOString(),
        updated_by_name: name,
      });
      if (e1) throw e1;
      const { error: e2 } = await db().from("kanban_action_updates").insert({
        card_id: id,
        source: "interno",
        author_name: name,
        status: next,
        created_by: uid,
      });
      if (e2) throw e2;
    },
    onMutate: async ({ id, next }) => {
      await qc.cancelQueries({ queryKey: ["evolucao-acoes"] });
      const prev = qc.getQueryData<Row[]>(["evolucao-acoes"]);
      qc.setQueryData<Row[]>(["evolucao-acoes"], (rows) =>
        rows?.map((r) => (r.id === id ? { ...r, status: next } : r)),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      qc.setQueryData(["evolucao-acoes"], ctx?.prev);
      toast.error(
        `Não foi possível salvar o status: ${err instanceof Error ? err.message : "erro"}`,
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["evolucao-acoes"] }),
  });

  const requestMut = useMutation({
    mutationFn: (repIds?: string[]) => requestFn({ data: { repIds, force: true } }),
    onSuccess: (r) => {
      toast.success(`${r.sent} solicitação(ões) enviada(s).`);
      if (r.skipped.length) {
        const why = [...new Set(r.skipped.map((s) => s.reason))].join(", ");
        toast.message(`${r.skipped.length} não enviada(s): ${why}`);
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao enviar."),
  });

  const rows = useMemo(() => data ?? [], [data]);
  const reps = useMemo(() => [...new Set(rows.map((r) => r.rep))].sort(), [rows]);
  const clients = useMemo(() => [...new Set(rows.map((r) => r.client))].sort(), [rows]);
  const filtered = rows.filter(
    (r) =>
      (!rep || r.rep === rep) &&
      (!client || r.client === client) &&
      (!status || r.status === status) &&
      (!q || r.title.toLowerCase().includes(q.toLowerCase())),
  );
  const count = (s: ActionStatus) => rows.filter((r) => r.status === s).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Evolução das Ações</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o status e as execuções das ações vinculadas a representantes. O representante
            recebe toda semana um link para atualizar.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={requestMut.isPending}
          onClick={() => {
            const ids = rep
              ? [...new Set(rows.filter((r) => r.rep === rep).map((r) => r.rep_id!))]
              : undefined;
            if (
              confirm(
                rep
                  ? `Enviar solicitação de atualização para ${rep}?`
                  : "Enviar solicitação de atualização a todos os representantes com ações em aberto?",
              )
            )
              requestMut.mutate(ids);
          }}
        >
          {requestMut.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Solicitar atualização agora
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTION_STATUSES.map((s) => (
          <Badge key={s} variant="outline" className="px-3 py-1">
            {ACTION_STATUS_LABEL[s]}: {count(s)}
          </Badge>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="w-64"
          placeholder="Buscar ação…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={rep} onChange={setRep} all="Todos os representantes" options={reps} />
        <Select value={client} onChange={setClient} all="Todos os clientes" options={clients} />
        <Select
          value={status}
          onChange={(v) => setStatus(v as ActionStatus | "")}
          all="Todos os status"
          options={ACTION_STATUSES.map((s) => s)}
          label={(v) => ACTION_STATUS_LABEL[v as ActionStatus]}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : error ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar as ações. Se a migration 20261030120000 ainda não foi aplicada,
          aplique-a no Supabase.
        </p>
      ) : !filtered.length ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma ação encontrada. Vincule um representante à ação na Gestão de Tarefas para ela
          aparecer aqui.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Ação</th>
                <th className="p-3">Representante</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Prazo</th>
                {ACTION_STATUSES.map((s) => (
                  <th key={s} className="p-3 text-center">
                    {ACTION_STATUS_LABEL[s]}
                  </th>
                ))}
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.title}</td>
                  <td className="p-3">{r.rep}</td>
                  <td className="max-w-[220px] truncate p-3" title={r.client}>
                    {r.client}
                  </td>
                  <td
                    className={cn(
                      "p-3 whitespace-nowrap",
                      isOverdue(r.due_date, r.status) && "font-semibold text-destructive",
                    )}
                  >
                    {formatPrazo(r.due_date)}
                  </td>
                  {ACTION_STATUSES.map((s) => (
                    <td key={s} className="p-3 text-center">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={r.status === s}
                        aria-label={`${ACTION_STATUS_LABEL[s]}: ${r.title}`}
                        onClick={() => r.status !== s && setStatusMut.mutate({ id: r.id, next: s })}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-colors",
                          r.status === s
                            ? STATUS_STYLE[s]
                            : "border-muted-foreground/40 hover:border-foreground",
                        )}
                      />
                    </td>
                  ))}
                  <td className="p-3 text-right">
                    <Link
                      to="/ferramentas/evolucao-acoes/$cardId"
                      params={{ cardId: r.id }}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Detalhes da ação
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  all,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  all: string;
  options: string[];
  label?: (v: string) => string;
}) {
  return (
    <select
      className="h-9 rounded-md border bg-background px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{all}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {label ? label(o) : o}
        </option>
      ))}
    </select>
  );
}
