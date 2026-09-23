import { render } from "@react-email/render";
import * as React from "react";
import { getReplyEnv } from "./email-mode.server";
import { generateMessageId } from "./message-id";
import { markOutboxFailed, markOutboxSent, recordOutboundAttempt } from "./outbox.server";
import { getEmailProvider } from "./provider-factory.server";
import { buildReplyAddressForTicket } from "./reply-address.server";
import { TicketOpenedEmail, type TicketOpenedEmailProps } from "./templates/ticket-opened";
import type { EmailProvider } from "./types";

export type SendTicketOpenedEmailInput = TicketOpenedEmailProps & {
  ticketId: string;
  to: string[];
  cc?: string[];
};

/**
 * Renderiza o template, registra a tentativa no outbox (idempotente por
 * ticket) e envia via Resend. Alteração do ticket (status "enviado", etc.)
 * é responsabilidade de quem chama esta função — ela só cuida do e-mail.
 */
export const TICKET_OPENED_KEY_PREFIX = "ticket-opened:";

/** Identidade de saída do e-mail de abertura — usada também pela criação atômica (outbox pending). */
export function buildTicketOpenedIdentity() {
  const domain = getReplyEnv("INTERNAL_TICKETS_REPLY_DOMAIN");
  return {
    sender: `Solicitações Internas <chamados@${domain}>`,
    messageId: generateMessageId(domain),
  };
}

export async function sendTicketOpenedEmail(
  input: SendTicketOpenedEmailInput,
  providerOverride?: EmailProvider,
): Promise<{ providerMessageId: string; messageId: string; alreadySent: boolean }> {
  if (!input.to.length) {
    throw new Error(`Nenhum destinatário configurado para o setor ${input.sectorName}`);
  }

  const idempotencyKey = `${TICKET_OPENED_KEY_PREFIX}${input.ticketId}`;
  const { sender: from, messageId: generatedMessageId } = buildTicketOpenedIdentity();
  const replyTo = buildReplyAddressForTicket(input.ticketId);
  const subject = `[${input.ticketNumber}] ${input.title}`;

  const element = React.createElement(TicketOpenedEmail, input);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);

  const outboxRow = await recordOutboundAttempt({
    idempotencyKey,
    ticketId: input.ticketId,
    templateName: "ticket-opened",
    recipientEmail: [...input.to, ...(input.cc ?? [])].join(", "),
    senderEmail: from,
    subject,
    messageId: generatedMessageId,
  });
  // Retry: reaproveita o Message-ID já registrado; se já saiu, não reenvia.
  const messageId = outboxRow.message_id ?? generatedMessageId;
  if (outboxRow.status === "sent" || outboxRow.status === "delivered") {
    return { providerMessageId: outboxRow.provider_message_id ?? "", messageId, alreadySent: true };
  }

  try {
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
    });
    await markOutboxSent(idempotencyKey, result.providerMessageId);
    return { ...result, alreadySent: false };
  } catch (err) {
    await markOutboxFailed(idempotencyKey, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
