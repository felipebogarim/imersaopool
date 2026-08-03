import { createServerFn } from "@tanstack/react-start";

/** Gera link temporário para o PDF de um manual publicado (acesso público). */
export const getManualPdfUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: manual, error } = await supabaseAdmin
      .from("manuais")
      .select("pdf_path, publicado")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!manual?.publicado || !manual.pdf_path) return { url: null as string | null };

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("manuais")
      .createSignedUrl(manual.pdf_path, 60 * 30);
    if (sErr) throw new Error(sErr.message);
    return { url: signed?.signedUrl ?? null };
  });
