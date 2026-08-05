import { createServerFn } from "@tanstack/react-start";
import { detectAudioContainer } from "@/lib/audio-container";

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((data: { base64: string; mime: string; filename: string }) => data)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    const bin = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
    const sig = detectAudioContainer(bin, data.mime, data.filename);
    if (!sig) {
      throw new Error(
        "Formato de áudio não suportado (provavelmente OGG/Opus). Converta para MP3, WAV, M4A ou WEBM e envie novamente."
      );
    }
    const blob = new Blob([bin.slice().buffer as ArrayBuffer], { type: sig.mime });

    const form = new FormData();
    form.append("file", blob, `audio.${sig.ext}`);
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
