import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FormSchemaSchema } from "./form-schema";

export const generateFormSchema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { prompt: string; title: string }) => data)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    const system = `Você é um gerador de formulários. Recebe uma descrição em linguagem natural e retorna APENAS um JSON válido no formato:
{"fields":[{"id":"snake_case","label":"Rótulo","type":"text|textarea|email|number|select|radio|checkbox|date","required":true,"placeholder":"opcional","help":"opcional","options":[{"value":"v","label":"L"}]}]}
Regras:
- id em snake_case único, curto, sem acentos.
- Escolha o tipo mais adequado a cada pergunta.
- "options" só quando type for select/radio/checkbox.
- Máximo 20 campos. Sem markdown, sem comentários, apenas o JSON.`;

    const user = `Título do formulário: ${data.title}\n\nDescrição do que o formulário precisa capturar:\n"""${data.prompt}"""`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Falha na IA: ${res.status} ${t.slice(0, 200)}`);
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("IA retornou JSON inválido");
    }

    const result = FormSchemaSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("Esquema retornado pela IA é inválido");
    }
    return result.data;
  });
