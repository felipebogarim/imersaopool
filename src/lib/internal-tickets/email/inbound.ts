import { collectReferences } from "./message-id";

/**
 * Parsing puro do payload de um evento de webhook da Resend — tanto
 * inbound ("email.received") quanto os de status de entrega
 * ("email.delivered", "email.bounced", ...). Isolado da rota HTTP pra dar
 * pra testar sem mockar request/DB.
 *
 * IMPORTANTE: os nomes de campo do payload inbound da Resend foram escritos
 * pelo conhecimento do modelo, sem uma chamada real de API pra conferir
 * (não há domínio/webhook configurado neste ambiente). Antes de ativar em
 * produção, validar contra um payload real de "email.received" e ajustar
 * normalizeHeaders/os nomes de campo se necessário.
 */

export type ResendWebhookEvent = {
  type: string;
  data: Record<string, unknown>;
};

export function parseResendWebhookEvent(raw: unknown): ResendWebhookEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.type !== "string") return null;
  const data =
    obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>) : {};
  return { type: obj.type, data };
}

export type ParsedInboundEmail = {
  emailId: string;
  receivedAt: string | null;
  from: string;
  to: string[];
  cc: string[];
  subject: string | null;
  text: string | null;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  headers: Record<string, string>;
  attachments: InboundAttachmentMetadata[];
  authentication: Record<string, unknown>;
};

export type InboundAttachmentMetadata = {
  id: string;
  filename: string;
  contentType: string | null;
  contentDisposition: string | null;
  contentId: string | null;
  size: number | null;
};

export function normalizeHeaders(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry && typeof entry === "object" && "name" in entry && "value" in entry) {
        const name = String((entry as { name: unknown }).name).toLowerCase();
        out[name] = String((entry as { value: unknown }).value);
      }
    }
    return out;
  }
  if (typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      out[key.toLowerCase()] = String(value);
    }
  }
  return out;
}

function parseAttachments(raw: unknown): InboundAttachmentMetadata[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const id = item.id ?? item.attachment_id;
    const filename = item.filename ?? item.file_name;
    if (typeof id !== "string" || typeof filename !== "string") return [];
    return [
      {
        id,
        filename,
        contentType: typeof item.content_type === "string" ? item.content_type : null,
        contentDisposition:
          typeof item.content_disposition === "string" ? item.content_disposition : null,
        contentId: typeof item.content_id === "string" ? item.content_id : null,
        size: typeof item.size === "number" ? item.size : null,
      },
    ];
  });
}

function toAddressList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

export function parseInboundEmailData(data: Record<string, unknown>): ParsedInboundEmail {
  const headers = normalizeHeaders(data.headers);
  const inReplyTo = headers["in-reply-to"] ?? (data.in_reply_to as string | undefined) ?? null;
  const references = headers["references"] ?? (data.references as string | undefined) ?? null;

  return {
    emailId: typeof data.email_id === "string" ? data.email_id : "",
    receivedAt: typeof data.created_at === "string" ? data.created_at : null,
    from: typeof data.from === "string" ? data.from : "",
    to: toAddressList(data.to),
    cc: toAddressList(data.cc),
    subject: typeof data.subject === "string" ? data.subject : null,
    text: typeof data.text === "string" ? data.text : null,
    html: typeof data.html === "string" ? data.html : null,
    messageId: headers["message-id"] ?? (data.message_id as string | undefined) ?? null,
    inReplyTo,
    references: collectReferences(inReplyTo, references),
    headers,
    attachments: parseAttachments(data.attachments),
    authentication:
      data.authentication && typeof data.authentication === "object"
        ? (data.authentication as Record<string, unknown>)
        : {},
  };
}
