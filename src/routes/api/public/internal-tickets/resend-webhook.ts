import { createFileRoute } from "@tanstack/react-router";
import { Webhook } from "svix";
import {
  parseResendWebhookEvent,
  type ResendWebhookEvent,
} from "@/lib/internal-tickets/email/inbound";

// internal_ticket_* ainda não está no types.ts gerado — mesma ressalva do
// resto do módulo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: unknown): any {
  return supabase;
}

const DELIVERY_STATUS_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "sent",
  "email.bounced": "bounced",
  "email.complained": "bounced",
  "email.failed": "failed",
};

export const Route = createFileRoute("/api/public/internal-tickets/resend-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_WEBHOOK_SECRET;
        if (!secret) {
          console.error("[internal-tickets/resend-webhook] RESEND_WEBHOOK_SECRET ausente");
          return new Response("Missing webhook secret", { status: 500 });
        }

        const rawBody = await request.text();
        const svixHeaders = {
          "svix-id": request.headers.get("svix-id") ?? "",
          "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
          "svix-signature": request.headers.get("svix-signature") ?? "",
        };

        if (!svixHeaders["svix-id"]) return new Response("Missing event id", { status: 400 });

        let payload: unknown;
        try {
          payload = new Webhook(secret).verify(rawBody, svixHeaders);
        } catch (err) {
          console.warn("[internal-tickets/resend-webhook] assinatura inválida", err);
          return new Response("Invalid signature", { status: 401 });
        }

        const event = parseResendWebhookEvent(payload);
        if (!event) return new Response("ignored", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const supabase = db(supabaseAdmin);

        if (event.type === "email.received") {
          try {
            const { processResendInboundEvent } =
              await import("@/lib/internal-tickets/email/inbound-processing.server");
            const result = await processResendInboundEvent(supabase, svixHeaders["svix-id"], event);
            return Response.json(result, { status: 200 });
          } catch (error) {
            console.error("[internal-tickets/resend-webhook] falha inbound", error);
            // Resend retries non-2xx responses. DB leases + provider email_id
            // make this safe under retries and concurrent deliveries.
            return new Response("inbound processing failed", { status: 500 });
          }
        }

        return handleDeliveryStatus(supabase, event);
      },
    },
  },
});

async function handleDeliveryStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  event: ResendWebhookEvent,
): Promise<Response> {
  const newStatus = DELIVERY_STATUS_MAP[event.type];
  if (!newStatus) return new Response("ignored", { status: 200 }); // ex.: email.opened, email.clicked

  const providerMessageId = typeof event.data.email_id === "string" ? event.data.email_id : null;
  if (!providerMessageId) return new Response("no email_id", { status: 200 });
  const providerRfcMessageId =
    typeof event.data.message_id === "string" ? event.data.message_id : null;
  const deliveryUpdate = {
    status: newStatus,
    ...(providerRfcMessageId ? { message_id: providerRfcMessageId } : {}),
  };

  const { error } = await supabase
    .from("internal_ticket_email_outbox")
    .update(deliveryUpdate)
    .eq("provider_message_id", providerMessageId);

  if (error) {
    console.error("[internal-tickets/resend-webhook] falha ao atualizar outbox", error);
    return new Response("db update failed", { status: 500 });
  }

  const { error: relayError } = await supabase
    .from("internal_ticket_relay_deliveries")
    .update(deliveryUpdate)
    .eq("provider_message_id", providerMessageId);
  if (relayError) {
    console.error("[internal-tickets/resend-webhook] falha ao atualizar relay", relayError);
    return new Response("db update failed", { status: 500 });
  }
  if (providerRfcMessageId) {
    const { error: messageError } = await supabase
      .from("internal_ticket_messages")
      .update({ message_id: providerRfcMessageId })
      .eq("provider", "resend")
      .eq("provider_email_id", providerMessageId)
      .eq("direction", "outbound");
    if (messageError) {
      console.error(
        "[internal-tickets/resend-webhook] falha ao atualizar Message-ID",
        messageError,
      );
      return new Response("db update failed", { status: 500 });
    }
  }
  return new Response("ok", { status: 200 });
}
