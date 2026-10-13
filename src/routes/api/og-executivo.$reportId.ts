import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/og-executivo/$reportId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rawId = (params as any)?.reportId || "";
        const reportId = String(rawId).replace(/\.png$/i, "").trim();

        // 1. Tenta carregar imagem específica no diretório estático público
        const targetUrl =
          reportId === "0ab3e2a1-f172-43a5-a633-9c347c09f06f"
            ? "https://poolflux.app/og-charts/0ab3e2a1-f172-43a5-a633-9c347c09f06f.png"
            : `https://poolflux.app/og-charts/${reportId || "default"}.png`;

        try {
          const res = await fetch(targetUrl);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            return new Response(buf, {
              status: 200,
              headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
              },
            });
          }
        } catch {
          // Continua para o fallback padrão
        }

        // 2. Fallback: print padrão do Resultado por Família (default.png)
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
        } catch {
          // Continua
        }

        // 3. Fallback final: Redirecionamento 302 direto para o asset estático
        return Response.redirect("https://poolflux.app/og-charts/default.png", 302);
      },
    },
  },
});
