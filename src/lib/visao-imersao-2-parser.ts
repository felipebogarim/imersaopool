import { z } from "zod";
import { type FieldImmersionDoc } from "./field-store-visit";

/**
 * Schema oficial para o bloco estruturado visao_imersao_2 no Markdown.
 */
export const Immersion2DataSchema = z.object({
  schema: z.literal("visao_imersao_2_data_v1"),
  client: z.object({
    name: z.string(),
    visit_date: z.string(),
    location: z.string(),
    representative: z.string().optional(),
    consultant: z.string().optional(),
  }),
  brands_observed: z.array(z.string()),
  families_analyzed: z.array(z.string()),
  perspectives: z.array(z.object({
    id: z.string(),
    chapter: z.number(),
    title: z.string(),
  })),
  quotes: z.array(z.object({
    id: z.string(),
    text: z.string(),
    original_author: z.string(),
    original_author_role: z.string().optional(),
    reported_by: z.string().nullable().optional(),
    quote_type: z.enum(["direct", "reported"]),
    chapter: z.number(),
    theme: z.string().optional(),
  })),
  signals: z.array(z.object({
    id: z.string(),
    title: z.string(),
    conclusion: z.string(),
    business_impact: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    perspectives: z.array(z.string()),
    evidence_quotes: z.array(z.string()),
  })),
});

export type Immersion2Data = z.infer<typeof Immersion2DataSchema>;

/**
 * Localiza e extrai o bloco JSON visao_imersao_2 de um markdown.
 * Suporta blocos com ou sem a label de tipo no ```json.
 */
export function extractImmersion2Json(markdown: string): Immersion2Data | null {
  // Regex mais flexível para capturar qualquer bloco de código JSON ou texto que pareça JSON
  // Procure por blocos demarcados com ``` ou apenas conteúdo entre chaves { } que contenha o schema
  
  // 1. Tentar encontrar blocos de código (Markdown)
  const codeBlockRegex = /```(?:json)?\s*(?:visao_imersao_2)?\n([\s\S]+?)\n```/g;
  let matches = Array.from(markdown.matchAll(codeBlockRegex));
  
  for (const match of matches) {
    try {
      const raw = JSON.parse(match[1]);
      if (raw && raw.schema === "visao_imersao_2_data_v1") {
        return Immersion2DataSchema.parse(raw);
      }
    } catch (e) {
      // Se falhou o parse ou o schema não bate, continue tentando outros blocos
      continue;
    }
  }

  // 2. Se não encontrou em blocos demarcados, tentar procurar no texto bruto por algo que pareça o JSON alvo
  // Procuramos por "{", "schema", "visao_imersao_2_data_v1" e "}"
  const rawJsonRegex = /\{[\s\S]*?"schema"\s*:\s*"visao_imersao_2_data_v1"[\s\S]*?\}/g;
  const rawMatches = markdown.match(rawJsonRegex);
  
  if (rawMatches) {
    for (const rawStr of rawMatches) {
      try {
        // Tentar limpar possíveis resíduos de markdown se o regex pegou demais
        const cleaned = rawStr.trim();
        const raw = JSON.parse(cleaned);
        return Immersion2DataSchema.parse(raw);
      } catch (e) {
        continue;
      }
    }
  }

  console.error("[Immersion2Parser] Nenhum bloco JSON válido 'visao_imersao_2_data_v1' encontrado.");
  return null;
}

/**
 * Valida se um sinal atende aos critérios de qualidade da Versão 2.
 */
export function validateSignalV2(signal: Immersion2Data["signals"][0], data: Immersion2Data) {
  const errors: string[] = [];
  
  if (!signal.id || !signal.title || !signal.conclusion || !signal.business_impact) {
    errors.push("Campos obrigatórios ausentes.");
  }

  // Regras de proibição no título
  const title = signal.title || "";
  const invalidPrefixes = ["Impacto comercial", "Evidências principais", "Conclusão", "Confiança"];
  if (invalidPrefixes.some(p => title.startsWith(p))) {
    errors.push(`Título começa com label proibida: ${title}`);
  }
  if (/^Q\d+/.test(title)) {
    errors.push("Título contém apenas IDs de citação.");
  }
  if (title.includes("**")) {
    errors.push("Título contém tokens Markdown.");
  }

  // Vínculos obrigatórios
  if (!signal.perspectives || signal.perspectives.length === 0) {
    errors.push("Sinal sem perspectivas vinculadas.");
  } else {
    // Valida se os IDs existem
    const validPIds = new Set(data.perspectives.map(p => p.id));
    if (!signal.perspectives.every(pid => validPIds.has(pid))) {
      errors.push("Sinal referencia perspectivas inexistentes.");
    }
  }

  if (!signal.evidence_quotes || signal.evidence_quotes.length === 0) {
    errors.push("Sinal sem evidências (citações) vinculadas.");
  } else {
    // Valida se as citações existem
    const validQIds = new Set(data.quotes.map(q => q.id));
    if (!signal.evidence_quotes.every(qid => validQIds.has(qid))) {
      errors.push("Sinal referencia citações inexistentes.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
