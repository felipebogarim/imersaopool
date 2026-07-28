import { LENTE_DEF, type Lente } from "@/lib/insight-lentes";
import type { SinteseResultado } from "@/lib/sintese-engine";

/**
 * Camada 2 da consolidação: a IA apenas REDIGE melhor e escolhe a fala mais forte,
 * além de apontar divergências semânticas. Ela nunca cria pontos novos —
 * opera somente sobre os itens determinísticos, que já carregam suas fontes.
 */
export async function refinarComIA(base: SinteseResultado): Promise<SinteseResultado> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return base;

  const payload: Record<string, unknown> = {};
  for (const [lente, r] of Object.entries(base.lentes)) {
    if (!r.convergencia.length && !r.divergencia.length) continue;
    payload[lente] = {
      lente: LENTE_DEF[lente as Lente]?.label ?? lente,
      convergencia: r.convergencia.slice(0, 8).map((c, i) => ({ i, texto: c.texto, peso: c.peso })),
      divergencia: r.divergencia.slice(0, 6).map((d, i) => ({ i, tema: d.tema, posicoes: d.posicoes.map(p => p.posicao) })),
    };
  }
  if (!Object.keys(payload).length) return base;

  const prompt = `Você refina a REDAÇÃO de um painel de síntese comercial já consolidado.

Regras absolutas:
- Nunca invente pontos novos, nunca remova itens, nunca troque o sentido.
- Apenas reescreva cada item de forma curta, clara e estratégica (máx. 140 caracteres).
- Mantenha exatamente os mesmos índices "i".
- Nunca cite valores monetários absolutos.

Entrada:
${JSON.stringify(payload, null, 2)}

Retorne JSON no formato:
{"<lente>":{"convergencia":[{"i":0,"texto":"..."}],"divergencia":[{"i":0,"tema":"..."}]}}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você retorna somente JSON válido." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return base;
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");

    for (const [lente, r] of Object.entries(base.lentes)) {
      const ref = parsed?.[lente];
      if (!ref) continue;
      for (const c of ref.convergencia ?? []) {
        const item = r.convergencia[c?.i];
        if (item && typeof c.texto === "string" && c.texto.trim()) item.texto = c.texto.trim();
      }
      for (const d of ref.divergencia ?? []) {
        const item = r.divergencia[d?.i];
        if (item && typeof d.tema === "string" && d.tema.trim()) item.tema = d.tema.trim();
      }
    }
  } catch {
    return base;
  }
  return base;
}
