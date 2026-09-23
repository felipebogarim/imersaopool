import { createFileRoute } from "@tanstack/react-router";
import { Webhook } from "svix";
import {
  parseInboundEmailData,
  parseResendWebhookEvent,
  type ParsedInboundEmail,
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

        // NOTA: "email.received" é o nome de evento inbound assumido a partir
        // da documentação da Resend, sem uma chamada real pra confirmar (sem
        // domínio/webhook configurado neste ambiente). Validar contra um
        // payload real antes de ativar em produção.
        if (event.type === "email.received") {
          return handleInbound(supabase, parseInboundEmailData(event.data));
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

  const { error } = await supabase
    .from("internal_ticket_email_outbox")
    .update({ status: newStatus })
    .eq("provider_message_id", providerMessageId);

  if (error) {
    console.error("[internal-tickets/resend-webhook] falha ao atualizar outbox", error);
    return new Response("db update failed", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}

async function handleInbound(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  parsed: ParsedInboundEmail,
): Promise<Response> {
  const { parseReplyAddress } = await import("@/lib/internal-tickets/email/reply-address.server");

  let ticketId: string | null = null;
  for (const address of parsed.to) {
    const result = parseReplyAddress(address);
    if (result.valid) {
      ticketId = result.ticketId;
      break;
    }
  }

  if (!ticketId) {
    const candidates = [parsed.inReplyTo, ...parsed.references].filter((v): v is string =>
      Boolean(v),
    );
    if (candidates.length) {
      const { data: viaMessage } = await supabase
        .from("internal_ticket_messages")
        .select("ticket_id")
        .in("message_id", candidates)
        .limit(1)
        .maybeSingle();
      ticketId = viaMessage?.ticket_id ?? null;

      if (!ticketId) {
        const { data: viaOutbox } = await supabase
          .from("internal_ticket_email_outbox")
          .select("ticket_id")
          .in("message_id", candidates)
          .limit(1)
          .maybeSingle();
        ticketId = viaOutbox?.ticket_id ?? null;
      }
    }
  }

  // Loga o inbound no outbox antes de processar — idempotency_key pelo
  // Message-ID garante que um retry do webhook (Resend reenvia em falha)
  // não duplique a mensagem: a segunda tentativa esbarra na constraint
  // unique(idempotency_key) e devolvemos 200 sem reprocessar.
  const { error: outboxError } = await supabase.from("internal_ticket_email_outbox").insert({
    direction: "inbound",
    idempotency_key: parsed.messageId ?? `inbound:${crypto.randomUUID()}`,
    ticket_id: ticketId,
    status: "received",
    sender_email: parsed.from,
    subject: parsed.subject,
    message_id: parsed.messageId,
    in_reply_to: parsed.inReplyTo,
    reference_ids: parsed.references,
    raw_payload: parsed,
  });

  if (outboxError) {
    if (outboxError.code === "23505") {
      return new Response("duplicate, already processed", { status: 200 });
    }
    console.error("[internal-tickets/resend-webhook] falha ao logar outbox inbound", outboxError);
    return new Response("db insert failed", { status: 500 });
  }

  if (!ticketId) {
    console.warn("[internal-tickets/resend-webhook] resposta inbound sem correlação de ticket", {
      from: parsed.from,
      to: parsed.to,
      messageId: parsed.messageId,
    });
    return new Response("ok", { status: 200 });
  }

  const { sanitizeInboundHtml } = await import("@/lib/internal-tickets/sanitize-html");
  const { error: messageError } = await supabase.from("internal_ticket_messages").insert({
    ticket_id: ticketId,
    direction: "inbound",
    origin: "email",
    sender_email: parsed.from,
    subject: parsed.subject,
    body_html: parsed.html ? sanitizeInboundHtml(parsed.html) : null,
    body_text: parsed.text,
    message_id: parsed.messageId,
    in_reply_to: parsed.inReplyTo,
  });
  if (messageError) {
    console.error(
      "[internal-tickets/resend-webhook] falha ao gravar mensagem inbound",
      messageError,
    );
    return new Response("db insert failed", { status: 500 });
  }

  const { error: eventError } = await supabase.from("internal_ticket_events").insert({
    ticket_id: ticketId,
    origin: "email",
    observation: `Resposta recebida por e-mail de ${parsed.from}`,
  });
  if (eventError) {
    console.error("[internal-tickets/resend-webhook] falha ao logar evento inbound", eventError);
  }

  return new Response("ok", { status: 200 });
}
