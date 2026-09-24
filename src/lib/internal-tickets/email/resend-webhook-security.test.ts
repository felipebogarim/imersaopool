import { Webhook } from "svix";
import { describe, expect, it } from "vitest";
import { parseResendWebhookEvent } from "./inbound";
import { verifyAndParseResendWebhook, type SvixHeaders } from "./resend-webhook-security";

const SECRET = "whsec_dGVzdC1pbnRlcm5hbC10aWNrZXRzLXNlY3JldA==";

function signed(payload: unknown, timestamp = new Date()) {
  const raw = JSON.stringify(payload);
  const webhook = new Webhook(SECRET);
  const id = "msg_real_svix_signature";
  const headers: SvixHeaders = {
    "svix-id": id,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": webhook.sign(id, timestamp, raw),
  };
  return { raw, headers };
}

describe("Resend webhook Svix", () => {
  it.each(["email.received", "email.delivered"])(
    "valida raw body e entrega %s ao parser",
    (type) => {
      const input = signed({ type, data: { email_id: "email_123" } });
      const event = parseResendWebhookEvent(
        verifyAndParseResendWebhook(input.raw, input.headers, SECRET),
      );
      expect(event).toMatchObject({ type, data: { email_id: "email_123" } });
    },
  );

  it("rejeita assinatura inválida", () => {
    const input = signed({ type: "email.received", data: {} });
    expect(() =>
      verifyAndParseResendWebhook(
        input.raw,
        { ...input.headers, "svix-signature": "v1,bad" },
        SECRET,
      ),
    ).toThrow();
  });

  it("rejeita timestamp fora da tolerância", () => {
    const input = signed(
      { type: "email.received", data: {} },
      new Date(Date.now() - 6 * 60 * 1000),
    );
    expect(() => verifyAndParseResendWebhook(input.raw, input.headers, SECRET)).toThrow(
      /timestamp too old/i,
    );
  });

  it("aceita replay criptográfico para a camada persistente deduplicar", () => {
    const input = signed({ type: "email.received", data: { email_id: "same" } });
    expect(verifyAndParseResendWebhook(input.raw, input.headers, SECRET)).toEqual(
      verifyAndParseResendWebhook(input.raw, input.headers, SECRET),
    );
  });
});
