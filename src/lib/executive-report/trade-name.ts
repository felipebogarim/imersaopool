// Extração e resolução inteligente de Nome Fantasia a partir de transcrições,
// leitura executiva, citações de imersão e cadastro comercial.

export interface ExtractTradeNameOptions {
  explicitTradeName?: string | null;
  razaoSocial?: string | null;
  textSources?: (string | null | undefined)[];
  structuredData?: unknown;
  dbTradeName?: string | null;
}

/** Limpa e normaliza espaços. */
function clean(str: unknown): string {
  if (typeof str !== "string") return "";
  return str.replace(/\s+/g, " ").trim();
}

/**
 * Coleta todas as strings de texto das fontes (transcrições brutas, markdown,
 * citações estruturadas, sínteses).
 */
function collectAllTexts(
  textSources: (string | null | undefined)[] = [],
  structuredData?: unknown
): string[] {
  const texts: string[] = [];

  for (const src of textSources) {
    if (src && typeof src === "string") {
      texts.push(src);
    }
  }

  if (structuredData && typeof structuredData === "object") {
    const root: any = (structuredData as any)?.data ?? structuredData;
    // Citações literais de entrevistas/transcrições
    if (Array.isArray(root?.quotes)) {
      for (const q of root.quotes) {
        if (q?.text) texts.push(String(q.text));
      }
    }
    // Sinais / conclusões
    if (Array.isArray(root?.signals)) {
      for (const s of root.signals) {
        if (s?.title) texts.push(String(s.title));
        if (s?.conclusion) texts.push(String(s.conclusion));
        if (s?.business_impact) texts.push(String(s.business_impact));
      }
    }
    // Revisão de capítulos
    if (Array.isArray(root?.chapter_review)) {
      for (const cr of root.chapter_review) {
        if (Array.isArray(cr?.items)) {
          for (const item of cr.items) {
            if (item?.headline) texts.push(String(item.headline));
            if (item?.executive_reading) texts.push(String(item.executive_reading));
            if (item?.implication) texts.push(String(item.implication));
          }
        }
      }
    }
  }

  return texts;
}

/**
 * Mapeamentos canônicos conhecidos de Razão Social -> Nome Fantasia
 * validados no contexto das imersões.
 */
const CANONICAL_MAPPINGS: Array<{
  matchRazao: RegExp;
  tradeName: string;
  transcriptKeywords?: RegExp[];
}> = [
  {
    // Clara Iluminação / CLARA ILUMINACAO LTDA -> Arquiluz
    matchRazao: /\bclara\b/i,
    tradeName: "Arquiluz",
    transcriptKeywords: [/\barq(?:ui)?luz\b/i, /\barqluz\b/i, /\barquiluz\b/i],
  },
];

/**
 * Extrai o nome fantasia com base nas transcrições/leituras e cadastro comercial.
 * Segue a regra de negócio do projeto:
 * 1. Nome fantasia explicitamente informado.
 * 2. Casos canônicos com base nas transcrições (ex.: Clara -> menções a Arqluz/Arquiluz -> "Arquiluz").
 * 3. Heurísticas de transcrição e citações ("A [Loja] é...", "para a [Loja]", "equipe da [Loja]").
 * 4. Nome fantasia registrado no banco (clients.nome_fantasia).
 */
export function extractTradeName(options: ExtractTradeNameOptions): string | null {
  const explicit = clean(options.explicitTradeName);
  if (explicit) return explicit;

  const razao = clean(options.razaoSocial);
  const allTexts = collectAllTexts(options.textSources, options.structuredData);
  const combinedText = allTexts.join("\n");

  // 1. Checagem por mapeamentos canônicos combinados com transcrições
  if (razao) {
    for (const mapping of CANONICAL_MAPPINGS) {
      if (mapping.matchRazao.test(razao)) {
        if (!mapping.transcriptKeywords || mapping.transcriptKeywords.length === 0) {
          return mapping.tradeName;
        }
        // Verifica se qualquer palavra-chave aparece nas transcrições/textos
        const foundInTranscripts = mapping.transcriptKeywords.some((re) =>
          re.test(combinedText)
        );
        if (foundInTranscripts || !combinedText) {
          return mapping.tradeName;
        }
      }
    }
  }

  // 2. Procura direta nas transcrições por padrões da Clara caso a razão social não esteja informada
  if (/\b(?:arqluz|arquiluz)\b/i.test(combinedText)) {
    return "Arquiluz";
  }

  // 3. Heurística genérica de extração das transcrições:
  // "A [Loja] é maior faturamento...", "A [Loja] é o top 2...", etc.
  const topMatch = combinedText.match(/\bA\s+([A-Z0-9À-Ú]{3,20}(?:\s+[A-Z0-9À-Ú]{3,20})?)\s+é\s+(?:o|a)?\s*(?:maior|top|uma|referência)/i);
  if (topMatch && topMatch[1]) {
    const candidate = topMatch[1].trim();
    if (candidate.toLowerCase() !== razao.toLowerCase()) {
      return candidate;
    }
  }

  // 4. Fallback: nome fantasia do cadastro no banco
  const dbTrade = clean(options.dbTradeName);
  if (dbTrade && dbTrade.toLowerCase() !== razao.toLowerCase()) {
    return dbTrade;
  }

  return null;
}
