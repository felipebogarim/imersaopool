import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type FamiliaResultado = {
  familia: string;
  atingimento: number | null;
  participacao?: number | null;
  farol: string | null;
};

type ClientBIData = {
  geral: number | null;
  categoria: string | null;
  familias: FamiliaResultado[];
  melhor_familia: { label: string | null; atingimento: number | null };
  pior_familia: { label: string | null; atingimento: number | null };
  distribuicao_farol: Array<{ grupo: string; quantidade: number }>;
};

const fmtPct = (n: number | null | undefined): string => {
  if (n == null || Number.isNaN(n)) return "—";
  const v = Math.abs(n) <= 1.5 ? n * 100 : n;
  return `${v.toFixed(1).replace(".", ",")}%`;
};

export const askBIAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { repId: string; question: string }) => {
    if (!data?.repId) throw new Error("repId ausente");
    if (!data?.question?.trim()) throw new Error("Pergunta vazia");
    if (data.question.length > 500) throw new Error("Pergunta muito longa");
    return data;
  })
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    // Busca uploads ativos de BI dos clientes deste representante — RLS aplica.
    const { data: rows, error } = await (context.supabase as any)
      .from("client_bi_uploads")
      .select("razao_social, data")
      .eq("representative_id", data.repId)
      .eq("kind", "bi")
      .is("substituida_em", null);
    if (error) throw new Error(error.message);

    const clientes = (rows ?? [])
      .map((r: any) => {
        const d = r.data as ClientBIData | null;
        if (!d) return null;
        return {
          cliente: r.razao_social,
          categoria: d.categoria,
          atingimento_geral: fmtPct(d.geral),
          melhor_familia: d.melhor_familia?.label,
          pior_familia: d.pior_familia?.label,
          familias: (d.familias ?? []).map((f) => ({
            familia: f.familia,
            atingimento: fmtPct(f.atingimento),
            participacao: fmtPct(f.participacao),
            farol: f.farol,
          })),
        };
      })
      .filter(Boolean);

    if (clientes.length === 0) {
      return {
        answer:
          "Ainda não há planilhas de BI dos clientes carregadas para este representante. Carregue os BIs para eu poder responder.",
      };
    }

    const system = [
      "Você é um analista de BI comercial.",
      "REGRAS INEGOCIÁVEIS:",
      "1. NUNCA cite números absolutos, valores em R$, quantidades brutas ou volumes.",
      "2. Só use percentuais (%), faixas do farol e categorias (Black/Gold/Silver).",
      "3. Se o usuário pedir números, responda apenas com percentuais equivalentes.",
      "4. Baseie-se somente nos dados JSON fornecidos abaixo. Não invente clientes ou famílias.",
      "5. Responda em português do Brasil, direto, em listas curtas quando fizer sentido.",
      "6. 'Não comprou / 0%' = atingimento 0,0% na família.",
      "",
      "DADOS (clientes deste representante):",
      JSON.stringify(clientes),
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.question },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw new Error(`Falha na IA: ${res.status} ${t}`);
    }
    const json: any = await res.json();
    const answer: string = json?.choices?.[0]?.message?.content ?? "";
    return { answer };
  });
