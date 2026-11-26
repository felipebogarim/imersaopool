import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 8 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe-chunk")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeAiRequest } = await import("@/lib/ai-endpoint-auth.server");
        const authz = await authorizeAiRequest(request);
        if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status });

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "Serviço de IA indisponível." }, { status: 503 });

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
          // Detalhe do provedor só no log do servidor (não expõe resposta bruta ao cliente).
          console.error(
            "[api/transcribe-chunk] falha no provedor",
            res.status,
            await res.text().catch(() => ""),
          );
          const status = res.status === 429 || res.status === 402 ? res.status : 502;
          return Response.json(
            {
              error:
                status === 429
                  ? "Limite de uso atingido. Tente novamente em instantes."
                  : "Falha ao transcrever.",
            },
            { status },
          );
        }
        const json: { text?: string } = await res.json();
        return Response.json({ text: String(json.text ?? "") });
      },
    },
  },
});
