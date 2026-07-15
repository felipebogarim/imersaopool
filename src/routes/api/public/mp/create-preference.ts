import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PACOTES, isPacoteId } from "@/lib/mp-config";

const bodySchema = z.object({
  pacote: z.string().refine(isPacoteId, "Pacote inválido"),
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  email: z.string().trim().email("E-mail inválido").max(160),
  telefone: z.string().trim().max(40).optional().nullable(),
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/mp/create-preference")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        try {
          const json = await request.json().catch(() => null);
          const parsed = bodySchema.safeParse(json);
          if (!parsed.success) {
            return new Response(
              JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }),
              { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
            );
          }
          const { pacote, nome, email, telefone } = parsed.data;
          const pkg = PACOTES[pacote as keyof typeof PACOTES];

          const token = process.env.MP_ACCESS_TOKEN;
          if (!token) {
            console.error("[mp/create-preference] MP_ACCESS_TOKEN ausente");
            return new Response(
              JSON.stringify({ error: "Meio de pagamento indisponível no momento" }),
              { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: order, error: insertError } = await supabaseAdmin
            .from("event_orders")
            .insert({
              pacote: pkg.id,
              pacote_titulo: pkg.titulo,
              valor: pkg.valor,
              participante_nome: nome,
              participante_email: email.toLowerCase(),
              participante_telefone: telefone ?? null,
              status: "pending",
            })
            .select("id")
            .single();

          if (insertError || !order) {
            console.error("[mp/create-preference] insert falhou", insertError);
            return new Response(
              JSON.stringify({ error: "Não foi possível iniciar seu pedido" }),
              { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
            );
          }

          const origin = new URL(request.url).origin;
          const preferencePayload = {
            items: [
              {
                id: pkg.id,
                title: pkg.titulo,
                description: pkg.periodo,
                quantity: 1,
                currency_id: "BRL",
                unit_price: pkg.valor,
              },
            ],
            payer: { name: nome, email: email.toLowerCase() },
            external_reference: order.id,
            statement_descriptor: "Simplesmente Terapias",
            back_urls: {
              success: `${origin}/evento/sucesso?order=${order.id}`,
              pending: `${origin}/evento/pendente?order=${order.id}`,
              failure: `${origin}/evento/falha?order=${order.id}`,
            },
            auto_return: "approved",
            notification_url: `${origin}/api/public/mp/webhook`,
            metadata: { order_id: order.id, pacote: pkg.id },
          };

          const mpResp = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "X-Idempotency-Key": order.id,
            },
            body: JSON.stringify(preferencePayload),
          });
          const mpBody = await mpResp.text();
          if (!mpResp.ok) {
            console.error(`[mp/create-preference] MP falhou [${mpResp.status}]: ${mpBody}`);
            await supabaseAdmin.from("event_orders").update({ status: "rejected" }).eq("id", order.id);
            return new Response(
              JSON.stringify({ error: "Falha ao criar cobrança no Mercado Pago" }),
              { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
            );
          }
          const mpJson = JSON.parse(mpBody) as { id?: string; init_point?: string; sandbox_init_point?: string };
          if (!mpJson.init_point) {
            console.error("[mp/create-preference] MP sem init_point:", mpBody);
            return new Response(
              JSON.stringify({ error: "Resposta inválida do Mercado Pago" }),
              { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
            );
          }

          await supabaseAdmin
            .from("event_orders")
            .update({ mp_preference_id: mpJson.id ?? null })
            .eq("id", order.id);

          return new Response(
            JSON.stringify({
              order_id: order.id,
              preference_id: mpJson.id,
              init_point: mpJson.init_point,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
          );
        } catch (err) {
          console.error("[mp/create-preference] erro inesperado", err);
          return new Response(
            JSON.stringify({ error: "Erro interno" }),
            { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
          );
        }
      },
    },
  },
});
