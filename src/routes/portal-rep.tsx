import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarClock, Loader2, LogOut, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ACTION_BOARD_COLUMNS,
  ACTION_FILES_BUCKET,
  ACTION_MAX_FILE_BYTES,
  ACTION_STATUSES,
  ACTION_STATUS_LABEL,
  boardColumnFor,
  daysUntil,
  formatPrazo,
  type ActionBoardColumn,
  type ActionStatus,
} from "@/lib/action-tracking";
import {
  getRepPortal,
  repCreateUpload,
  repRequestExtension,
  repRespondSuggestion,
  repSubmitUpdate,
} from "@/lib/rep-portal.functions";
import type { PortalAction } from "@/lib/rep-portal.server";
import { cn } from "@/lib/utils";
import { RepMetasLista } from "@/components/performance-metas/RepMetasPortal";

export const Route = createFileRoute("/portal-rep")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Portal do Representante | PoolFlux" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: PortalRep,
});

type Tab = "responder" | "andamento" | "concluidas";
const TAB_OF: Record<ActionBoardColumn, Tab> = {
  sugerida: "responder",
  aguardando: "responder",
  aceita: "andamento",
  andamento: "andamento",
  concluida: "concluidas",
  recusada: "concluidas",
};
const TABS: { key: Tab; label: string }[] = [
  { key: "responder", label: "Aguardando minha resposta" },
  { key: "andamento", label: "Em andamento" },
  { key: "concluidas", label: "Concluídas / recusadas" },
];

function PortalRep() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const portalFn = useServerFn(getRepPortal);
  const [tab, setTab] = useState<Tab>("responder");

  const { data, isLoading, error } = useQuery({
    queryKey: ["rep-portal"],
    queryFn: () => portalFn(),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["rep-portal"] });

  const grouped = useMemo(() => {
    const g: Record<Tab, PortalAction[]> = { responder: [], andamento: [], concluidas: [] };
    for (const a of data?.actions ?? []) g[TAB_OF[boardColumnFor(a.status, a.acceptance)]].push(a);
    return g;
  }, [data]);

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-8" />
            <div>
              <h1 className="text-base font-semibold leading-tight">Portal do Representante</h1>
              {data && <p className="text-xs text-muted-foreground">{data.rep.nome}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut className="mr-1 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Estas ações são <strong>sugestões</strong>: você decide se aceita. Depois de aceitar,
          registre o andamento, anexe fotos, áudios ou vídeos e, se precisar, peça mais prazo.
        </p>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {error instanceof Error ? error.message : "Não foi possível carregar o portal."}
          </p>
        )}

        <RepMetasLista />

        {data && (
          <>
            <div className="flex flex-wrap gap-2" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition-colors",
                    tab === t.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted",
                  )}
                >
                  {t.label} ({grouped[t.key].length})
                </button>
              ))}
            </div>
            {!grouped[tab].length && (
              <p className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
                Nenhuma ação nesta aba.
              </p>
            )}
            {grouped[tab].map((a) => (
              <ActionCard key={a.id} a={a} onChanged={refresh} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function ActionCard({ a, onChanged }: { a: PortalAction; onChanged: () => void }) {
  const respondFn = useServerFn(repRespondSuggestion);
  const submitFn = useServerFn(repSubmitUpdate);
  const uploadFn = useServerFn(repCreateUpload);
  const [declining, setDeclining] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [status, setStatus] = useState<ActionStatus>(a.status);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<
    { path: string; name: string; mime: string | null; size: number }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [extOpen, setExtOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const d = daysUntil(a.due_date);
  const open = a.status !== "concluido";
  const late = open && d !== null && d < 0;
  const soon = open && d !== null && d >= 0 && d <= 5;
  const pendingExt = a.extensions.find((e) => e.status === "pendente");

  const respond = useMutation({
    mutationFn: (v: { decision: "aceita" | "recusada"; note?: string }) =>
      respondFn({ data: { cardId: a.id, ...v } }),
    onSuccess: () => {
      setDeclining(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          cardId: a.id,
          status: status !== a.status ? status : null,
          note: note || null,
          files,
        },
      }),
    onSuccess: () => {
      toast.success("Atualização enviada.");
      setNote("");
      setFiles([]);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    try {
      const added: typeof files = [];
      for (const file of Array.from(list)) {
        if (file.size > ACTION_MAX_FILE_BYTES) throw new Error(`"${file.name}" tem mais de 25MB.`);
        const { path, uploadToken } = await uploadFn({
          data: { cardId: a.id, fileName: file.name, size: file.size },
        });
        const { error } = await supabase.storage
          .from(ACTION_FILES_BUCKET)
          .uploadToSignedUrl(path, uploadToken, file, { contentType: file.type || undefined });
        if (error) throw new Error(`Falha ao enviar "${file.name}".`);
        added.push({ path, name: file.name, mime: file.type || null, size: file.size });
      }
      setFiles((f) => [...f, ...added]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar o arquivo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const canSubmit = !!note.trim() || files.length > 0 || status !== a.status;

  return (
    <section className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold leading-snug">{a.title}</h2>
          {a.client && <p className="text-xs text-muted-foreground">{a.client}</p>}
        </div>
        <Badge variant="secondary">{ACTION_STATUS_LABEL[a.status]}</Badge>
      </div>

      <p
        className={cn(
          "flex items-center gap-1 text-xs",
          late && "font-semibold text-destructive",
          soon && "font-semibold text-amber-600",
        )}
      >
        {(late || soon) && <AlertTriangle className="h-3 w-3" />}
        <CalendarClock className="h-3 w-3" />
        {a.due_date ? `Prazo ${formatPrazo(a.due_date)}` : "Sem prazo definido"}
        {soon ? (d === 0 ? " · vence hoje" : ` · em ${d} dia(s)`) : ""}
        {late ? ` · atrasada ${Math.abs(d!)} dia(s)` : ""}
      </p>

      {a.acceptance === "enviada" && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <p>
            Esta ação é uma <strong>sugestão</strong>. Você decide se aceita; prazos podem ser
            ajustados em conjunto com a equipe.
          </p>
          {declining ? (
            <div className="space-y-2">
              <Textarea
                placeholder="Se quiser, explique o motivo (opcional)…"
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ decision: "recusada", note: declineNote })}
                >
                  Confirmar recusa
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeclining(false)}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ decision: "aceita" })}
              >
                Aceitar sugestão
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDeclining(true)}>
                Recusar
              </Button>
            </div>
          )}
        </div>
      )}
      {a.acceptance === "recusada" && (
        <p className="text-xs text-muted-foreground">Você recusou esta sugestão.</p>
      )}

      {a.acceptance === "aceita" && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status">
            {ACTION_STATUSES.map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={status === s}
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm",
                  status === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {ACTION_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Comentário sobre o andamento…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="mr-1 h-4 w-4" />
              )}
              Anexar foto, áudio ou vídeo
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept="image/*,audio/*,video/*,.pdf"
              onChange={(e) => void addFiles(e.target.files)}
            />
            {files.map((f) => (
              <Badge key={f.path} variant="secondary" className="gap-1">
                {f.name}
                <button
                  aria-label="Remover"
                  onClick={() => setFiles((x) => x.filter((y) => y.path !== f.path))}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!canSubmit || submit.isPending || uploading}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              Enviar atualização
            </Button>
            {open && (
              <Button
                size="sm"
                variant="outline"
                disabled={!!pendingExt}
                onClick={() => setExtOpen(true)}
              >
                {pendingExt ? "Prorrogação aguardando resposta" : "Solicitar prorrogação"}
              </Button>
            )}
          </div>
        </div>
      )}

      {a.extensions.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {a.extensions.slice(0, 3).map((e) => (
            <li key={e.id}>
              Prorrogação para {formatPrazo(e.requested_due)} —{" "}
              {e.status === "pendente"
                ? "aguardando resposta"
                : e.status === "aprovada"
                  ? "aprovada"
                  : "recusada"}
              {e.decision_note ? ` (${e.decision_note})` : ""}
            </li>
          ))}
        </ul>
      )}

      {a.updates.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Histórico ({a.updates.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {a.updates.map((u) => (
              <li key={u.id} className="rounded-md bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleString("pt-BR")}
                  {u.status ? ` · ${ACTION_STATUS_LABEL[u.status]}` : ""}
                </p>
                {u.note && <p className="whitespace-pre-line">{u.note}</p>}
                {u.files.map((f) =>
                  f.url ? (
                    <a
                      key={f.id}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mr-2 text-xs underline"
                    >
                      {f.name}
                    </a>
                  ) : null,
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <ExtensionDialog open={extOpen} onOpenChange={setExtOpen} action={a} onDone={onChanged} />
    </section>
  );
}

function ExtensionDialog({
  open,
  onOpenChange,
  action,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  action: PortalAction;
  onDone: () => void;
}) {
  const fn = useServerFn(repRequestExtension);
  const [date, setDate] = useState("");
  const [why, setWhy] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { cardId: action.id, requestedDue: date, justification: why } }),
    onSuccess: () => {
      toast.success("Pedido enviado à equipe.");
      setDate("");
      setWhy("");
      onOpenChange(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar prorrogação</DialogTitle>
          <DialogDescription>
            {action.title}. Prazo atual: {formatPrazo(action.due_date)}. A equipe responde por
            e-mail.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Novo prazo sugerido</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Justificativa</label>
            <Textarea
              rows={4}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Explique o motivo do pedido…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!date || why.trim().length < 5 || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Enviar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
