import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Importa uma análise pronta (PDF, Excel, DOCX, TXT) e a converte no formato do
 * painel de síntese. O resultado é salvo como nova versão e, por ser a versão
 * mais recente, PREVALECE sobre a consolidação interna.
 */
export const importarAnaliseSintese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tipos: string[]; texto: string; arquivo: string }) => data)
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const { supabase } = context;

    const tipos = (data.tipos ?? []).filter(Boolean);
    if (!tipos.length) throw new Error("Selecione ao menos um tipo de fonte.");
    const texto = (data.texto ?? "").trim();
    if (texto.length < 40) throw new Error("Não foi possível ler conteúdo suficiente do arquivo.");

    const lentes = [
      "marca_preco",
      "mix",
      "concorrencia",
      "argumento",
      "decisao",
      "oportunidades",
      "governanca",
      "adicionais",
    ];

    const prompt = `Você converte uma ANÁLISE JÁ PRONTA (feita por humano ou por outra IA) no formato do painel de síntese.

Regras:
- Use SOMENTE o conteúdo do documento. Não invente pontos.
- Nunca cite valores monetários absolutos; use percentuais, faixas ou faróis.
- Distribua o conteúdo entre as 8 lentes: ${lentes.join(", ")}.
- Se uma lente não tiver conteúdo, devolva listas vazias.

Documento (${data.arquivo}):
"""
${texto.slice(0, 120000)}
"""

Retorne JSON exatamente neste formato:
{
 "lentes": {
   "<lente>": {
     "convergencia": [{"texto":"...","campo":"importado","peso":1,"total":1,"fala_representativa":null,"fontes":[],"reforcada":false}],
     "divergencia": [{"tema":"...","posicoes":[{"posicao":"...","campo":"importado","fonte":"Documento","fonteId":"importado","regiao":null,"fala":null}]}],
     "especifico": [{"texto":"...","campo":"importado","fonte":"Documento","fonteId":"importado","regiao":null}],
     "acao_convergente": {"texto":"...","peso":1,"fontes":[]}
   }
 }
}`;

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
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Falha IA: ${res.status}`);
    }
    const json = await res.json();
    let parsed: any = {};
    try {
      parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    } catch {
      throw new Error("IA retornou JSON inválido");
    }

    const out: Record<string, any> = {};
    let fortes = 0;
    let divs = 0;
    let esps = 0;
    for (const l of lentes) {
      const r = parsed?.lentes?.[l] ?? {};
      const conv = Array.isArray(r.convergencia) ? r.convergencia : [];
      const div = Array.isArray(r.divergencia) ? r.divergencia : [];
      const esp = Array.isArray(r.especifico) ? r.especifico : [];
      fortes += conv.length;
      divs += div.length;
      esps += esp.length;
      out[l] = {
        convergencia: conv.map((c: any) => ({
          texto: String(c?.texto ?? ""),
          campo: "importado",
          peso: Number(c?.peso ?? 1),
          total: Number(c?.total ?? 1),
          fala_representativa: c?.fala_representativa ?? null,
          fontes: [],
          reforcada: false,
        })),
        divergencia: div.map((d: any) => ({
          tema: String(d?.tema ?? ""),
          posicoes: (Array.isArray(d?.posicoes) ? d.posicoes : []).map((p: any) => ({
            posicao: String(p?.posicao ?? ""),
            campo: "importado",
            fonte: String(p?.fonte ?? "Documento importado"),
            fonteId: "importado",
            regiao: p?.regiao ?? null,
            fala: p?.fala ?? null,
          })),
        })),
        especifico: esp.map((e: any) => ({
          texto: String(e?.texto ?? ""),
          campo: "importado",
          fonte: String(e?.fonte ?? "Documento importado"),
          fonteId: "importado",
          regiao: e?.regiao ?? null,
        })),
        acao_convergente: r?.acao_convergente?.texto
          ? { texto: String(r.acao_convergente.texto), peso: 1, fontes: [] }
          : null,
      };
    }

    const resultado = {
      lentes: out,
      meta: {
        total_fontes: 1,
        corte: 1,
        regioes: [],
        fontes: [],
        convergencias_fortes: fortes,
        divergencias: divs,
        especificos: esps,
        origem: "importada",
        arquivo: data.arquivo,
      },
    };

    const { data: anterior } = await supabase
      .from("paineis_sintese")
      .select("versao")
      .contains("tipos_incluidos", tipos as never)
      .order("versao", { ascending: false })
      .limit(1);
    const versao = (anterior?.[0]?.versao ?? 0) + 1;

    const { data: inserted, error } = await supabase
      .from("paineis_sintese")
      .insert({
        tipos_incluidos: tipos as never,
        fontes_incluidas: [],
        corte_convergencia: 1,
        versao,
        resultado: resultado as never,
        created_by: context.userId,
      })
      .select("id, versao, gerado_em")
      .single();
    if (error) throw new Error(error.message);

    return { id: inserted.id, versao: inserted.versao, gerado_em: inserted.gerado_em };
  });
