import { createHmac, timingSafeEqual } from "crypto";

/**
 * Endereço de resposta por ticket (reply+<token>@dominio), verificável sem
 * consulta ao banco: o token é o id do ticket + uma assinatura HMAC do
 * próprio id, recomputável a partir do segredo do módulo.
 *
 * Correlação secundária por Message-ID / In-Reply-To / References vive em
 * message-id.ts — o inbound (Fase 4) deve tentar o token primeiro e cair
 * para a correlação por cabeçalho quando o endereço de resposta não puder
 * ser lido (encaminhamentos, clientes de e-mail que reescrevem o From/To).
 */

function sign(ticketId: string, secret: string): string {
  return createHmac("sha256", secret).update(ticketId).digest("hex").slice(0, 24);
}

export function buildReplyToken(ticketId: string, secret: string): string {
  return `${ticketId}.${sign(ticketId, secret)}`;
}

export function buildReplyAddress(ticketId: string, secret: string, domain: string): string {
  return `reply+${buildReplyToken(ticketId, secret)}@${domain}`;
}

export type ReplyTokenParseResult =
  | { valid: true; ticketId: string }
  | { valid: false; ticketId: null };

export function parseReplyToken(token: string, secret: string): ReplyTokenParseResult {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === token.length - 1)
    return { valid: false, ticketId: null };

  const ticketId = token.slice(0, separatorIndex);
  const providedSignature = token.slice(separatorIndex + 1);
  const expectedSignature = sign(ticketId, secret);

  const provided = Buffer.from(providedSignature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  if (provided.length !== expected.length) return { valid: false, ticketId: null };
  if (!timingSafeEqual(provided, expected)) return { valid: false, ticketId: null };

  return { valid: true, ticketId };
}

/** Extrai o token de um endereço "reply+<token>@dominio"; null se não bater o padrão. */
export function extractReplyToken(address: string): string | null {
  const match = /^reply\+([^@]+)@/i.exec(address.trim());
  return match ? match[1] : null;
}
