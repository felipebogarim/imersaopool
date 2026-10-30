import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ACTION_FILES_BUCKET,
  ACTION_STATUS_LABEL,
  formatPrazo,
  readActionMeta,
  statusOrDefault,
  type ActionStatus,
} from "@/lib/action-tracking";

export const Route = createFileRoute("/_authenticated/ferramentas/evolucao-acoes/$cardId")({
  head: () => ({ meta: [{ title: "Detalhes da ação" }] }),
  component: DetalheAcaoPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

type Update = {
  id: string;
  source: "representante" | "interno";
  author_name: string | null;
  status: ActionStatus | null;
  note: string | null;
  created_at: string;
};
type FileRow = {
  id: string;
  update_id: string;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
};
type Pend = {
  id: string;
  description: string;
  assignee_name: string;
  created_at: string;
  resolved_at: string | null;
};

function DetalheAcaoPage() {
  const { cardId } = Route.useParams();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const key = ["evolucao-acao", cardId];

  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: card, error: e0 } = await supabase
        .from("kanban_cards")
        .select("id, title, description, due_date, board_id, metadata")
        .eq("id", cardId)
        .maybeSingle();
      if (e0) throw e0;
      if (!card) return null;
      const [tr, up, fl, pd] = await Promise.all([
        db().from("kanban_action_tracking").select("status").eq("card_id", cardId).maybeSingle(),
        db()
          .from("kanban_action_updates")
          .select("*")
          .eq("card_id", cardId)
          .order("created_at", { ascending: false }),
        db().from("kanban_action_update_files").select("*").eq("card_id", cardId),
        db()
          .from("kanban_action_pendencias")
          .select("*")
          .eq("card_id", cardId)
          .order("created_at", { ascending: false }),
      ]);
      const err = tr.error ?? up.error ?? fl.error ?? pd.error;
      if (err) throw err;
      return {
        card,
        status: statusOrDefault(tr.data?.status),
        updates: (up.data ?? []) as Update[],
        files: (fl.data ?? []) as FileRow[],
        pendencias: (pd.data ?? []) as Pend[],
      };
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      const { data: prof } = uid
        ? await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle()
        : { data: null };
      const { error: e } = await db()
        .from("kanban_action_updates")
        .insert({
          card_id: cardId,
          source: "interno",
          author_name: prof?.full_name ?? u.user?.email ?? "Equipe",
          note: note.trim(),
          created_by: uid,
        });
      if (e) throw e;
    },
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar a nota."),
  });

  const resolvePend = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const { error: e } = await db()
        .from("kanban_action_pendencias")
        .update({ resolved_at: resolved ? new Date().toISOString() : null })
        .eq("id", id);
      if (e) throw e;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  async function download(f: FileRow) {
    const { data: s, error: e } = await supabase.storage
      .from(ACTION_FILES_BUCKET)
      .createSignedUrl(f.storage_path, 120);
    if (e || !s) return toast.error("Não foi possível abrir o anexo.");
    window.open(s.signedUrl, "_blank", "noopener");
  }

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (error)
    return <div className="p-6 text-sm text-destructive">Não foi possível carregar a ação.</div>;
  if (!data) return <div className="p-6 text-sm">Ação não encontrada.</div>;

  const { card, status, updates, files, pendencias } = data;
  const meta = readActionMeta(card.metadata);
  const dt = (s: string) => new Date(s).toLocaleString("pt-BR");

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link
        to="/ferramentas/evolucao-acoes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{card.title}</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{ACTION_STATUS_LABEL[status]}</Badge>
          <Badge variant="outline">Representante: {meta.rep_name ?? "—"}</Badge>
          <Badge variant="outline">Cliente: {meta.client_name ?? "—"}</Badge>
          <Badge variant="outline">Prazo: {formatPrazo(card.due_date)}</Badge>
        </div>
        {card.description ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{card.description}</p>
        ) : null}
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Pendências</h2>
        {!pendencias.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma pendência registrada.</p>
        ) : (
          <ul className="space-y-2">
            {pendencias.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <div className={p.resolved_at ? "text-muted-foreground line-through" : ""}>
                  <div>{p.description}</div>
                  <div className="text-xs text-muted-foreground">
                    Com: {p.assignee_name} · {dt(p.created_at)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolvePend.mutate({ id: p.id, resolved: !p.resolved_at })}
                >
                  {p.resolved_at ? "Reabrir" : "Resolver"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Notas e anexos</h2>
        <div className="space-y-2">
          <Textarea
            placeholder="Adicionar nota interna…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!note.trim() || addNote.isPending}
            onClick={() => addNote.mutate()}
          >
            Salvar nota
          </Button>
        </div>
        {!updates.length ? (
          <p className="text-sm text-muted-foreground">Ainda sem atualizações.</p>
        ) : (
          <ul className="space-y-3">
            {updates.map((u) => {
              const uf = files.filter((f) => f.update_id === u.id);
              return (
                <li key={u.id} className="rounded-md border p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={u.source === "representante" ? "default" : "secondary"}>
                      {u.source === "representante" ? "Representante" : "Equipe"}
                    </Badge>
                    <span>{u.author_name ?? "—"}</span>
                    <span>{dt(u.created_at)}</span>
                    {u.status ? <span>→ {ACTION_STATUS_LABEL[u.status]}</span> : null}
                  </div>
                  {u.note ? <p className="whitespace-pre-wrap">{u.note}</p> : null}
                  {uf.length ? (
                    <ul className="mt-2 space-y-1">
                      {uf.map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => download(f)}
                            className="inline-flex items-center gap-1.5 text-primary hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            {f.file_name}
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
