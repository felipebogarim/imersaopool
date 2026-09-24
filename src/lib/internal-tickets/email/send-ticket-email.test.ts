import { afterEach, describe, expect, it, vi } from "vitest";

const BASE_INPUT = {
  ticketId: "11111111-1111-4111-8111-111111111111",
  ticketNumber: "SOL-000001",
  title: "Pintura especial",
  description: "Cliente pediu pintura customizada",
  sectorName: "Engenharia",
  categoryName: "Customização de produto",
  priorityLabel: "Alta",
  requesterName: "Felipe",
  recipientName: "Marina",
  dueAtLabel: null,
  idempotencyKey: "ticket-opened:11111111-1111-1111-1111-111111111111",
  messageId: "<persisted@internal-tickets.local>",
  to: ["setor@fornecedor.com"],
};

describe("sendTicketOpenedEmail", () => {
  afterEach(() => vi.unstubAllEnvs());

  function stubReplyEnv() {
    vi.stubEnv("INTERNAL_TICKETS_REPLY_DOMAIN", "chamados.poolflux.app");
    vi.stubEnv("INTERNAL_TICKETS_REPLY_SECRET", "test-secret");
  }

  it("envia ao provider o replyTo real sem mockar o builder", async () => {
    stubReplyEnv();
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const { FakeEmailProvider } = await import("./fake-provider");
    const provider = new FakeEmailProvider();

    const result = await sendTicketOpenedEmail(BASE_INPUT, provider);

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({
      idempotencyKey: BASE_INPUT.idempotencyKey,
      messageId: BASE_INPUT.messageId,
      to: ["setor@fornecedor.com"],
      subject: "Solicitação interna Newline",
      replyTo: "r+11111111111141118111111111111111.ca7f5bbf73c0fa729b246b6d@chamados.poolflux.app",
    });
    expect(result.providerMessageId).toBe(`fake-${BASE_INPUT.idempotencyKey}`);
  });

  it("renderiza a identidade e os textos Newline no HTML", async () => {
    stubReplyEnv();
    vi.stubEnv("PUBLIC_SITE_URL", "https://app.newline.example");
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const { FakeEmailProvider } = await import("./fake-provider");
    const provider = new FakeEmailProvider();

    await sendTicketOpenedEmail(BASE_INPUT, provider);

    expect(provider.sent[0]?.html).toContain("logo-newline.png");
    expect(provider.sent[0]?.html).toContain("icon-newline.png");
    expect(provider.sent[0]?.html).toContain("Quem solicita:");
    expect(provider.sent[0]?.html).toContain("Destinatário:");
    expect(provider.sent[0]?.html).toContain("Newline · Solicitações Internas");
  });

  it("propaga falha do provider para o orquestrador registrar", async () => {
    stubReplyEnv();
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const { FakeEmailProvider } = await import("./fake-provider");
    const provider = new FakeEmailProvider({ failNextWith: new Error("Provider indisponível") });

    await expect(sendTicketOpenedEmail(BASE_INPUT, provider)).rejects.toThrow(
      "Provider indisponível",
    );
  });

  it("rejeita antes do provider quando não há destinatário", async () => {
    stubReplyEnv();
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const { FakeEmailProvider } = await import("./fake-provider");
    const provider = new FakeEmailProvider();

    await expect(sendTicketOpenedEmail({ ...BASE_INPUT, to: [] }, provider)).rejects.toThrow(
      "Nenhum destinatário configurado",
    );
    expect(provider.sent).toHaveLength(0);
  });
});
