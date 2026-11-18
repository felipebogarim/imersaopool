import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron diário (pg_cron/HTTP): avisa o representante, 5 dias antes do vencimento, das ações
 * sugeridas, com cópia aos gestores master. Mesma autorização dos outros hooks públicos.
 */
export const Route = createFileRoute("/api/public/hooks/action-due-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !anonKey || apikey !== anonKey) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const { runDueAlerts } = await import("@/lib/action-due-alerts.server");
        const results = await runDueAlerts();
        return Response.json({
          sent: results.filter((r) => r.sent).length,
          skipped: results.filter((r) => !r.sent).length,
        });
      },
    },
  },
});
