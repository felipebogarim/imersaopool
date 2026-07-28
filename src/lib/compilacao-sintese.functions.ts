import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Compilação IA como CONSEQUÊNCIA de uma síntese já existente.
 * Não depende de perspectivas aprovadas — lê o último painel de síntese.
 */
export const gerarCompilacaoDeSintese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { painelId?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const { supabase } = context;

    let q = supabase
      .from("paineis_sintese")
      .select("id, versao, gerado_em, tipos_incluidos, fontes_incluidas, resultado")
      .order("gerado_em", { ascending: false })
      .limit(1);
    if (data.painelId) q = supabase
      .from("paineis_sintese")
      .select("id, versao, gerado_em, tipos_incluidos, fontes_incluidas, resultado")
      .eq("id", data.painelId)
      .limit(1);

    const { data: paineis, error } = await q;
    if (error) throw new Error(error.message);
    const painel = paineis?.[0];
    if (!painel) throw new Error("Nenhum painel de síntese disponível. Gere uma síntese primeiro.");

    const prompt = `Você é analista sênior. Transforme o painel de síntese abaixo em um documento executivo.

Tipos de fonte: ${(painel.tipos_incluidos as string[]).join(", ")}
Fontes consolidadas: ${(painel.fontes_incluidas as string[]).length}
Versão do painel: v${painel.versao}

Painel (8 lentes, com convergências, divergências e pontos específicos):
${JSON.stringify(painel.resultado).slice(0, 60000)}

Regras: nunca cite valores monetários absolutos; não invente pontos que não estejam no painel.

Produza um objeto JSON com as chaves:
- "resumo_executivo": 3-5 frases.
- "insights_chave": array de 3-8 strings acionáveis.
- "oportunidades": array de strings.
- "ameacas": array de strings.
- "recomendacoes": array de { "acao": string, "prioridade": "alta"|"media"|"baixa", "justificativa": string }.
- "lacunas": array de strings.

Sem markdown, sem comentários fora do JSON.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você retorna somente JSON válido." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Limite de uso IA atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos na workspace.");
      throw new Error(`Falha IA: ${res.status}`);
    }
    const json = await res.json();
    let conteudo: Record<string, unknown> = {};
    try {
      conteudo = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    } catch {
      throw new Error("IA retornou JSON inválido");
    }
    conteudo.origem_painel = { id: painel.id, versao: painel.versao, gerado_em: painel.gerado_em };

    const { data: inserted, error: insErr } = await supabase
      .from("ai_compilations")
      .insert({
        tipo: "diagnostico_final",
        escopo_tipo: "empresa",
        escopo_ref_id: null,
        conteudo: conteudo as never,
        modelo: "google/gemini-2.5-flash",
        perspectivas_incluidas: [],
      })
      .select("id, versao")
      .single();
    if (insErr) throw new Error(insErr.message);

    return { id: inserted.id, versao: inserted.versao, fontes: (painel.fontes_incluidas as string[]).length };
  });
