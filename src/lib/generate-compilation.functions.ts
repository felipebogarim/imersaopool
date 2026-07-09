import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Tipo = "representante" | "visita" | "price" | "diagnostico_final";
type Escopo = "cliente" | "familia" | "competidor" | "empresa";

export const generateCompilation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      tipo: Tipo;
      escopoTipo: Escopo;
      escopoRefId?: string | null;
      immersionId?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const { supabase } = context;

    let q = supabase
      .from("perspectivas")
      .select("id, lente, escopo_tipo, escopo_ref_id, conteudo, created_at")
      .eq("status", "aprovada")
      .eq("escopo_tipo", data.escopoTipo)
      .order("created_at", { ascending: true })
      .limit(500);
    if (data.escopoRefId) q = q.eq("escopo_ref_id", data.escopoRefId);
    else q = q.is("escopo_ref_id", null);

    const { data: persps, error: pErr } = await q;
    if (pErr) throw new Error(pErr.message);
    if (!persps || persps.length === 0)
      throw new Error("Nenhuma perspectiva aprovada encontrada para este escopo");

    // Escopo humano
    let escopoLabel = "Empresa";
    if (data.escopoTipo === "cliente" && data.escopoRefId) {
      const { data: c } = await supabase
        .from("clients")
        .select("nome_fantasia")
        .eq("id", data.escopoRefId)
        .maybeSingle();
      escopoLabel = c?.nome_fantasia ? `Cliente: ${c.nome_fantasia}` : "Cliente";
    } else if (data.escopoTipo === "familia" && data.escopoRefId) {
      const { data: f } = await supabase
        .from("familias_produto")
        .select("nome, nivel")
        .eq("id", data.escopoRefId)
        .maybeSingle();
      escopoLabel = f?.nome ? `Família (${f.nivel}): ${f.nome}` : "Família";
    } else if (data.escopoTipo === "competidor" && data.escopoRefId) {
      escopoLabel = `Competidor: ${data.escopoRefId}`;
    }

    const grouped = persps.reduce<Record<string, unknown[]>>((acc, p: any) => {
      (acc[p.lente] ||= []).push(p.conteudo);
      return acc;
    }, {});

    const prompt = `Você é analista sênior compilando perspectivas aprovadas por humanos em um diagnóstico executivo.

Escopo: ${escopoLabel}
Tipo do relatório: ${data.tipo}
Total de perspectivas: ${persps.length}

Perspectivas aprovadas (agrupadas por lente):
${JSON.stringify(grouped, null, 2)}

Produza um objeto JSON com as chaves:
- "resumo_executivo": 3-5 frases sintetizando o quadro.
- "insights_chave": array de 3-8 strings, cada uma um insight acionável.
- "oportunidades": array de strings.
- "ameacas": array de strings.
- "recomendacoes": array de objetos { "acao": string, "prioridade": "alta"|"media"|"baixa", "justificativa": string }.
- "lacunas": array de strings (o que ainda não sabemos e vale investigar).

Sem markdown, sem comentários fora do JSON.`;

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
      if (res.status === 429) throw new Error("Limite de uso IA atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos na workspace.");
      throw new Error(`Falha IA: ${res.status} ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let conteudo: Record<string, unknown> = {};
    try {
      conteudo = JSON.parse(raw);
    } catch {
      throw new Error("IA retornou JSON inválido");
    }

    const modelo = "google/gemini-2.5-flash";
    const perspectivasIds = persps.map((p: any) => p.id);

    const { data: inserted, error: insErr } = await supabase
      .from("ai_compilations")
      .insert({
        tipo: data.tipo,
        escopo_tipo: data.escopoTipo,
        escopo_ref_id: data.escopoRefId ?? null,
        immersion_id: data.immersionId ?? null,
        conteudo: conteudo as never,
        modelo,
        perspectivas_incluidas: perspectivasIds,
      })
      .select("id, versao")
      .single();

    if (insErr) throw new Error(insErr.message);
    return { id: inserted.id, versao: inserted.versao, total: persps.length };
  });
