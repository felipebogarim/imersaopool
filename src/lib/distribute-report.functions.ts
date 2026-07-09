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
      .select("id, codigo, titulo, orientacao, pergunta_abertura, campos_matriz")
      .eq("roteiro_id", interview.roteiro_id)
      .order("ordem");
    if (cErr) throw new Error(cErr.message);
    if (!capitulos?.length) throw new Error("Roteiro sem capítulos");

    // 1. Prepara a entrada (texto/áudio→transcrição / PDF direto / DOCX extraído)
    const mime = data.mime || "";
    const isAudio = mime.startsWith("audio/") || /\.(mp3|wav|m4a|webm|ogg|aac|flac)$/i.test(data.filename);
    const isPlain = mime.startsWith("text/") || /\.(txt|md|csv)$/i.test(data.filename);
    const isPdf = mime === "application/pdf" || /\.pdf$/i.test(data.filename);
    const isDocx = /\.docx$/i.test(data.filename) || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isDoc = !isDocx && (/\.doc$/i.test(data.filename) || mime === "application/msword");
    if (isDoc) {
      throw new Error("Formato .doc (Word 97-2003) não suportado. Salve como .docx ou PDF antes de enviar.");
    }
    if (!isAudio && !isPlain && !isPdf && !isDocx) {
      throw new Error("Formato não suportado. Envie PDF, DOCX, TXT/MD/CSV ou áudio.");
    }

    let sourceText = "";
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
      if (!sourceText) throw new Error("Não foi possível transcrever o áudio");
    } else if (isPlain) {
      sourceText = atob(data.base64).trim();
      if (!sourceText) throw new Error("Arquivo de texto vazio");
    } else if (isDocx) {
      const { unzipSync, strFromU8 } = await import("fflate");
      const bin = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
      let files: Record<string, Uint8Array>;
      try { files = unzipSync(bin, { filter: (f) => f.name === "word/document.xml" }); }
      catch { throw new Error("DOCX inválido ou corrompido"); }
      const xml = files["word/document.xml"] ? strFromU8(files["word/document.xml"]) : "";
      if (!xml) throw new Error("Não foi possível ler o conteúdo do DOCX");
      sourceText = xml
        .replace(/<w:tab\/?>/g, "\t")
        .replace(/<w:br\/?>/g, "\n")
        .split(/<\/w:p>/)
        .map((para) => {
          const parts = [...para.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]);
          return parts.join("")
            .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (!sourceText) throw new Error("DOCX sem texto extraível");
    }

    // 2. Distribui em capítulos via LLM (chamada única — PDF vai direto)
    const capList = capitulos
      .map((c: any) => {
        const campos = Array.isArray(c.campos_matriz) && c.campos_matriz.length
          ? ` [campos_sintese: ${c.campos_matriz.join(", ")}]` : "";
        return `- ${c.codigo}: "${c.titulo}"${c.orientacao ? ` — ${c.orientacao}` : ""}${campos}`;
      })
      .join("\n");

    const promptHeader = `Você é um analista de estratégia comercial sênior, especialista no mercado de iluminação decorativa B2B. Sua tarefa NÃO é transcrever — é INTERPRETAR.

Você recebe o RELATÓRIO BRUTO de uma entrevista/imersão de campo (${isPdf ? "no PDF em anexo" : "no texto abaixo"}) e uma lista de CAPÍTULOS de um roteiro. Para cada capítulo, distribua o conteúdo pertinente e produza:

1. "leitura_estrategica" — PROSA CORRIDA, 2 a 4 parágrafos curtos, como se estivesse resumindo para um gestor que não participou da conversa e precisa tomar decisão. A PRIMEIRA frase de cada capítulo deve funcionar como manchete: vai direto ao achado mais importante, sem preâmbulo. Traduza gírias, hesitações e frases truncadas para linguagem clara. Não copie fala literal como se fosse resposta — extraia o significado. Não repita aqui o que já está nos campos da síntese objetiva; a leitura é o raciocínio e o contexto por trás dos campos. Se não houver conteúdo substantivo alocado ao capítulo, use exatamente "Sem conteúdo relevante capturado nesta sessão".
2. "sintese" — objeto com os campos listados em [campos_sintese] do capítulo, respostas curtas e objetivas. Campo sem informação = "".
3. "evidencia" — UMA citação curta (até ~25 palavras) do próprio entrevistado que sustenta a leitura. Sem aspas extras, sem "né?"/"entendeu?". Vazio se não houver.

IGNORE COMPLETAMENTE (nunca vira conteúdo):
- Saudações, bate-papo pessoal, comentários sobre a dinâmica da entrevista ("isso vai ficar gravado?").
- PERGUNTAS OU FALAS DO ENTREVISTADOR — elas só direcionam a conversa, nunca são conteúdo. Se a transcrição não diferencia interlocutores, use julgamento: perguntas abertas dirigidas ao respondente são do entrevistador.
- Perguntas retóricas ou de confirmação do entrevistado ("né?", "entendeu?", recapitulações sem informação nova).
- Ruído de transcrição automática que não muda o sentido.

Formato de retorno — SOMENTE um objeto JSON:
{ "codigo_do_capitulo": { "leitura_estrategica": "...", "sintese": { "campo": "valor" }, "evidencia": "..." } }

- Use exatamente os códigos listados como chave. Português natural, sem markdown, sem inventar informação. Preserve nomes e números.
- SEMPRE inclua "informacoes_adicionais" com o que não se encaixou nos demais (mesmas regras de interpretação).

Capítulos disponíveis:
${capList}`;

    const userContent: any[] = [{ type: "text", text: promptHeader }];
    if (isPdf) {
      userContent.push({
        type: "file",
        file: { filename: data.filename, file_data: `data:application/pdf;base64,${data.base64}` },
      });
    } else {
      userContent.push({ type: "text", text: `Relatório bruto:\n"""\n${sourceText}\n"""` });
    }

    const distRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você retorna somente JSON válido." },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!distRes.ok) throw new Error(`Falha ao distribuir: ${distRes.status} ${await distRes.text().catch(() => "")}`);
    const distJson = await distRes.json();
    const raw = distJson?.choices?.[0]?.message?.content ?? "{}";
    let mapping: Record<string, any> = {};
    try { mapping = JSON.parse(raw); } catch { throw new Error("IA retornou JSON inválido"); }

    // 3. Upsert em sessao_capitulos
    let filled = 0;
    for (const c of capitulos as any[]) {
      const entry = mapping[c.codigo];
      const leitura = String(
        (typeof entry === "string" ? entry : entry?.leitura_estrategica ?? entry?.texto) ?? "",
      ).trim();
      const evidencia = String(entry?.evidencia ?? "").trim();
      const sintese = (entry && typeof entry === "object" && entry.sintese && typeof entry.sintese === "object")
        ? entry.sintese : {};
      const hasSintese = Object.values(sintese).some((v: any) => String(v ?? "").trim());
      if (!leitura && !hasSintese && !evidencia) continue;
      // Compat: guarda evidência como sufixo do texto (não há coluna dedicada)
      const respostaTexto = evidencia ? `${leitura}\n\nEvidência: "${evidencia}"` : leitura;
      const { data: existing } = await supabase
        .from("sessao_capitulos")
        .select("id, resposta_texto, origem, sintese, leitura_estrategica")
        .eq("sessao_id", interview.id)
        .eq("capitulo_id", c.id)
        .maybeSingle();
      if (existing?.id) {
        const hadContent = !!(existing as any).leitura_estrategica?.trim() || !!existing.resposta_texto?.trim();
        const mergedSintese = { ...((existing.sintese as Record<string, unknown>) ?? {}), ...sintese };
        await supabase.from("sessao_capitulos").update({
          leitura_estrategica: leitura || (existing as any).leitura_estrategica,
          resposta_texto: respostaTexto || existing.resposta_texto,
          sintese: mergedSintese,
          origem: hadContent ? existing.origem ?? "manual" : "ia",
          status_revisao: "pendente",
        } as any).eq("id", existing.id);
      } else {
        await supabase.from("sessao_capitulos").insert({
          sessao_id: interview.id,
          capitulo_id: c.id,
          leitura_estrategica: leitura,
          resposta_texto: respostaTexto,
          sintese,
          origem: "ia",
          status_revisao: "pendente",
        } as any);
      }
      filled++;
    }

    return { filled, total: capitulos.length };
  });

