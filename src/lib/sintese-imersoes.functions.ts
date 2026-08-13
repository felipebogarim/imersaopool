import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Immersion2DataSchema } from "@/lib/visao-imersao-2-parser";
import { imersaoToLentes } from "@/lib/imersao-sintese-map";
import { LENTES } from "@/lib/insight-lentes";

/**
 * Reprocessa os relatórios Visão Imersão 2 já armazenados
 * (field_immersion_v2_reports) como fontes de insight do universo
 * VISITA DE CAMPO. Não exige novo upload e não toca em entrevistas.
 */
export const reprocessarImersoesCampo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: reports, error } = await supabase
      .from("field_immersion_v2_reports")
      .select("id, client_name, visit_date, source_filename, structured_data, company_id")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    let criadas = 0;
    let atualizadas = 0;
    let ignoradas = 0;

    for (const r of reports ?? []) {
      const raw = r.structured_data as any;
      const candidate = raw?.data?.client ? raw.data : raw?.schema === "visao_imersao_2_data_v1" && raw?.client ? raw : (raw?.data ?? raw?.visao_imersao_2_data_v1 ?? raw);
      const parsed = Immersion2DataSchema.safeParse(candidate);
      if (!parsed.success) {
        ignoradas += 1;
        continue;
      }
      const data = parsed.data;

      const chave = `field_immersion_v2:${r.id}`;
      const titulo = `Imersão em campo — ${data.client?.name ?? r.client_name}`;
      const regiao = (data.client?.location ?? "").trim() || null;
      const dataColeta = (data.client?.visit_date ?? r.visit_date ?? "").slice(0, 10) || null;

      const registro = {
        tipo: "visita_campo" as const,
        titulo,
        pessoa: data.client?.representative ?? data.client?.consultant ?? null,
        regiao,
        perfil_carteira: data.client?.name ?? r.client_name,
        data_coleta: dataColeta,
        status_processamento: "processada" as const,
        arquivo_relatorio: chave,
        updated_at: new Date().toISOString(),
      };

      const { data: existente } = await supabase
        .from("insight_fontes")
        .select("id")
        .eq("arquivo_relatorio", chave)
        .maybeSingle();

      let fonteId = existente?.id ?? null;
      if (fonteId) {
        const { error: uErr } = await supabase.from("insight_fontes").update(registro).eq("id", fonteId);
        if (uErr) throw new Error(uErr.message);
        atualizadas += 1;
      } else {
        const { data: nova, error: iErr } = await supabase
          .from("insight_fontes")
          .insert({ ...registro, company_id: r.company_id ?? undefined, created_by: userId })
          .select("id")
          .single();
        if (iErr) throw new Error(iErr.message);
        fonteId = nova.id;
        criadas += 1;
      }

      const lentes = imersaoToLentes({
        id: r.id,
        client_name: r.client_name,
        visit_date: r.visit_date,
        source_filename: r.source_filename,
        data,
      });

      const rows = LENTES.map(l => ({
        fonte_id: fonteId!,
        lente: l,
        leitura_estrategica: lentes[l].leitura_estrategica,
        sintese_campos: lentes[l].sintese_campos as never,
        highlights: lentes[l].highlights as never,
        company_id: r.company_id ?? undefined,
      }));

      const { error: lErr } = await supabase
        .from("insight_fonte_lentes")
        .upsert(rows as never, { onConflict: "fonte_id,lente" });
      if (lErr) throw new Error(lErr.message);
    }

    return { criadas, atualizadas, ignoradas, total: (reports ?? []).length };
  });
