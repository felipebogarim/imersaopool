import { createHmac, timingSafeEqual } from "crypto";

/**
 * Endereço de resposta por ticket (r+<token>@dominio), verificável sem
 * consulta ao banco: o token é o id do ticket + uma assinatura HMAC do
 * próprio id, recomputável a partir do segredo do módulo.
 *
 * Message-ID / In-Reply-To / References servem somente ao threading. O
 * inbound identifica o ticket exclusivamente por este endereço assinado e
 * nunca aceita subject, header de correlação ou ticket_id livre como prova.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPACT_UUID_PATTERN = /^[0-9a-f]{32}$/i;
const SIGNATURE_PATTERN = /^[0-9a-f]{24}$/i;

function compactTicketId(ticketId: string): string {
  if (!UUID_PATTERN.test(ticketId)) throw new Error("ticketId inválido para endereço de resposta");
  return ticketId.replaceAll("-", "").toLowerCase();
}

function restoreTicketId(compactId: string): string {
  return [
    compactId.slice(0, 8),
    compactId.slice(8, 12),
    compactId.slice(12, 16),
    compactId.slice(16, 20),
    compactId.slice(20),
  ].join("-");
}

function sign(compactId: string, secret: string): string {
  return createHmac("sha256", secret).update(compactId).digest("hex").slice(0, 24);
}

export function buildReplyToken(ticketId: string, secret: string): string {
  const compactId = compactTicketId(ticketId);
  return `${compactId}.${sign(compactId, secret)}`;
}

export function buildReplyAddress(ticketId: string, secret: string, domain: string): string {
  return `r+${buildReplyToken(ticketId, secret)}@${domain}`;
}

export type ReplyTokenParseResult =
  | { valid: true; ticketId: string }
  | { valid: false; ticketId: null };

export function parseReplyToken(token: string, secret: string): ReplyTokenParseResult {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === token.length - 1)
    return { valid: false, ticketId: null };

  const compactId = token.slice(0, separatorIndex);
  const providedSignature = token.slice(separatorIndex + 1);
  if (!COMPACT_UUID_PATTERN.test(compactId) || !SIGNATURE_PATTERN.test(providedSignature)) {
    return { valid: false, ticketId: null };
  }
  const expectedSignature = sign(compactId.toLowerCase(), secret);

  const provided = Buffer.from(providedSignature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  if (provided.length !== expected.length) return { valid: false, ticketId: null };
  if (!timingSafeEqual(provided, expected)) return { valid: false, ticketId: null };

  return { valid: true, ticketId: restoreTicketId(compactId.toLowerCase()) };
}

/** Extrai o token de um endereço "r+<token>@dominio"; null se não bater o padrão. */
export function extractReplyToken(address: string): string | null {
  const match = /^r\+([^@]+)@/i.exec(address.trim());
  return match ? match[1] : null;
}
