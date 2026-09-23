import {
  buildReplyAddress,
  extractReplyToken,
  parseReplyToken,
  type ReplyTokenParseResult,
} from "./reply-address";
import { getReplyEnv } from "./email-mode.server";

/**
 * Wrapper server-only: lê os segredos do módulo do ambiente e delega a
 * lógica pura de reply-address.ts. Nunca importar este arquivo de um
 * arquivo de rota ou *.functions.ts fora de um handler/import dinâmico.
 */
export function buildReplyAddressForTicket(ticketId: string): string {
  return buildReplyAddress(
    ticketId,
    getReplyEnv("INTERNAL_TICKETS_REPLY_SECRET"),
    getReplyEnv("INTERNAL_TICKETS_REPLY_DOMAIN"),
  );
}

export function parseReplyAddress(address: string): ReplyTokenParseResult {
  const token = extractReplyToken(address);
  if (!token) return { valid: false, ticketId: null };
  return parseReplyToken(token, getReplyEnv("INTERNAL_TICKETS_REPLY_SECRET"));
}
