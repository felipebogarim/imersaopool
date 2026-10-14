import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/og-estrutura/$repId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rawId = (params as any)?.repId || "";
        const repId = String(rawId).replace(/\.png$/i, "").trim();

        // 1. Tentar buscar no storage via supabaseAdmin
        if (repId) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: fileData } = await supabaseAdmin.storage
              .from("product-images")
              .download(`og-estrutura/${repId}.png`);

            if (fileData) {
              const arrayBuf = await fileData.arrayBuffer();
              return new Response(arrayBuf, {
                status: 200,
                headers: {
                  "Content-Type": "image/png",
                  "Cache-Control": "public, max-age=86400, s-maxage=86400",
                },
              });
            }
          } catch {}
        }

        // 2. Fallback padrão: https://poolflux.app/og-charts/default.png (status 200 garantido)
        try {
          const defaultRes = await fetch("https://poolflux.app/og-charts/default.png");
          if (defaultRes.ok) {
            const defaultBuf = await defaultRes.arrayBuffer();
            return new Response(defaultBuf, {
              status: 200,
              headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
              },
            });
          }
        } catch {}

        return Response.redirect("https://poolflux.app/og-charts/default.png", 302);
      },

      POST: async ({ params, request }) => {
        const rawId = (params as any)?.repId || "";
        const repId = String(rawId).replace(/\.png$/i, "").trim();
        if (!repId) return Response.json({ error: "Missing repId" }, { status: 400 });

        try {
          const arrayBuffer = await request.arrayBuffer();
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Salvar no storage
          try {
            await supabaseAdmin.storage
              .from("product-images")
              .upload(`og-estrutura/${repId}.png`, arrayBuffer, { contentType: "image/png", upsert: true });
          } catch (e) {
            console.warn("Storage upload err:", e);
          }

          return Response.json({
            success: true,
            url: `https://poolflux.app/api/og-estrutura/${repId}.png`,
          });
        } catch (err: any) {
          return Response.json({ error: err?.message || "Failed" }, { status: 500 });
        }
      },
    },
  },
});
