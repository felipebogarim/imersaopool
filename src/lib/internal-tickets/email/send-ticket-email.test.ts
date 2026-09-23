import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordOutboundAttempt = vi.fn().mockResolvedValue({ id: "outbox-1" });
const markOutboxSent = vi.fn().mockResolvedValue(undefined);
const markOutboxFailed = vi.fn().mockResolvedValue(undefined);

vi.mock("./outbox.server", () => ({
  recordOutboundAttempt: (...args: unknown[]) => recordOutboundAttempt(...args),
  markOutboxSent: (...args: unknown[]) => markOutboxSent(...args),
  markOutboxFailed: (...args: unknown[]) => markOutboxFailed(...args),
}));

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
  to: ["setor@fornecedor.com"],
};

describe("sendTicketOpenedEmail", () => {
  beforeEach(() => {
    vi.stubEnv("INTERNAL_TICKETS_REPLY_DOMAIN", "chamados.poolflux.app");
    recordOutboundAttempt.mockClear();
    markOutboxSent.mockClear();
    markOutboxFailed.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registra a tentativa no outbox antes de enviar e marca como enviado no sucesso", async () => {
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const { FakeEmailProvider } = await import("./fake-provider");
    const provider = new FakeEmailProvider();

    const result = await sendTicketOpenedEmail(BASE_INPUT, provider);

    expect(recordOutboundAttempt).toHaveBeenCalledTimes(1);
    expect(recordOutboundAttempt.mock.calls[0][0]).toMatchObject({
      idempotencyKey: `ticket-opened:${BASE_INPUT.ticketId}`,
      ticketId: BASE_INPUT.ticketId,
      templateName: "ticket-opened",
      recipientEmail: "setor@fornecedor.com",
    });

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toEqual(["setor@fornecedor.com"]);
    expect(provider.sent[0].replyTo).toBe(
      `reply+${BASE_INPUT.ticketId}.fake@chamados.poolflux.app`,
    );

    expect(markOutboxSent).toHaveBeenCalledWith(
      `ticket-opened:${BASE_INPUT.ticketId}`,
      result.providerMessageId,
    );
    expect(markOutboxFailed).not.toHaveBeenCalled();
  });

  it("junta destinatários principais e em cópia no log do outbox", async () => {
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const { FakeEmailProvider } = await import("./fake-provider");

    await sendTicketOpenedEmail(
      { ...BASE_INPUT, cc: ["cc1@x.com", "cc2@x.com"] },
      new FakeEmailProvider(),
    );

    expect(recordOutboundAttempt.mock.calls[0][0].recipientEmail).toBe(
      "setor@fornecedor.com, cc1@x.com, cc2@x.com",
    );
  });

  it("marca falho e propaga o erro quando o provider rejeita", async () => {
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const { FakeEmailProvider } = await import("./fake-provider");
    const failure = new Error("Resend indisponível");
    const provider = new FakeEmailProvider({ failNextWith: failure });

    await expect(sendTicketOpenedEmail(BASE_INPUT, provider)).rejects.toThrow(
      "Resend indisponível",
    );

    expect(markOutboxFailed).toHaveBeenCalledWith(
      `ticket-opened:${BASE_INPUT.ticketId}`,
      "Resend indisponível",
    );
    expect(markOutboxSent).not.toHaveBeenCalled();
  });

  it("rejeita antes de qualquer efeito quando não há destinatário", async () => {
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const { FakeEmailProvider } = await import("./fake-provider");

    await expect(
      sendTicketOpenedEmail({ ...BASE_INPUT, to: [] }, new FakeEmailProvider()),
    ).rejects.toThrow("Nenhum destinatário configurado");
    expect(recordOutboundAttempt).not.toHaveBeenCalled();
  });
});

describe("sendTicketOpenedEmail — modo mock e retry", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("mock sem RESEND_API_KEY nem domínio/segredo de reply: envia via Fake e marca sent", async () => {
    vi.stubEnv("INTERNAL_TICKETS_EMAIL_MODE", "mock");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("INTERNAL_TICKETS_REPLY_DOMAIN", "");
    markOutboxSent.mockClear();
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const r = await sendTicketOpenedEmail(BASE_INPUT);
    expect(r.providerMessageId).toMatch(/^fake-/);
    expect(markOutboxSent).toHaveBeenCalled();
  });

  it("outbox já 'sent' → não reenvia", async () => {
    recordOutboundAttempt.mockResolvedValueOnce({
      id: "o",
      status: "sent",
      provider_message_id: "p1",
      message_id: "m1",
    });
    vi.stubEnv("INTERNAL_TICKETS_REPLY_DOMAIN", "chamados.poolflux.app");
    const { sendTicketOpenedEmail } = await import("./send-ticket-email.server");
    const { FakeEmailProvider } = await import("./fake-provider");
    const provider = new FakeEmailProvider();
    const r = await sendTicketOpenedEmail(BASE_INPUT, provider);
    expect(r.alreadySent).toBe(true);
    expect(provider.sent).toHaveLength(0);
  });
});
