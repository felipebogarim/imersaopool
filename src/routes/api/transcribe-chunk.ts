import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 8 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe-chunk")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "LOVABLE_API_KEY ausente" }, { status: 500 });

        const buf = await request.arrayBuffer();
        if (!buf.byteLength) return Response.json({ error: "Áudio vazio" }, { status: 400 });
        if (buf.byteLength > MAX_BYTES)
          return Response.json({ error: "Trecho de áudio grande demais" }, { status: 413 });

        const form = new FormData();
        form.append("file", new Blob([buf], { type: "audio/wav" }), "audio.wav");
        form.append("model", "openai/gpt-4o-mini-transcribe");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: form,
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          return Response.json(
            { error: `Falha ao transcrever: ${res.status} ${detail}` },
            { status: res.status === 429 || res.status === 402 ? res.status : 502 },
          );
        }
        const json: { text?: string } = await res.json();
        return Response.json({ text: String(json.text ?? "") });
      },
    },
  },
});
