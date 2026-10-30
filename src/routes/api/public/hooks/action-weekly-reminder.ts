import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron semanal (pg_cron/HTTP): envia ao representante o link do formulário de atualização
 * das ações em aberto. Mesma autorização dos outros hooks públicos (header apikey = anon key).
 * Representantes cobrados há menos de 6 dias são ignorados (idempotência).
 */
export const Route = createFileRoute("/api/public/hooks/action-weekly-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !anonKey || apikey !== anonKey) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const { runActionRequests } = await import("@/lib/action-tracking.server");
        const results = await runActionRequests();
        return Response.json({
          sent: results.filter((r) => r.sent).length,
          skipped: results.filter((r) => !r.sent).length,
        });
      },
    },
  },
});
