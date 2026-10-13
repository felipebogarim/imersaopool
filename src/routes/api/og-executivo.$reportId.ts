import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/og-executivo/$reportId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rawId = (params as any)?.reportId || "";
        const reportId = String(rawId).replace(/\.png$/i, "").trim();

        // 1. Caso especial: Clara Iluminação já possui imagem estática dedicada
        if (reportId === "0ab3e2a1-f172-43a5-a633-9c347c09f06f") {
          try {
            const res = await fetch("https://poolflux.app/og-charts/0ab3e2a1-f172-43a5-a633-9c347c09f06f.png");
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
          } catch {}
        }

        // 2. Tentar buscar base64 salvo no structured_data de field_immersion_v2_reports
        if (reportId) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: rep } = await supabaseAdmin
              .from("field_immersion_v2_reports")
              .select("structured_data")
              .eq("id", reportId)
              .maybeSingle();

            const ogImg = (rep?.structured_data as any)?.og_chart_image;
            if (typeof ogImg === "string" && ogImg.startsWith("data:image/png;base64,")) {
              const base64Data = ogImg.replace(/^data:image\/png;base64,/, "");
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              return new Response(bytes, {
                status: 200,
                headers: {
                  "Content-Type": "image/png",
                  "Cache-Control": "public, max-age=86400, s-maxage=86400",
                },
              });
            }
          } catch (e) {
            console.warn("Falha ao recuperar structured_data em og-executivo:", e);
          }
        }

        // 3. Tentar buscar no storage via supabaseAdmin
        if (reportId) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: fileData } = await supabaseAdmin.storage
              .from("product-images")
              .download(`og-charts/${reportId}.png`);

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

        // 4. Fallback padrão: https://poolflux.app/og-charts/default.png (status 200 garantido)
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
        const rawId = (params as any)?.reportId || "";
        const reportId = String(rawId).replace(/\.png$/i, "").trim();
        if (!reportId) return Response.json({ error: "Missing reportId" }, { status: 400 });

        try {
          const arrayBuffer = await request.arrayBuffer();
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Salvar no storage
          try {
            await supabaseAdmin.storage
              .from("product-images")
              .upload(`og-charts/${reportId}.png`, arrayBuffer, { contentType: "image/png", upsert: true });
          } catch (e) {
            console.warn("Storage upload err:", e);
          }

          // Converter para base64 e salvar no structured_data de field_immersion_v2_reports
          try {
            let binary = "";
            const bytes = new Uint8Array(arrayBuffer);
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            const { data: rep } = await supabaseAdmin
              .from("field_immersion_v2_reports")
              .select("structured_data")
              .eq("id", reportId)
              .maybeSingle();

            if (rep) {
              const cur = (rep.structured_data as Record<string, unknown>) || {};
              await supabaseAdmin
                .from("field_immersion_v2_reports")
                .update({
                  structured_data: {
                    ...cur,
                    og_chart_image: `data:image/png;base64,${base64}`,
                  },
                })
                .eq("id", reportId);
            }
          } catch (e) {
            console.warn("DB update err:", e);
          }

          return Response.json({
            success: true,
            url: `https://poolflux.app/api/og-executivo/${reportId}.png`,
          });
        } catch (err: any) {
          return Response.json({ error: err?.message || "Failed" }, { status: 500 });
        }
      },
    },
  },
});
