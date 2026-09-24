import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./reply-address.server", () => ({
  buildReplyAddressForTicket: (ticketId: string) => `reply+${ticketId}.fake@chamados.poolflux.app`,
}));

const BASE_INPUT = {
  ticketId: "11111111-1111-1111-1111-111111111111",
  ticketNumber: "SOL-000001",
  title: "Pintura especial",
  description: "Cliente pediu pintura customizada",
  sectorName: "Engenharia",
  categoryName: "Customização de produto",
  priorityLabel: "Alta",
  requesterName: "Felipe",
  dueAtLabel: null,
  idempotencyKey: "ticket-opened:11111111-1111-1111-1111-111111111111",
  messageId: "<persisted@internal-tickets.local>",
  to: ["setor@fornecedor.com"],
};

describe("sendTicketOpenedEmail", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("envia pelo provider recebido sem acessar banco ou outbox", async () => {
    vi.stubEnv("INTERNAL_TICKETS_REPLY_DOMAIN", "chamados.poolflux.app");
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const { FakeEmailProvider } = await import("./fake-provider");
    const provider = new FakeEmailProvider();

    const result = await sendTicketOpenedEmail(BASE_INPUT, provider);

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({
      idempotencyKey: BASE_INPUT.idempotencyKey,
      messageId: BASE_INPUT.messageId,
      to: ["setor@fornecedor.com"],
      replyTo: `reply+${BASE_INPUT.ticketId}.fake@chamados.poolflux.app`,
    });
    expect(result.providerMessageId).toBe(`fake-${BASE_INPUT.idempotencyKey}`);
  });

  it("propaga falha do provider para o orquestrador registrar", async () => {
    vi.stubEnv("INTERNAL_TICKETS_REPLY_DOMAIN", "chamados.poolflux.app");
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const { FakeEmailProvider } = await import("./fake-provider");
    const provider = new FakeEmailProvider({ failNextWith: new Error("Provider indisponível") });

    await expect(sendTicketOpenedEmail(BASE_INPUT, provider)).rejects.toThrow(
      "Provider indisponível",
    );
  });

  it("rejeita antes do provider quando não há destinatário", async () => {
    vi.stubEnv("INTERNAL_TICKETS_REPLY_DOMAIN", "chamados.poolflux.app");
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const { FakeEmailProvider } = await import("./fake-provider");
    const provider = new FakeEmailProvider();

    await expect(sendTicketOpenedEmail({ ...BASE_INPUT, to: [] }, provider)).rejects.toThrow(
      "Nenhum destinatário configurado",
    );
    expect(provider.sent).toHaveLength(0);
  });
});
