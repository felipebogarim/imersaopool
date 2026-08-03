import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ManualContentSchema } from "./manual-schema";

export const generateManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { prompt: string; titulo: string }) => data)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    const system = `Você redige manuais de uso da plataforma PoolFlux (BI comercial, imersões, entrevistas, performance de representantes, price, tarefas).
Retorne APENAS um JSON válido no formato:
{"subtitulo":"","resumo":"","publico_alvo":"","pre_requisitos":["..."],"secoes":[{"titulo":"","texto":"","passos":["..."],"dicas":["..."]}],"faq":[{"pergunta":"","resposta":""}]}
Regras: português claro e direto; 3 a 7 seções; passos numeráveis e acionáveis; sem markdown; sem inventar telas que não foram descritas — quando não souber um detalhe, escreva de forma genérica e orientada ao usuário.`;

    const user = `Título do manual: ${data.titulo}\n\nTema/pedido em linguagem natural:\n"""${data.prompt}"""`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    if (!res.ok) throw new Error(`Falha na IA: ${res.status}`);

    const json = await res.json();
    let parsed: unknown;
    try {
      parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    } catch {
      throw new Error("IA retornou JSON inválido");
    }
    const result = ManualContentSchema.safeParse(parsed);
    if (!result.success) throw new Error("Conteúdo retornado pela IA é inválido");
    return result.data;
  });
