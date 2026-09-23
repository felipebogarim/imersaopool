import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

/**
 * Provider em memória para testes e para o ambiente de teste da Fase 7
 * (nenhuma chamada de rede, nenhuma credencial). Guarda os envios recebidos
 * para asserção nos testes.
 */
export class FakeEmailProvider implements EmailProvider {
  readonly sent: SendEmailInput[] = [];
  private readonly failNextWith: Error | null;

  constructor(options?: { failNextWith?: Error }) {
    this.failNextWith = options?.failNextWith ?? null;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (this.failNextWith) throw this.failNextWith;
    this.sent.push(input);
    return { providerMessageId: `fake-${input.idempotencyKey}`, messageId: input.messageId ?? "" };
  }
}
