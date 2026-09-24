import { Webhook } from "svix";

export type SvixHeaders = {
  "svix-id": string;
  "svix-timestamp": string;
  "svix-signature": string;
};

/**
 * svix@2.5 valida assinatura e tolerância de timestamp, mas seu wrapper
 * Webhook.verify retorna void. O JSON só é interpretado depois da validação.
 */
export function verifyAndParseResendWebhook(
  rawBody: string,
  headers: SvixHeaders,
  secret: string,
): unknown {
  new Webhook(secret).verify(rawBody, headers);
  return JSON.parse(rawBody) as unknown;
}
