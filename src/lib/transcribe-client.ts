import { normalizeAudioToWavChunks } from "@/lib/audio-wav";

/**
 * Transcreve áudio no navegador: normaliza para WAV, fatia em trechos curtos e
 * envia cada trecho ao endpoint de transcrição (evita estourar memória do servidor).
 */
export async function transcribeAudioInBrowser(
  input: Blob,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  const chunks = await normalizeAudioToWavChunks(input);
  const parts: string[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const res = await fetch("/api/transcribe-chunk", {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: chunks[index],
    });
    const json = await res.json().catch(() => ({}) as { text?: string; error?: string });
    if (!res.ok) throw new Error(json.error ?? `Falha ao transcrever (${res.status})`);
    const text = String(json.text ?? "").trim();
    if (text) parts.push(text);
    onProgress?.(index + 1, chunks.length);
  }

  return parts.join(" ").trim();
}
