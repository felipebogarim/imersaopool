import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consolidar, type FonteInput } from "@/lib/sintese-engine";
import { LENTES, normalizeHighlights, normalizeSinteseCampos, type Lente } from "@/lib/insight-lentes";

export const gerarPainelSintese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tipos: string[]; corte?: number | null; fonteIds?: string[] | null; titulo?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tipos = (data.tipos ?? []).filter(Boolean);
    if (!tipos.length) throw new Error("Selecione ao menos um tipo de fonte.");

    const selecionados = (data.fonteIds ?? []).filter(Boolean);
    let fq = supabase
      .from("insight_fontes")
      .select("id, tipo, titulo, pessoa, regiao, perfil_carteira, company_id")
      .in("tipo", tipos as never)
      .neq("status_processamento", "pendente")
      .order("created_at", { ascending: true });
    if (selecionados.length) fq = fq.in("id", selecionados as never);
    const { data: fontes, error } = await fq;
    if (error) throw new Error(error.message);
    if (!fontes?.length) throw new Error("Nenhuma fonte processada para os tipos selecionados.");

    const ids = fontes.map(f => f.id);
    const { data: lentes, error: lErr } = await supabase
      .from("insight_fonte_lentes")
      .select("fonte_id, lente, leitura_estrategica, sintese_campos, highlights")
      .in("fonte_id", ids);
    if (lErr) throw new Error(lErr.message);

    const entrada: FonteInput[] = fontes.map(f => {
      const map: FonteInput["lentes"] = {};
      for (const l of LENTES) {
        const row = (lentes ?? []).find(x => x.fonte_id === f.id && x.lente === l);
        map[l] = {
          leitura_estrategica: row?.leitura_estrategica ?? null,
          sintese_campos: normalizeSinteseCampos(l as Lente, row?.sintese_campos),
          highlights: normalizeHighlights(row?.highlights),
        };
      }
      return {
        id: f.id,
        tipo: f.tipo as string,
        titulo: f.titulo,
        pessoa: f.pessoa,
        regiao: f.regiao,
        perfil_carteira: f.perfil_carteira,
        lentes: map,
      };
    });

    // Motor v2: clustering semântico por tema via IA. Fallback determinístico
    // apenas se a IA falhar por completo (sem chave, indisponível, JSON inválido).
    const { clusterizar } = await import("@/lib/sintese-cluster.server");
    let resultado = await clusterizar(entrada, data.corte ?? undefined);
    if (!resultado) {
      const base = consolidar(entrada, data.corte ?? undefined);
      const { refinarComIA } = await import("@/lib/sintese-refine.server");
      resultado = await refinarComIA(base);
      resultado.meta.motor = "deterministico";
    }


    const { data: anterior } = await supabase
      .from("paineis_sintese")
      .select("versao")
      .contains("tipos_incluidos", tipos as never)
      .order("versao", { ascending: false })
      .limit(1);
    const versao = (anterior?.[0]?.versao ?? 0) + 1;

    const { data: inserted, error: iErr } = await supabase
      .from("paineis_sintese")
      .insert({
        tipos_incluidos: tipos as never,
        titulo: data.titulo?.trim() || null,
        fontes_incluidas: ids,
        corte_convergencia: resultado.meta.corte,
        versao,
        resultado: resultado as never,
        created_by: context.userId,
      })
      .select("id, versao, gerado_em")
      .single();
    if (iErr) throw new Error(iErr.message);

    return { id: inserted.id, versao: inserted.versao, gerado_em: inserted.gerado_em, fontes: ids.length };
  });
