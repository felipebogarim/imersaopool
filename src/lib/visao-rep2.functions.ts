import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findFonteDoRep, type FonteLite } from "@/lib/visao-rep";
import {
  PERSPECTIVE_TITLES,
  VISAO_REP_SCHEMA_VERSION,
  normalizeVisaoRep2,
  type VisaoRep2,
} from "@/lib/visao-rep2-schema";

/**
 * Modo "Gerar com IA": lê as fontes já processadas do representante e devolve
 * o objeto canônico da Visão Rep. Nada é gravado aqui — o usuário revisa a
 * prévia antes de confirmar.
 */
export const gerarVisaoRep2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { representativeId: string }) => data)
  .handler(async ({ data, context }): Promise<VisaoRep2> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const { supabase } = context;

    const { data: rep } = await supabase
      .from("representatives")
      .select("id, nome, regiao")
      .eq("id", data.representativeId)
      .maybeSingle();
    if (!rep) throw new Error("Representante não encontrado.");

    const { data: fontes } = await supabase
      .from("insight_fontes")
      .select("id, tipo, titulo, pessoa, regiao, perfil_carteira, interview_id, updated_at")
      .eq("tipo", "entrevista")
      .neq("status_processamento", "pendente");

    const fonte = findFonteDoRep((fontes ?? []) as unknown as FonteLite[], rep.nome);
    if (!fonte) throw new Error("Nenhuma entrevista processada encontrada para este representante.");

    const { data: lentes } = await supabase
      .from("insight_fonte_lentes")
      .select("lente, leitura_estrategica, sintese_campos, highlights")
      .eq("fonte_id", fonte.id);

    const material = (lentes ?? [])
      .map(
        (l: any) =>
          `## Lente ${l.lente}\nLeitura: ${l.leitura_estrategica ?? ""}\nCampos: ${JSON.stringify(l.sintese_campos ?? {})}\nCitações: ${JSON.stringify(l.highlights ?? [])}`,
      )
      .join("\n\n");
    if (material.trim().length < 40) throw new Error("A entrevista deste representante ainda não tem conteúdo processado.");

    const prompt = `Você organiza o material JÁ EXISTENTE de uma entrevista com representante comercial no modelo canônico "Visão Rep".

Regras invioláveis:
- Use SOMENTE o material fornecido. Não invente achados, clientes, marcas, linhas, citações ou números.
- Se um campo não tiver base no material, devolva null (ou lista vazia). Nunca preencha por suposição.
- Citações devem ser trechos literais do material.
- Nunca cite valores monetários absolutos: use percentuais, faixas ou faróis.
- No máximo 5 sinais prioritários, 3 decisões, 3 validações, 5 clientes estratégicos.
- As 8 perspectivas são fixas, nesta ordem: ${PERSPECTIVE_TITLES.map((t, i) => `${i + 1}. ${t}`).join("; ")}.

Representante: ${rep.nome} — Região: ${rep.regiao ?? "não informada"}

Material:
"""
${material.slice(0, 120000)}
"""

Retorne JSON exatamente com esta forma:
{
 "executive_view": {"central_thesis": null, "strategic_risk": null, "final_synthesis": null,
   "priority_signals": [{"title":null,"finding":null,"business_impact":null,"recommended_action":null,"confidence_level":"alto|medio|baixo","evidence_status":"relato_individual|corroborado_por_outras_entrevistas|validado_por_documento|validado_por_dados|hipotese_a_validar","source_chapter":null,"source_quote":null}],
   "decisions_required": [], "validation_required": []},
 "representative_context": {"represented_brands": [], "region_summary": null, "service_model": null, "regional_structure": null, "additional_context": null},
 "strategic_clients": [{"client_name":null,"strategic_reason":null,"perceived_potential":null,"identified_opportunity":null,"priority_product_lines":null,"main_competitor":null,"recommended_next_action":null,"attention_point":null}],
 "product_line_views": [{"product_line":null,"summary":null,"classification":"forte|potencial|pressionada|sem_evidencia_suficiente","what_works":null,"main_barrier":null,"main_competitor":null,"competitor_advantage":null,"opportunity":null,"recommended_action":null,"evidence":null,"source_quote":null}],
 "perspectives": [{"perspective_number":1,"perspective_title":"...","executive_finding":null,"business_impact":null,"recommended_action":null,"evidence":null,"source_quote":null,"confidence_level":null,"evidence_status":null,"comparative_classification":null,"full_reading":null}]
}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você retorna somente JSON válido, sem inventar conteúdo." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Limite de uso de IA atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Falha na geração por IA: ${res.status}`);
    }
    const json = await res.json();
    let parsed: any = {};
    try {
      parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    } catch {
      throw new Error("A IA retornou um JSON inválido.");
    }

    const now = new Date().toISOString();
    const visao = normalizeVisaoRep2({
      ...parsed,
      metadata: {
        schema_version: VISAO_REP_SCHEMA_VERSION,
        representative_id: rep.id,
        representative_name: rep.nome,
        region: rep.regiao ?? null,
        interview_date: null,
        report_date: now.slice(0, 10),
        creation_mode: "ai_generated",
        source_file_name: null,
        created_by: context.userId,
        created_at: now,
        updated_at: now,
      },
      source_control: {
        creation_mode: "ai_generated",
        source_file: null,
        schema_version: VISAO_REP_SCHEMA_VERSION,
        import_date: null,
        imported_by: null,
        last_update: now,
        content_hash: null,
      },
    });

    return visao;
  });
