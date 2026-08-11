import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-ipel-export")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const rot = "ba35c7c8-a16d-413a-9710-2e7d9333a462";
        const sess = "5d676f2f-3f9b-46bb-922f-cd2d024e61c0";
        const { data: caps } = await supabaseAdmin
          .from("capitulos")
          .select("id, ordem, titulo")
          .eq("roteiro_id", rot)
          .order("ordem");
        const { data: rows } = await supabaseAdmin
          .from("sessao_capitulos")
          .select("capitulo_id, leitura_estrategica, sintese")
          .eq("sessao_id", sess);
        return Response.json({ caps, rows });
      },
    },
  },
});
