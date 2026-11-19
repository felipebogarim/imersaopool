import { createFileRoute } from "@tanstack/react-router";

/**
 * Imagem de prévia (WhatsApp/redes) do link público do Relatório Geral importado: o print do
 * gráfico "Resultado geral". Só é servida para quem tem o token do link público ativo.
 */
export const Route = createFileRoute("/api/og-relatorio/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String((params as { token?: string })?.token ?? "")
          .replace(/\.png$/i, "")
          .trim();
        if (!/^[a-f0-9]{48}$/.test(token)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;
        const { data: r } = await admin
          .from("general_reports")
          .select("id")
          .eq("share_token", token)
          .eq("status", "pronto")
          .maybeSingle();
        if (!r?.id) return new Response("Not found", { status: 404 });
        const { data: file } = await admin.storage
          .from("general-reports")
          .download(`${r.id}/og-resultado-geral.png`);
        if (!file) return new Response("Not found", { status: 404 });
        return new Response(await file.arrayBuffer(), {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=300, s-maxage=300",
          },
        });
      },
    },
  },
});
