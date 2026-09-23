export type EmailDirection = "outbound" | "inbound";

export type OutboxStatus = "pending" | "sent" | "delivered" | "failed" | "bounced" | "received";

export type SendEmailInput = {
  /** Chave estável por tentativa lógica de envio — usada tanto no outbox quanto no header do provider. */
  idempotencyKey: string;
  to: string[];
  cc?: string[];
  from: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Message-ID (RFC 5322) que este envio deve carregar, para permitir correlação de respostas. */
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  headers?: Record<string, string>;
  ticketId?: string | null;
  templateName?: string;
};

export type SendEmailResult = {
  providerMessageId: string;
  messageId: string;
};

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
