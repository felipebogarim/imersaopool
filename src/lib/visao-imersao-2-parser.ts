import { z } from "zod";
import { type FieldImmersionDoc } from "./field-store-visit";

/**
 * Schema oficial para o bloco estruturado visao_imersao_2 no Markdown.
 */
export const Immersion2DataSchema = z.object({
  block: z.string().optional(),
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
  // 1. Tentar encontrar blocos de código (Markdown) com o delimitador específico 'visao_imersao_2'
  // ou simplesmente blocos json.
  // Regex mais agressiva para blocos de código com qualquer label ou sem label
  const codeBlockRegex = /```[\w-]*\s*([\s\S]+?)\s*```/gi;
  let matches = Array.from(markdown.matchAll(codeBlockRegex));
  
  for (const match of matches) {
    try {
      // Limpeza agressiva para lidar com o formato específico:
      // ```visao_imersao_2
      // { ... }
      // ```
      let rawText = match[1].trim();
      
      // Sanitização profunda: remove comentários e lida com carácteres especiais
      rawText = rawText.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      rawText = rawText.replace(/^\uFEFF/, "");
      
      // Tenta localizar o JSON dentro do bloco se houver texto extra
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        rawText = rawText.substring(firstBrace, lastBrace + 1);
      }

      const raw = JSON.parse(rawText);
      if (raw && (raw.schema === "visao_imersao_2_data_v1" || raw.visao_imersao_2_data_v1)) {
        const data = raw.schema === "visao_imersao_2_data_v1" ? raw : raw.visao_imersao_2_data_v1;
        return Immersion2DataSchema.parse(data);
      }
    } catch (e) {
      console.warn("[Immersion2Parser] Erro ao parsear bloco JSON estruturado:", e);
      continue;
    }
  }

  // 2. Fallback: procurar por qualquer coisa que pareça um JSON e tenha o schema alvo
  // (Lida com o caso onde o usuário colou o JSON sem cercas de markdown ou com cercas quebradas)
  const rawJsonRegex = /\{[\s\S]*?"schema"\s*:\s*"visao_imersao_2_data_v1"[\s\S]*?\}/g;
  const rawMatches = markdown.match(rawJsonRegex);
  
  if (rawMatches) {
    for (const rawStr of rawMatches) {
      try {
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
  const invalidPrefixes = ["Impacto comercial", "Evidências principais", "Conclusão"];
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

/**
 * Detecção com PRIORIDADE do padrão Visão Imersão 2 sobre o legado
 * field_store_visit_v1. Ordem: (1) bloco fenced ```visao_imersao_2,
 * (2) qualquer bloco/trecho contendo o schema canônico.
 */
export function detectVisaoImersao2(rawText: string): Immersion2Data | null {
  const fenced = /```[ \t]*(?:json[ \t]+)?visao_imersao_2[^\n]*\n([\s\S]*?)```/gi;
  for (const m of Array.from(rawText.matchAll(fenced))) {
    try {
      let body = m[1].replace(/^\uFEFF/, "").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      const a = body.indexOf("{");
      const b = body.lastIndexOf("}");
      if (a === -1 || b === -1) continue;
      const raw = JSON.parse(body.slice(a, b + 1));
      const data = raw?.schema === "visao_imersao_2_data_v1" ? raw : raw?.visao_imersao_2_data_v1;
      if (!data) continue;
      if (data.block && data.block !== "visao_imersao_2") continue;
      return Immersion2DataSchema.parse(data);
    } catch {
      continue;
    }
  }
  return extractImmersion2Json(rawText);
}
