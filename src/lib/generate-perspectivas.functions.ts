import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LENTES = [
  "percepcao_marca",
  "mix",
  "concorrencia",
  "argumento",
  "decisao",
  "familias",
  "promo_comercial",
  "oportunidade",
  "ameaca",
  "cuidado",
] as const;

export const generatePerspectivasForSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessaoId: string }) => data)
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const { supabase } = context;

    const { data: interview, error: iErr } = await supabase
      .from("interviews")
      .select("id, company_id, client_id, roteiro_id, entrevistado_nome, empresa_nome")
      .eq("id", data.sessaoId)
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!interview) throw new Error("Entrevista não encontrada");
    if (!interview.company_id) throw new Error("Entrevista sem empresa");

    const { data: capitulos, error: cErr } = await supabase
      .from("sessao_capitulos")
      .select(
        "id, capitulo_id, resposta_texto, capitulos:capitulo_id ( id, titulo, orientacao, hipotese, lente_default, campos_matriz )"
      )
      .eq("sessao_id", data.sessaoId);
    if (cErr) throw new Error(cErr.message);

    const withText = (capitulos ?? []).filter((c: any) => c.resposta_texto?.trim());
    if (!withText.length) throw new Error("Nenhum capítulo com resposta para processar");

    const escopoTipo = interview.client_id ? "cliente" : "empresa";
    const escopoRefId = interview.client_id ?? interview.company_id;

    let created = 0;
    const errors: string[] = [];

    for (const sc of withText) {
      const cap: any = sc.capitulos;
      const campos: string[] = Array.isArray(cap?.campos_matriz) ? cap.campos_matriz : [];
      const lente = cap?.lente_default ?? "percepcao_marca";
      const camposStr = campos.length
        ? `Campos obrigatórios (todos devem existir no objeto retornado, mesmo que como string vazia): ${campos.join(", ")}`
        : "Retorne pares chave-valor curtos que resumam a resposta.";

      const prompt = `Você extrai perspectivas estruturadas de entrevistas de imersão de campo.

Capítulo: "${cap?.titulo}"
Orientação: ${cap?.orientacao ?? "—"}
Hipótese sob teste: ${cap?.hipotese ?? "—"}
Lente analítica: ${lente}
Entrevistado: ${interview.entrevistado_nome}${interview.empresa_nome ? ` (${interview.empresa_nome})` : ""}

${camposStr}

Resposta bruta do entrevistado:
"""
${sc.resposta_texto}
"""

Retorne APENAS um objeto JSON com as chaves solicitadas, valores como strings concisas (1-3 frases). Sem markdown, sem comentários.`;

      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
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
          const t = await res.text().catch(() => "");
          errors.push(`cap ${cap?.titulo}: ${res.status} ${t.slice(0, 200)}`);
          continue;
        }
        const json = await res.json();
        const raw = json.choices?.[0]?.message?.content ?? "{}";
        let conteudo: Record<string, unknown> = {};
        try {
          conteudo = JSON.parse(raw);
        } catch {
          errors.push(`cap ${cap?.titulo}: JSON inválido`);
          continue;
        }
        // Garante campos obrigatórios preenchidos (RLS/trigger valida)
        for (const f of campos) {
          if (!(f in conteudo)) conteudo[f] = "";
        }

        const { error: insErr } = await supabase.from("perspectivas").insert({
          company_id: interview.company_id,
          sessao_id: interview.id,
          sessao_capitulo_id: sc.id,
          capitulo_id: cap?.id ?? null,
          lente: lente as (typeof LENTES)[number],
          escopo_tipo: escopoTipo as "cliente" | "empresa",
          escopo_ref_id: escopoRefId,
          conteudo: conteudo as never,
          origem: "ia",
          status: "ia_sugerida",
        });
        if (insErr) errors.push(`cap ${cap?.titulo}: ${insErr.message}`);
        else created++;
      } catch (e: any) {
        errors.push(`cap ${cap?.titulo}: ${e.message ?? String(e)}`);
      }
    }

    return { created, total: withText.length, errors };
  });
