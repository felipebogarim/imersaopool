import { createFileRoute } from "@tanstack/react-router";

/** Converte um trecho de texto em áudio (MP3) usando a IA da plataforma. */
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeAiRequest } = await import("@/lib/ai-endpoint-auth.server");
        const authz = await authorizeAiRequest(request);
        if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status });

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "Serviço de IA indisponível." }, { status: 503 });

        let body: { text?: string; voice?: string };
        try {
          body = (await request.json()) as { text?: string; voice?: string };
        } catch {
          return Response.json({ error: "Requisição inválida" }, { status: 400 });
        }
        const text = String(body.text ?? "").trim();
        if (!text) return Response.json({ error: "Texto vazio" }, { status: 400 });
        if (text.length > 4000)
          return Response.json({ error: "Texto muito longo" }, { status: 400 });

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
              "Leia integral e literalmente apenas o texto fornecido, em português do Brasil, com ritmo calmo e profissional, pausa clara entre capítulos e itens e ênfase nos títulos. Ao terminar a última palavra fornecida, encerre o áudio imediatamente. Não acrescente conclusão, resumo, despedida, comentário ou qualquer outro texto.",
          }),
        });

        if (!res.ok) {
          // Detalhe do provedor só no log do servidor (não expõe resposta bruta ao cliente).
          console.error(
            "[api/tts] falha no provedor",
            res.status,
            await res.text().catch(() => ""),
          );
          const status = res.status === 429 || res.status === 402 ? res.status : 502;
          return Response.json(
            {
              error:
                status === 429
                  ? "Limite de uso atingido. Tente novamente em instantes."
                  : "Falha ao gerar áudio.",
            },
            { status },
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
