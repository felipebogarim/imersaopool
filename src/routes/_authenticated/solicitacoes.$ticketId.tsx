import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Paperclip } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getInternalTicket,
  listCategories,
  listProfilesByIds,
  listSectors,
  listTicketAttachments,
  listTicketEvents,
  listTicketMessages,
  listTicketRecipients,
  type TicketAttachmentRow,
  type TicketEventRow,
  type TicketMessageRow,
} from "@/lib/internal-tickets/queries";
import {
  getAttachmentDownloadUrl,
  uploadTicketAttachment,
} from "@/lib/internal-tickets/attachments";
import {
  allowedNextStatuses,
  TICKET_STATUS_LABEL,
  type TicketStatus,
} from "@/lib/internal-tickets/status";
import { TICKET_PRIORITY_LABEL } from "@/lib/internal-tickets/priority";
import {
  updateInternalTicketStatus,
  logManualInteraction,
} from "@/lib/internal-tickets/tickets.functions";

export const Route = createFileRoute("/_authenticated/solicitacoes/$ticketId")({
  head: () => ({ meta: [{ title: "Ticket — Solicitações Internas — PoolFlux" }] }),
  component: TicketDetailPage,
});

type TimelineEntry =
  | ({ kind: "event" } & TicketEventRow)
  | ({ kind: "message" } & TicketMessageRow)
  | ({ kind: "attachment" } & TicketAttachmentRow);

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TicketDetailPage() {
  const { ticketId } = Route.useParams();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ticketQuery = useQuery({
    queryKey: ["internal-ticket", ticketId],
    queryFn: () => getInternalTicket(ticketId),
  });
  const sectorsQuery = useQuery({ queryKey: ["internal-ticket-sectors"], queryFn: listSectors });
  const categoriesQuery = useQuery({
    queryKey: ["internal-ticket-categories"],
    queryFn: listCategories,
  });
  const recipientsQuery = useQuery({
    queryKey: ["internal-ticket-recipients", ticketId],
    queryFn: () => listTicketRecipients(ticketId),
  });
  const eventsQuery = useQuery({
    queryKey: ["internal-ticket-events", ticketId],
    queryFn: () => listTicketEvents(ticketId),
  });
  const messagesQuery = useQuery({
    queryKey: ["internal-ticket-messages", ticketId],
    queryFn: () => listTicketMessages(ticketId),
  });
  const attachmentsQuery = useQuery({
    queryKey: ["internal-ticket-attachments", ticketId],
    queryFn: () => listTicketAttachments(ticketId),
  });
  const ticket = ticketQuery.data;
  const profilesQuery = useQuery({
    queryKey: [
      "internal-ticket-profiles",
      ticket?.requester_user_id,
      ticket?.commercial_owner_user_id,
    ],
    queryFn: () => listProfilesByIds([ticket!.requester_user_id, ticket!.commercial_owner_user_id]),
    enabled: Boolean(ticket),
  });

  const [statusTarget, setStatusTarget] = useState<TicketStatus | "">("");
  const [statusObservation, setStatusObservation] = useState("");
  const [interactionChannel, setInteractionChannel] = useState<
    "manual_presencial" | "manual_telefone"
  >("manual_presencial");
  const [interactionNote, setInteractionNote] = useState("");
  const [uploading, setUploading] = useState(false);

  function invalidateTicket() {
    qc.invalidateQueries({ queryKey: ["internal-ticket", ticketId] });
    qc.invalidateQueries({ queryKey: ["internal-ticket-events", ticketId] });
    qc.invalidateQueries({ queryKey: ["internal-tickets"] });
  }

  const statusMutation = useMutation({
    mutationFn: () =>
      updateInternalTicketStatus({
        data: {
          ticketId,
          toStatus: statusTarget as TicketStatus,
          observation: statusObservation.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Status atualizado");
      setStatusTarget("");
      setStatusObservation("");
      invalidateTicket();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar status"),
  });

  const interactionMutation = useMutation({
    mutationFn: () =>
      logManualInteraction({
        data: { ticketId, channel: interactionChannel, note: interactionNote.trim() },
      }),
    onSuccess: () => {
      toast.success("Interação registrada");
      setInteractionNote("");
      qc.invalidateQueries({ queryKey: ["internal-ticket-messages", ticketId] });
      qc.invalidateQueries({ queryKey: ["internal-ticket-events", ticketId] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao registrar interação"),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      await uploadTicketAttachment(ticketId, file);
      toast.success("Anexo enviado");
      qc.invalidateQueries({ queryKey: ["internal-ticket-attachments", ticketId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar anexo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDownload(attachment: TicketAttachmentRow) {
    try {
      const url = await getAttachmentDownloadUrl(attachment.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar link do anexo");
    }
  }

  const timeline = useMemo<TimelineEntry[]>(() => {
    const events: TimelineEntry[] = (eventsQuery.data ?? []).map((e) => ({ kind: "event", ...e }));
    const messages: TimelineEntry[] = (messagesQuery.data ?? []).map((m) => ({
      kind: "message",
      ...m,
    }));
    const attachments: TimelineEntry[] = (attachmentsQuery.data ?? []).map((a) => ({
      kind: "attachment",
      ...a,
    }));
    return [...events, ...messages, ...attachments].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [eventsQuery.data, messagesQuery.data, attachmentsQuery.data]);

  const sectorName = sectorsQuery.data?.find((s) => s.id === ticket?.sector_id)?.name ?? "—";
  const categoryName = categoriesQuery.data?.find((c) => c.id === ticket?.category_id)?.name ?? "—";
  const requesterName =
    profilesQuery.data?.find((p) => p.id === ticket?.requester_user_id)?.full_name ?? "—";
  const ownerName =
    profilesQuery.data?.find((p) => p.id === ticket?.commercial_owner_user_id)?.full_name ?? "—";

  if (ticketQuery.isLoading || !ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
      </div>
    );
  }

  const nextStatuses = allowedNextStatuses(ticket.status);

  return (
    <div className="min-h-screen bg-background pb-10">
      <PageHeader
        title={ticket.title}
        subtitle={ticket.ticket_number}
        actions={
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/solicitacoes">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{TICKET_STATUS_LABEL[ticket.status]}</Badge>
          <Badge variant="outline">{TICKET_PRIORITY_LABEL[ticket.priority]}</Badge>
          <Badge variant="outline">{sectorName}</Badge>
          <Badge variant="outline">{categoryName}</Badge>
        </div>

        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{ticket.description}</p>

        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <p>
            Solicitante: <span className="text-foreground">{requesterName}</span>
          </p>
          <p>
            Responsável comercial: <span className="text-foreground">{ownerName}</span>
          </p>
        </div>

        {recipientsQuery.data && recipientsQuery.data.length > 0 && (
          <div className="rounded-lg border p-3 text-xs">
            <p className="mb-1 font-medium text-muted-foreground">Destinatários</p>
            <ul className="space-y-0.5">
              {recipientsQuery.data.map((r) => (
                <li key={r.id}>
                  {r.name_snapshot ?? r.email} ({r.email}) — {r.role}
                </li>
              ))}
            </ul>
          </div>
        )}

        {nextStatuses.length > 0 && (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mudar status
            </p>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusTarget === s ? "default" : "outline"}
                  onClick={() => setStatusTarget(s)}
                >
                  {TICKET_STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
            {statusTarget && (
              <div className="space-y-2">
                <Textarea
                  value={statusObservation}
                  onChange={(e) => setStatusObservation(e.target.value)}
                  placeholder="Observação (opcional)"
                  rows={2}
                />
                <Button
                  size="sm"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate()}
                >
                  {statusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar {TICKET_STATUS_LABEL[statusTarget]}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Registrar interação manual
          </p>
          <Select
            value={interactionChannel}
            onValueChange={(v) => setInteractionChannel(v as typeof interactionChannel)}
          >
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual_presencial">Presencial</SelectItem>
              <SelectItem value="manual_telefone">Telefone</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={interactionNote}
            onChange={(e) => setInteractionNote(e.target.value)}
            placeholder="O que foi conversado?"
            rows={3}
          />
          <Button
            size="sm"
            disabled={!interactionNote.trim() || interactionMutation.isPending}
            onClick={() => interactionMutation.mutate()}
          >
            {interactionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Anexos
          </p>
          <input
            ref={fileInputRef}
            type="file"
            className="text-xs"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          {uploading && <p className="text-xs text-muted-foreground">Enviando…</p>}
        </div>

        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Linha do tempo
          </p>
          <ul className="space-y-2">
            {timeline.map((entry) => {
              if (entry.kind === "event") {
                return (
                  <li key={`event-${entry.id}`} className="text-xs">
                    <span className="text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("pt-BR")} ·{" "}
                    </span>
                    {entry.to_status ? TICKET_STATUS_LABEL[entry.to_status] : "Evento"}
                    {entry.observation && (
                      <span className="block text-muted-foreground">{entry.observation}</span>
                    )}
                  </li>
                );
              }
              if (entry.kind === "message") {
                return (
                  <li key={`message-${entry.id}`} className="rounded-md bg-muted/40 p-2 text-xs">
                    <span className="text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("pt-BR")}
                      {entry.sender_email ? ` · ${entry.sender_email}` : ""}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap">{entry.body_text ?? "(sem texto)"}</p>
                  </li>
                );
              }
              return (
                <li key={`attachment-${entry.id}`} className="flex items-center gap-2 text-xs">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString("pt-BR")} ·{" "}
                  </span>
                  <span>{entry.file_name}</span>
                  <span className="text-muted-foreground">{formatBytes(entry.size_bytes)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDownload(entry)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
            {!timeline.length && (
              <li className="text-xs text-muted-foreground">Sem eventos ainda.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
