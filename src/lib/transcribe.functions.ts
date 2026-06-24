import { createServerFn } from "@tanstack/react-start";

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((data: { base64: string; mime: string; filename: string }) => data)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    const bin = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
    const blob = new Blob([bin], { type: data.mime });

    const form = new FormData();
    form.append("file", blob, data.filename);
    form.append("model", "openai/gpt-4o-mini-transcribe");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Falha na transcrição: ${res.status} ${t}`);
    }
    const json = await res.json();
    return { text: (json.text ?? "") as string };
  });
