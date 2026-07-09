import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const distributeReportToChapters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessaoId: string; base64: string; mime: string; filename: string }) => d)
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const { supabase } = context;

    const { data: interview, error: iErr } = await supabase
      .from("interviews")
      .select("id, company_id, roteiro_id")
      .eq("id", data.sessaoId)
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!interview?.roteiro_id) throw new Error("Sessão sem roteiro vinculado");

    const { data: capitulos, error: cErr } = await supabase
      .from("capitulos")
      .select("id, codigo, titulo, orientacao, pergunta_abertura")
      .eq("roteiro_id", interview.roteiro_id)
      .order("ordem");
    if (cErr) throw new Error(cErr.message);
    if (!capitulos?.length) throw new Error("Roteiro sem capítulos");

    // 1. Extrai texto do arquivo
    let sourceText = "";
    const mime = data.mime || "";
    const isAudio = mime.startsWith("audio/") || /\.(mp3|wav|m4a|webm|ogg|aac|flac)$/i.test(data.filename);
    const isPlain = mime.startsWith("text/") || /\.(txt|md|csv)$/i.test(data.filename);

    if (isAudio) {
      const bin = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
      const blob = new Blob([bin], { type: mime || "audio/webm" });
      const form = new FormData();
      form.append("file", blob, data.filename);
      form.append("model", "openai/gpt-4o-mini-transcribe");
      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      if (!res.ok) throw new Error(`Falha ao transcrever: ${res.status} ${await res.text().catch(() => "")}`);
      const j = await res.json();
      sourceText = String(j.text ?? "").trim();
    } else if (isPlain) {
      sourceText = atob(data.base64);
    } else {
      const dataUrl = `data:${mime || "application/pdf"};base64,${data.base64}`;
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: [
            { type: "text", text: "Extraia TODO o conteúdo textual relevante deste documento em português, em texto corrido, preservando informações, nomes e dados citados. Não resuma." },
            { type: "file", file: { filename: data.filename, file_data: dataUrl } },
          ] }],
        }),
      });
      if (!res.ok) throw new Error(`Falha ao extrair conteúdo: ${res.status} ${await res.text().catch(() => "")}`);
      const j = await res.json();
      sourceText = String(j?.choices?.[0]?.message?.content ?? "").trim();
    }
    if (!sourceText) throw new Error("Não foi possível extrair conteúdo do arquivo");

    // 2. Distribui em capítulos via LLM
    const capList = capitulos
      .map((c: any) => `- ${c.codigo}: "${c.titulo}"${c.orientacao ? ` — ${c.orientacao}` : ""}`)
      .join("\n");

    const prompt = `Você recebe o RELATÓRIO BRUTO de uma entrevista/imersão de campo e uma lista de CAPÍTULOS de um roteiro. Sua tarefa: distribuir o conteúdo do relatório entre os capítulos, colocando em cada um APENAS o que se refere ao tema daquele capítulo.

Regras:
- Retorne SOMENTE um objeto JSON no formato { "codigo_do_capitulo": "texto correspondente" }.
- Use exatamente os códigos listados como chave.
- Se um capítulo não tiver conteúdo relacionado, use string vazia "".
- SEMPRE inclua o capítulo "demais_consideracoes" e coloque nele TUDO que não se encaixou nos demais.
- Texto natural em português, sem markdown, sem inventar informação. Não resuma demais — preserve nomes, números e detalhes.

Capítulos disponíveis:
${capList}

Relatório bruto:
"""
${sourceText}
"""`;

    const distRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
    if (!distRes.ok) throw new Error(`Falha ao distribuir: ${distRes.status} ${await distRes.text().catch(() => "")}`);
    const distJson = await distRes.json();
    const raw = distJson?.choices?.[0]?.message?.content ?? "{}";
    let mapping: Record<string, string> = {};
    try { mapping = JSON.parse(raw); } catch { throw new Error("IA retornou JSON inválido"); }

    // 3. Upsert em sessao_capitulos
    let filled = 0;
    for (const c of capitulos as any[]) {
      const text = String(mapping[c.codigo] ?? "").trim();
      if (!text) continue;
      const { data: existing } = await supabase
        .from("sessao_capitulos")
        .select("id, resposta_texto, origem")
        .eq("sessao_id", interview.id)
        .eq("capitulo_id", c.id)
        .maybeSingle();
      if (existing?.id) {
        const hadContent = !!existing.resposta_texto?.trim();
        const merged = hadContent
          ? `${existing.resposta_texto}\n\n[IA — relatório]\n${text}`
          : text;
        await supabase.from("sessao_capitulos").update({
          resposta_texto: merged,
          origem: hadContent ? existing.origem ?? "manual" : "ia",
          status_revisao: "pendente",
        } as any).eq("id", existing.id);
      } else {
        await supabase.from("sessao_capitulos").insert({
          sessao_id: interview.id,
          capitulo_id: c.id,
          resposta_texto: text,
          origem: "ia",
          status_revisao: "pendente",
        } as any);
      }
      filled++;
    }

    return { filled, total: capitulos.length };
  });
