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
  from: string;
  to: string[];
  subject: string | null;
  text: string | null;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
};

function normalizeHeaders(raw: unknown): Record<string, string> {
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
    from: typeof data.from === "string" ? data.from : "",
    to: toAddressList(data.to),
    subject: typeof data.subject === "string" ? data.subject : null,
    text: typeof data.text === "string" ? data.text : null,
    html: typeof data.html === "string" ? data.html : null,
    messageId: headers["message-id"] ?? (data.message_id as string | undefined) ?? null,
    inReplyTo,
    references: collectReferences(inReplyTo, references),
  };
}
