// Server-only helper: enqueue a transactional email by calling the internal
// send route with the caller's Supabase bearer token.
import { getRequest } from "@tanstack/react-start/server";

export type SendEmailArgs = {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, unknown>;
};

export async function sendTransactionalEmail(args: SendEmailArgs): Promise<void> {
  try {
    const req = getRequest();
    const auth = req.headers.get("authorization");
    if (!auth) {
      console.warn("[email] no bearer available, skipping send", { template: args.templateName });
      return;
    }
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const r = await fetch(`${origin}/lovable/email/transactional/send`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: auth },
      body: JSON.stringify(args),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error("[email] send failed", { status: r.status, body: text, template: args.templateName });
    }
  } catch (err) {
    console.error("[email] send error", err);
  }
}
