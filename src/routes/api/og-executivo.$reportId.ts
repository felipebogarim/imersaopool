import { createFileRoute } from "@tanstack/react-router";
import fs from "node:fs/promises";
import path from "node:path";

export const Route = createFileRoute("/api/og-executivo/$reportId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rawId = (params as any)?.reportId || "";
        const reportId = String(rawId).replace(/\.png$/i, "").trim();

        const publicDir = path.resolve(process.cwd(), "public", "og-charts");

        // 1. Tenta carregar imagem específica no diretório estático público
        if (reportId) {
          const specificPath = path.join(publicDir, `${reportId}.png`);
          try {
            const buf = await fs.readFile(specificPath);
            return new Response(buf, {
              status: 200,
              headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
              },
            });
          } catch {
            // Continua para o Supabase
          }
        }

        // 2. Tenta carregar do Supabase Storage público (onde novos relatórios salvam)
        try {
          const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
          if (supabaseUrl && reportId) {
            const cleanUrl = supabaseUrl.replace(/\/+$/, "");
            const storageUrl = `${cleanUrl}/storage/v1/object/public/product-images/og-charts/${reportId}.png`;
            const res = await fetch(storageUrl);
            if (res.ok) {
              const arrayBuf = await res.arrayBuffer();
              return new Response(arrayBuf, {
                status: 200,
                headers: {
                  "Content-Type": "image/png",
                  "Cache-Control": "public, max-age=86400, s-maxage=86400",
                },
              });
            }
          }
        } catch {
          // Continua para o fallback padrão
        }

        // 3. Fallback: print padrão do Resultado por Família (default.png)
        try {
          const defaultPath = path.join(publicDir, "default.png");
          const defaultBuf = await fs.readFile(defaultPath);
          return new Response(defaultBuf, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=86400, s-maxage=86400",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
