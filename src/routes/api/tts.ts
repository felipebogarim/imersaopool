import { createFileRoute } from "@tanstack/react-router";

/** Converte um trecho de texto em áudio (MP3) usando a IA da plataforma. */
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "LOVABLE_API_KEY ausente" }, { status: 500 });

        let body: { text?: string; voice?: string };
        try {
          body = (await request.json()) as { text?: string; voice?: string };
        } catch {
          return Response.json({ error: "Requisição inválida" }, { status: 400 });
        }
        const text = String(body.text ?? "").trim();
        if (!text) return Response.json({ error: "Texto vazio" }, { status: 400 });
        if (text.length > 4000) return Response.json({ error: "Texto muito longo" }, { status: 400 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice: body.voice || "alloy",
            response_format: "mp3",
            instructions:
              "Leia como uma apresentação executiva em português do Brasil: ritmo calmo e profissional, pausa clara entre capítulos e entre itens, ênfase nos títulos.",
          }),
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          return Response.json(
            { error: `Falha ao gerar áudio: ${res.status} ${detail}` },
            { status: res.status === 429 || res.status === 402 || res.status === 403 ? res.status : 502 },
          );
        }

        const audio = await res.arrayBuffer();
        return new Response(audio, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
