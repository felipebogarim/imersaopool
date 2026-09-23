import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

const RESEND_API_URL = "https://api.resend.com/emails";

type ResendSendResponse = { id: string };
type ResendErrorResponse = { message?: string; name?: string };

/**
 * Adapter Resend. Não conhece tickets, outbox nem templates — recebe um
 * e-mail pronto (SendEmailInput) e usa o header Idempotency-Key oficial da
 * Resend para que retries não dupliquem envio do lado do provider (o outbox
 * cobre a idempotência do lado da nossa aplicação).
 */
export class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string;

  constructor(apiKey: string = process.env.RESEND_API_KEY ?? "") {
    if (!apiKey) throw new Error("RESEND_API_KEY não configurada");
    this.apiKey = apiKey;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const headers: Record<string, string> = { ...input.headers };
    if (input.messageId) headers["Message-ID"] = input.messageId;
    if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
    if (input.references?.length) headers["References"] = input.references.join(" ");

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.cc?.length ? { cc: input.cc } : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(Object.keys(headers).length ? { headers } : {}),
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ResendErrorResponse;
      throw new Error(`Resend send falhou [${response.status}]: ${body.message ?? "sem detalhe"}`);
    }

    const data = (await response.json()) as ResendSendResponse;
    return { providerMessageId: data.id, messageId: input.messageId ?? "" };
  }
}
