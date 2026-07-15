import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

type MpPaymentStatus = "approved" | "pending" | "in_process" | "rejected" | "cancelled" | "refunded" | "charged_back";

function mapStatus(s: string | undefined): "approved" | "pending" | "rejected" | "cancelled" | "in_process" | "refunded" {
  switch (s) {
    case "approved": return "approved";
    case "in_process": return "in_process";
    case "rejected": return "rejected";
    case "cancelled": return "cancelled";
    case "refunded":
    case "charged_back": return "refunded";
    default: return "pending";
  }
}

function verifySignature(request: Request, dataId: string | null): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[mp/webhook] MP_WEBHOOK_SECRET ausente — rejeitando");
    return false;
  }
  const sigHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  if (!sigHeader || !requestId || !dataId) return false;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/mp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const rawBody = await request.text();
        let body: any = null;
        try { body = rawBody ? JSON.parse(rawBody) : null; } catch { body = null; }

        // Mercado Pago envia o id do recurso em body.data.id ou nos query params
        const dataIdFromBody = body?.data?.id ? String(body.data.id) : null;
        const dataIdFromQuery = url.searchParams.get("data.id") ?? url.searchParams.get("id");
        const dataId = dataIdFromBody ?? dataIdFromQuery;
        const topic = body?.type ?? body?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");

        if (!verifySignature(request, dataId)) {
          console.warn("[mp/webhook] assinatura inválida", { dataId, topic });
          return new Response("Invalid signature", { status: 401 });
        }

        if (topic !== "payment" || !dataId) {
          // Outros tópicos (merchant_order, plans, etc.) — respondemos 200 sem processar
          return new Response("ignored", { status: 200 });
        }

        const token = process.env.MP_ACCESS_TOKEN;
        if (!token) {
          console.error("[mp/webhook] MP_ACCESS_TOKEN ausente");
          return new Response("Missing token", { status: 500 });
        }

        const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const mpText = await mpResp.text();
        if (!mpResp.ok) {
          console.error(`[mp/webhook] consulta MP falhou [${mpResp.status}]: ${mpText}`);
          // Retornar 500 faz o MP reenviar
          return new Response("MP fetch failed", { status: 500 });
        }
        const payment = JSON.parse(mpText) as {
          id: number | string;
          status: MpPaymentStatus;
          status_detail?: string;
          payment_method_id?: string;
          payment_type_id?: string;
          transaction_amount?: number;
          date_approved?: string | null;
          external_reference?: string | null;
        };

        const orderId = payment.external_reference;
        if (!orderId) {
          console.warn("[mp/webhook] pagamento sem external_reference", payment.id);
          return new Response("no external_reference", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order, error: orderErr } = await supabaseAdmin
          .from("event_orders")
          .select("id, status, mp_payment_id, valor")
          .eq("id", orderId)
          .maybeSingle();

        if (orderErr || !order) {
          console.warn("[mp/webhook] pedido não encontrado", orderId, orderErr);
          return new Response("order not found", { status: 200 });
        }

        // Idempotência: se já processamos exatamente este payment_id com status final, apenas confirma.
        if (order.mp_payment_id === String(payment.id) && order.status !== "pending" && order.status !== "in_process") {
          return new Response("already processed", { status: 200 });
        }

        const newStatus = mapStatus(payment.status);
        const isApproval = newStatus === "approved";

        const updates = {
          status: newStatus,
          mp_payment_id: String(payment.id),
          payment_method: payment.payment_method_id ?? payment.payment_type_id ?? null,
          raw: payment as unknown as Record<string, unknown>,
          ...(isApproval ? { paid_at: payment.date_approved ?? new Date().toISOString() } : {}),
        };

        const { error: updErr } = await supabaseAdmin
          .from("event_orders")
          .update(updates)
          .eq("id", orderId);

        if (updErr) {
          console.error("[mp/webhook] update falhou", updErr);
          return new Response("db update failed", { status: 500 });
        }

        // TODO(email): quando o domínio de envio estiver configurado, disparar e-mail de
        // confirmação para participante_email marcando confirmation_email_sent_at.
        if (isApproval) {
          console.info(`[mp/webhook] pagamento aprovado — pedido ${orderId} (payment ${payment.id})`);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
