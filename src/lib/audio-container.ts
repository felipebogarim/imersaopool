export type AudioSig = { ext: string; mime: string };

/** Detecta o container de áudio pelos bytes iniciais; fallback para mime/extensão. */
export function detectAudioContainer(bin: Uint8Array, mime?: string, filename?: string): AudioSig | null {
  const b = bin;
  const ascii = (start: number, len: number) =>
    String.fromCharCode(...Array.from(b.slice(start, start + len)));

  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return { ext: "wav", mime: "audio/wav" };
  if (ascii(0, 4) === "fLaC") return { ext: "flac", mime: "audio/flac" };
  if (ascii(4, 4) === "ftyp") return { ext: "m4a", mime: "audio/mp4" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: "webm", mime: "audio/webm" };
  if (ascii(0, 3) === "ID3") return { ext: "mp3", mime: "audio/mpeg" };
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return { ext: "mp3", mime: "audio/mpeg" };
  if (ascii(0, 4) === "OggS") return null; // OGG/Opus não é aceito pelos modelos de transcrição

  // Fallback por mime/extensão conhecidos
  const m = (mime || "").split(";")[0];
  const byMime: Record<string, AudioSig> = {
    "audio/wav": { ext: "wav", mime: "audio/wav" },
    "audio/x-wav": { ext: "wav", mime: "audio/wav" },
    "audio/mpeg": { ext: "mp3", mime: "audio/mpeg" },
    "audio/mp3": { ext: "mp3", mime: "audio/mpeg" },
    "audio/mp4": { ext: "m4a", mime: "audio/mp4" },
    "audio/m4a": { ext: "m4a", mime: "audio/mp4" },
    "audio/x-m4a": { ext: "m4a", mime: "audio/mp4" },
    "audio/webm": { ext: "webm", mime: "audio/webm" },
    "audio/aac": { ext: "aac", mime: "audio/aac" },
    "audio/flac": { ext: "flac", mime: "audio/flac" },
  };
  if (byMime[m]) return byMime[m];

  const ext = (filename || "").split(".").pop()?.toLowerCase() ?? "";
  const byExt: Record<string, AudioSig> = {
    wav: { ext: "wav", mime: "audio/wav" },
    mp3: { ext: "mp3", mime: "audio/mpeg" },
    m4a: { ext: "m4a", mime: "audio/mp4" },
    mp4: { ext: "m4a", mime: "audio/mp4" },
    webm: { ext: "webm", mime: "audio/webm" },
    aac: { ext: "aac", mime: "audio/aac" },
    flac: { ext: "flac", mime: "audio/flac" },
  };
  return byExt[ext] ?? null;
}
