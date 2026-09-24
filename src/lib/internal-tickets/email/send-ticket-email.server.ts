import { render } from "@react-email/render";
import * as React from "react";
import { getReplyEnv } from "./email-mode.server";
import { generateMessageId } from "./message-id";
import { getEmailProvider } from "./provider-factory.server";
import { buildReplyAddressForTicket } from "./reply-address.server";
import { TicketOpenedEmail, type TicketOpenedEmailProps } from "./templates/ticket-opened";
import type { EmailProvider } from "./types";
import type { EmailAttachment } from "./types";
import { loadNewlineInlineAssets } from "./newline-inline-assets.server";

export type SendTicketOpenedEmailInput = TicketOpenedEmailProps & {
  ticketId: string;
  idempotencyKey?: string;
  messageId?: string | null;
  to: string[];
  cc?: string[];
};

/**
 * Renderiza o template e chama o provider. Preparação/finalização da outbox
 * e transição do ticket pertencem ao orquestrador autenticado.
 */
export const TICKET_OPENED_KEY_PREFIX = "ticket-opened:";
export const TICKET_OPENED_SUBJECT = "Solicitação interna Newline";

/** Identidade de saída do e-mail de abertura — usada também pela criação atômica (outbox pending). */
export function buildTicketOpenedIdentity() {
  const domain = getReplyEnv("INTERNAL_TICKETS_REPLY_DOMAIN");
  return {
    sender: `Solicitações Internas Newline <chamados@${domain}>`,
    messageId: generateMessageId(domain),
  };
}

export async function sendTicketOpenedEmail(
  input: SendTicketOpenedEmailInput,
  providerOverride?: EmailProvider,
  inlineAssetsOverride?: EmailAttachment[],
): Promise<{ providerMessageId: string; messageId: string; alreadySent: boolean }> {
  if (!input.to.length) {
    throw new Error(`Nenhum destinatário configurado para o setor ${input.sectorName}`);
  }

  const idempotencyKey = input.idempotencyKey ?? `${TICKET_OPENED_KEY_PREFIX}${input.ticketId}`;
  const { sender: from, messageId: generatedMessageId } = buildTicketOpenedIdentity();
  const messageId = input.messageId ?? generatedMessageId;
  const replyTo = buildReplyAddressForTicket(input.ticketId);
  const subject = TICKET_OPENED_SUBJECT;

  const element = React.createElement(TicketOpenedEmail, input);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  const attachments = inlineAssetsOverride ?? (await loadNewlineInlineAssets());

  const provider = providerOverride ?? (await getEmailProvider());
  const result = await provider.send({
    idempotencyKey,
    to: input.to,
    cc: input.cc,
    from,
    subject,
    html,
    text,
    replyTo,
    messageId,
    ticketId: input.ticketId,
    templateName: "ticket-opened",
    attachments,
  });
  return { ...result, alreadySent: false };
}
