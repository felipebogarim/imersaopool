import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReplyAddress } from "./reply-address";
import { ResendEmailProvider } from "./resend-provider.server";
import type { SendEmailInput } from "./types";

const INPUT: SendEmailInput = {
  idempotencyKey: "ticket-opened:11111111-1111-4111-8111-111111111111",
  from: "Solicitações Internas <chamados@chamados.poolflux.app>",
  to: ["principal@example.com"],
  cc: ["copia@example.com"],
  replyTo: buildReplyAddress(
    "11111111-1111-4111-8111-111111111111",
    "test-secret",
    "chamados.poolflux.app",
  ),
  subject: "[SOL-000009] Teste",
  html: "<p>Teste</p>",
  text: "Teste",
  messageId: "<message@internal-tickets.local>",
};

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ResendEmailProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("preserva TO/CC, remetente, reply-to, Message-ID e envia a idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { id: "resend-message-id" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ResendEmailProvider("re_test_secret").send(INPUT);

    expect(result).toEqual({
      providerMessageId: "resend-message-id",
      messageId: INPUT.messageId,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: "Bearer re_test_secret",
      "Idempotency-Key": INPUT.idempotencyKey,
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: INPUT.from,
      to: INPUT.to,
      cc: INPUT.cc,
      reply_to: INPUT.replyTo,
      headers: { "Message-ID": INPUT.messageId },
    });
  });

  it("repete falha ambígua com a mesma chave e o mesmo payload", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("connection reset"))
      .mockResolvedValueOnce(response(200, { id: "same-resend-id" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new ResendEmailProvider("re_test_secret").send(INPUT)).resolves.toMatchObject({
      providerMessageId: "same-resend-id",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(fetchMock.mock.calls[1][1]?.body);
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(fetchMock.mock.calls[1][1]?.headers);
  });

  it("não repete erro definitivo e nunca expõe a API key na mensagem", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(400, { name: "validation_error", message: "re_test_secret" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new ResendEmailProvider("re_test_secret").send(INPUT)).rejects.toThrow(
      "[REDACTED]",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejeita resposta de sucesso sem provider message id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new ResendEmailProvider("re_test_secret").send(INPUT)).rejects.toThrow(
      "sem um id de mensagem válido",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
