import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Tokens das ações públicas do e-mail (Confirmar recebimento, Marcar como em
 * análise, Solicitar informação, Responder, Informar conclusão). Espelha o
 * enum internal_ticket_action e a tabela internal_ticket_action_tokens
 * (migration 20260923090100): escopo da ação + ticket, expiração e proteção
 * contra reuso (used_at).
 *
 * Só o hash do token vai para o banco — o valor bruto só existe no link do
 * e-mail, nunca é persistido.
 */

export const TICKET_ACTIONS = [
  "confirmar_recebimento",
  "marcar_em_analise",
  "solicitar_informacao",
  "responder",
  "marcar_concluido",
] as const;

export type TicketAction = (typeof TICKET_ACTIONS)[number];

export const TICKET_ACTION_LABEL: Record<TicketAction, string> = {
  confirmar_recebimento: "Confirmar recebimento",
  marcar_em_analise: "Marcar como em análise",
  solicitar_informacao: "Solicitar informação ao Comercial",
  responder: "Responder",
  marcar_concluido: "Informar conclusão",
};

/** Ações cujo botão exige um texto (pedido de informação / resposta em si). */
export const TICKET_ACTION_REQUIRES_TEXT: Record<TicketAction, boolean> = {
  confirmar_recebimento: false,
  marcar_em_analise: false,
  solicitar_informacao: true,
  responder: true,
  marcar_concluido: false,
};

export function hashActionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateActionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("hex");
  return { rawToken, tokenHash: hashActionToken(rawToken) };
}

export type VerifyActionTokenInput = {
  rawToken: string;
  storedHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  now?: Date;
};

export type VerifyActionTokenResult =
  | { valid: true }
  | { valid: false; reason: "mismatch" | "used" | "expired" };

export function verifyActionToken(input: VerifyActionTokenInput): VerifyActionTokenResult {
  const providedHash = Buffer.from(hashActionToken(input.rawToken), "hex");
  const storedHash = Buffer.from(input.storedHash, "hex");
  if (providedHash.length !== storedHash.length || !timingSafeEqual(providedHash, storedHash)) {
    return { valid: false, reason: "mismatch" };
  }
  if (input.usedAt) return { valid: false, reason: "used" };
  if ((input.now ?? new Date()).getTime() > input.expiresAt.getTime()) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true };
}
