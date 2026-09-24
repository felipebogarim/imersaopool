import { describe, expect, it } from "vitest";
import { parseInboundEmailData, parseResendWebhookEvent } from "./inbound";

describe("parseResendWebhookEvent", () => {
  it("aceita um payload com type e data", () => {
    const event = parseResendWebhookEvent({ type: "email.delivered", data: { email_id: "abc" } });
    expect(event).toEqual({ type: "email.delivered", data: { email_id: "abc" } });
  });

  it("usa objeto data vazio quando ausente", () => {
    const event = parseResendWebhookEvent({ type: "email.sent" });
    expect(event).toEqual({ type: "email.sent", data: {} });
  });

  it("rejeita payload sem type", () => {
    expect(parseResendWebhookEvent({ data: {} })).toBeNull();
    expect(parseResendWebhookEvent(null)).toBeNull();
    expect(parseResendWebhookEvent("string")).toBeNull();
  });
});

describe("parseInboundEmailData", () => {
  it("lê headers no formato array [{name, value}]", () => {
    const parsed = parseInboundEmailData({
      from: "setor@fornecedor.com",
      to: ["r+11111111111141118111111111111111.0123456789abcdef01234567@chamados.poolflux.app"],
      subject: "Re: [SOL-000001] título",
      text: "corpo",
      headers: [
        { name: "Message-ID", value: "<reply-1@fornecedor.com>" },
        { name: "In-Reply-To", value: "<orig@chamados.poolflux.app>" },
      ],
    });
    expect(parsed.from).toBe("setor@fornecedor.com");
    expect(parsed.to).toEqual([
      "r+11111111111141118111111111111111.0123456789abcdef01234567@chamados.poolflux.app",
    ]);
    expect(parsed.messageId).toBe("<reply-1@fornecedor.com>");
    expect(parsed.inReplyTo).toBe("<orig@chamados.poolflux.app>");
    expect(parsed.references).toEqual(["<orig@chamados.poolflux.app>"]);
  });

  it("lê headers no formato objeto {nome: valor}", () => {
    const parsed = parseInboundEmailData({
      from: "a@b.com",
      to: "r+22222222222242228222222222222222.89abcdef0123456789abcdef@chamados.poolflux.app",
      headers: { "Message-ID": "<m1@b.com>", References: "<r1@x> <r2@x>" },
    });
    expect(parsed.to).toEqual([
      "r+22222222222242228222222222222222.89abcdef0123456789abcdef@chamados.poolflux.app",
    ]);
    expect(parsed.messageId).toBe("<m1@b.com>");
    expect(parsed.references).toEqual(["<r1@x>", "<r2@x>"]);
  });

  it("aceita to como string única e devolve lista com um item", () => {
    const parsed = parseInboundEmailData({ to: "single@chamados.poolflux.app" });
    expect(parsed.to).toEqual(["single@chamados.poolflux.app"]);
  });

  it("tolera payload sem headers/campos opcionais", () => {
    const parsed = parseInboundEmailData({});
    expect(parsed).toEqual({
      from: "",
      to: [],
      subject: null,
      text: null,
      html: null,
      messageId: null,
      inReplyTo: null,
      references: [],
    });
  });
});
