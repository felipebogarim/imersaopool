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
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/public/mp/test/create-preference")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        // Gate global: ambiente de teste precisa estar ativado.
        if (process.env.MP_TEST_ENABLED !== "true") {
          return new Response("Not found", { status: 404 });
        }

        try {
          // Autorização: exige usuário autenticado com papel de admin.
          const authHeader = request.headers.get("authorization") ?? "";
          const bearer = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : "";
          if (!bearer) return json(401, { error: "Não autorizado" });

          const supaUrl = process.env.SUPABASE_URL;
          const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!supaUrl || !supaKey) return json(500, { error: "Backend não configurado" });

          const userResp = await fetch(`${supaUrl}/auth/v1/user`, {
            headers: { apikey: supaKey, Authorization: `Bearer ${bearer}` },
          });
          if (!userResp.ok) return json(401, { error: "Sessão inválida" });
          const userJson = (await userResp.json()) as { id?: string };
          const userId = userJson.id;
          if (!userId) return json(401, { error: "Sessão inválida" });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: roleRow } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();
          if (!roleRow) return json(403, { error: "Acesso restrito a administradores" });

          const parsed = bodySchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) {
            return json(400, { error: parsed.error.issues[0]?.message ?? "Dados inválidos" });
          }
          const { pacote, nome, email, telefone } = parsed.data;
          const pkg = PACOTES[pacote as keyof typeof PACOTES];

          const token = process.env.MP_TEST_ACCESS_TOKEN;
          if (!token) return json(500, { error: "MP_TEST_ACCESS_TOKEN ausente" });

          const { data: order, error: insertError } = await supabaseAdmin
            .from("event_orders_test")
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
            console.error("[mp/test/create-preference] insert falhou", insertError);
            return json(500, { error: "Não foi possível iniciar o pedido de teste" });
          }

          const origin = new URL(request.url).origin;
          const preferencePayload = {
            items: [
              {
                id: pkg.id,
                title: `[TESTE] ${pkg.titulo}`,
                description: pkg.periodo,
                quantity: 1,
                currency_id: "BRL",
                unit_price: pkg.valor,
              },
            ],
            payer: { name: nome, email: email.toLowerCase() },
            external_reference: order.id,
            statement_descriptor: "POOL TESTE",
            back_urls: {
              success: `${origin}/evento/checkout-teste?resultado=sucesso&order=${order.id}`,
              pending: `${origin}/evento/checkout-teste?resultado=pendente&order=${order.id}`,
              failure: `${origin}/evento/checkout-teste?resultado=falha&order=${order.id}`,
            },
            auto_return: "approved",
            notification_url: `${origin}/api/public/mp/test/webhook`,
            metadata: { order_id: order.id, pacote: pkg.id, env: "test" },
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
            console.error(`[mp/test/create-preference] MP falhou [${mpResp.status}]: ${mpBody}`);
            await supabaseAdmin.from("event_orders_test").update({ status: "rejected" }).eq("id", order.id);
            return json(502, { error: "Falha ao criar cobrança de teste no Mercado Pago" });
          }
          const mpJson = JSON.parse(mpBody) as { id?: string; init_point?: string; sandbox_init_point?: string };
          const initPoint = mpJson.sandbox_init_point ?? mpJson.init_point;
          if (!initPoint) return json(502, { error: "Resposta inválida do Mercado Pago" });

          await supabaseAdmin
            .from("event_orders_test")
            .update({ mp_preference_id: mpJson.id ?? null })
            .eq("id", order.id);

          return json(200, {
            order_id: order.id,
            preference_id: mpJson.id,
            init_point: initPoint,
          });
        } catch (err) {
          console.error("[mp/test/create-preference] erro inesperado", err);
          return json(500, { error: "Erro interno" });
        }
      },
    },
  },
});
