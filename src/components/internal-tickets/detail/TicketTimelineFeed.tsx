import { useMemo } from "react";
import { Download, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAttachmentDownloadUrl,
  isAttachmentDownloadable,
} from "@/lib/internal-tickets/attachments";
import { TICKET_STATUS_LABEL } from "@/lib/internal-tickets/status";
import type {
  TicketAttachmentRow,
  TicketEventRow,
  TicketMessageRow,
} from "@/lib/internal-tickets/queries";
import { toast } from "sonner";

type Entry =
  | ({ kind: "event" } & TicketEventRow)
  | ({ kind: "message" } & TicketMessageRow)
  | ({ kind: "attachment" } & TicketAttachmentRow);

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function handleDownload(attachment: TicketAttachmentRow) {
  try {
    const url = await getAttachmentDownloadUrl(attachment.id);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Falha ao gerar link do anexo");
  }
}

export function TicketTimelineFeed({
  events,
  messages,
  attachments,
}: {
  events: TicketEventRow[];
  messages: TicketMessageRow[];
  attachments: TicketAttachmentRow[];
}) {
  const timeline = useMemo<Entry[]>(() => {
    const e: Entry[] = events.map((x) => ({ kind: "event", ...x }));
    const m: Entry[] = messages.map((x) => ({ kind: "message", ...x }));
    const a: Entry[] = attachments.map((x) => ({ kind: "attachment", ...x }));
    return [...e, ...m, ...a].sort(
      (x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime(),
    );
  }, [events, messages, attachments]);

  return (
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
          const attachmentAvailable = isAttachmentDownloadable(
            entry.scan_status,
            entry.storage_path,
          );
          return (
            <li key={`attachment-${entry.id}`} className="flex items-center gap-2 text-xs">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {new Date(entry.created_at).toLocaleString("pt-BR")} ·{" "}
              </span>
              <span>{entry.file_name}</span>
              <span className="text-muted-foreground">{formatBytes(entry.size_bytes)}</span>
              {!attachmentAvailable && (
                <span className="text-amber-700">
                  {entry.scan_status === "blocked" ? "Bloqueado" : "Verificação pendente"}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={!attachmentAvailable}
                onClick={() => handleDownload(entry)}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </li>
          );
        })}
        {!timeline.length && <li className="text-xs text-muted-foreground">Sem eventos ainda.</li>}
      </ul>
    </div>
  );
}
