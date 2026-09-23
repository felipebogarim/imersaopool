import {
  buildReplyAddress,
  extractReplyToken,
  parseReplyToken,
  type ReplyTokenParseResult,
} from "./reply-address";

/**
 * Wrapper server-only: lê os segredos do módulo do ambiente e delega a
 * lógica pura de reply-address.ts. Nunca importar este arquivo de um
 * arquivo de rota ou *.functions.ts fora de um handler/import dinâmico.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada`);
  return value;
}

export function buildReplyAddressForTicket(ticketId: string): string {
  return buildReplyAddress(
    ticketId,
    requireEnv("INTERNAL_TICKETS_REPLY_SECRET"),
    requireEnv("INTERNAL_TICKETS_REPLY_DOMAIN"),
  );
}

export function parseReplyAddress(address: string): ReplyTokenParseResult {
  const token = extractReplyToken(address);
  if (!token) return { valid: false, ticketId: null };
  return parseReplyToken(token, requireEnv("INTERNAL_TICKETS_REPLY_SECRET"));
}
