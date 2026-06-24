import { createServerFn } from "@tanstack/react-start";

type Kind = "image" | "video" | "file";

export const extractFromMedia = createServerFn({ method: "POST" })
  .inputValidator((d: { base64: string; mime: string; filename: string; kind: Kind }) => d)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    const dataUrl = `data:${data.mime};base64,${data.base64}`;
    const prompt =
      data.kind === "image"
        ? "Extraia todo o texto visível e descreva sucintamente o conteúdo relevante desta imagem em português, em texto corrido sem formatação."
        : data.kind === "video"
        ? "Transcreva a fala e descreva sucintamente o conteúdo deste vídeo em português, em texto corrido sem formatação."
        : "Extraia o conteúdo textual relevante deste arquivo em português, em texto corrido sem formatação.";

    const content: any[] = [{ type: "text", text: prompt }];
    if (data.kind === "image") {
      content.push({ type: "image_url", image_url: { url: dataUrl } });
    } else {
      content.push({ type: "file", file: { filename: data.filename, file_data: dataUrl } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content }],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Falha na extração: ${res.status} ${t}`);
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? "";
    return { text: String(text).trim() };
  });
