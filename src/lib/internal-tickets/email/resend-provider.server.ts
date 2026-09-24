import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

const RESEND_API_URL = "https://api.resend.com/emails";

type ResendErrorResponse = { message?: string; name?: string };

const MAX_SEND_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeErrorDetail(value: unknown, apiKey: string): string {
  const detail = typeof value === "string" ? value : "sem detalhe";
  return detail.replaceAll(apiKey, "[REDACTED]").slice(0, 500);
}

function shouldRetry(status: number, errorName: string | undefined): boolean {
  return (
    status === 408 ||
    status >= 500 ||
    (status === 409 && errorName === "concurrent_idempotent_requests")
  );
}

function waitBeforeRetry(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * attempt));
}

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

    // Serializa uma única vez: o Resend exige payload idêntico para que a
    // mesma Idempotency-Key deduplique retries.
    const body = JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.cc?.length ? { cc: input.cc } : {}),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
      ...(input.attachments?.length
        ? {
            attachments: input.attachments.map((attachment) => ({
              filename: attachment.filename,
              content: attachment.content,
              content_type: attachment.contentType,
              ...(attachment.contentId ? { content_id: attachment.contentId } : {}),
            })),
          }
        : {}),
    });

    let lastError: Error = new Error("Resend send falhou sem resposta");
    for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": input.idempotencyKey,
          },
          body,
        });
      } catch {
        lastError = new Error("Resend send falhou por erro de rede");
        if (attempt < MAX_SEND_ATTEMPTS) {
          await waitBeforeRetry(attempt);
          continue;
        }
        throw lastError;
      }

      const responseBody: unknown = await response.json().catch(() => ({}));
      if (response.ok) {
        const providerMessageId = isRecord(responseBody) ? responseBody.id : null;
        if (typeof providerMessageId === "string" && providerMessageId.trim()) {
          return { providerMessageId, messageId: input.messageId ?? "" };
        }
        lastError = new Error("Resend respondeu sucesso sem um id de mensagem válido");
        if (attempt < MAX_SEND_ATTEMPTS) {
          await waitBeforeRetry(attempt);
          continue;
        }
        throw lastError;
      }

      const errorBody = isRecord(responseBody) ? (responseBody as ResendErrorResponse) : {};
      const errorName = typeof errorBody.name === "string" ? errorBody.name : undefined;
      const detail = sanitizeErrorDetail(errorBody.message, this.apiKey);
      lastError = new Error(
        `Resend send falhou [${response.status}${errorName ? ` ${errorName}` : ""}]: ${detail}`,
      );
      if (attempt < MAX_SEND_ATTEMPTS && shouldRetry(response.status, errorName)) {
        await waitBeforeRetry(attempt);
        continue;
      }
      throw lastError;
    }

    throw lastError;
  }
}
