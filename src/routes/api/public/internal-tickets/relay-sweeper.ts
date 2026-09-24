import { createFileRoute } from "@tanstack/react-router";
import { authorizeInternalTicketSweeper } from "@/lib/internal-tickets/email/sweeper-auth.server";

// Schema incremental ainda não está no types.ts gerado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (client: unknown): any => client;

export const Route = createFileRoute("/api/public/internal-tickets/relay-sweeper")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorizeInternalTicketSweeper(request.headers.get("authorization"))) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // A leitura inofensiva comprova que a credencial privilegiada existe
          // e funciona sem expor presença, formato ou conteúdo do secret.
          const admin = db(supabaseAdmin);
          const { error: probeError } = await admin
            .from("internal_ticket_relay_deliveries")
            .select("id")
            .limit(1);
          if (probeError) throw new Error(probeError.message);

          const { sweepRecoverableRelays } =
            await import("@/lib/internal-tickets/email/inbound-processing.server");
          const result = await sweepRecoverableRelays(admin);
          return Response.json({ ok: true, ...result });
        } catch (error) {
          console.error("[internal-tickets/relay-sweeper] falha", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
