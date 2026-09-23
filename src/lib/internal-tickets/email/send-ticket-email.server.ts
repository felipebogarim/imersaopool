import { render } from "@react-email/render";
import * as React from "react";
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
export async function sendTicketOpenedEmail(
  input: SendTicketOpenedEmailInput,
  provider: EmailProvider = getEmailProvider(),
): Promise<{ providerMessageId: string; messageId: string }> {
  if (!input.to.length) {
    throw new Error(`Nenhum destinatário configurado para o setor ${input.sectorName}`);
  }

  const domain = requireEnv("INTERNAL_TICKETS_REPLY_DOMAIN");
  const idempotencyKey = `ticket-opened:${input.ticketId}`;
  const messageId = generateMessageId(domain);
  const replyTo = buildReplyAddressForTicket(input.ticketId);
  const from = `Solicitações Internas <chamados@${domain}>`;
  const subject = `[${input.ticketNumber}] ${input.title}`;

  const element = React.createElement(TicketOpenedEmail, input);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);

  await recordOutboundAttempt({
    idempotencyKey,
    ticketId: input.ticketId,
    templateName: "ticket-opened",
    recipientEmail: [...input.to, ...(input.cc ?? [])].join(", "),
    senderEmail: from,
    subject,
    messageId,
  });

  try {
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
    return result;
  } catch (err) {
    await markOutboxFailed(idempotencyKey, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada`);
  return value;
}
