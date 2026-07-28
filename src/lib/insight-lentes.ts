/**
 * Estrutura canônica das Fontes de Insight (8 lentes fixas).
 * Toda fonte, de qualquer tipo, compartilha este esqueleto — é o que torna
 * a síntese cruzada possível entre universos diferentes.
 */

export const FONTE_TIPOS = ["entrevista", "visita_campo", "voz_loja", "diretoria"] as const;
export type FonteTipo = (typeof FONTE_TIPOS)[number];

export const TIPO_LABEL: Record<FonteTipo, string> = {
  entrevista: "Entrevista",
  visita_campo: "Visita de campo",
  voz_loja: "Voz da loja",
  diretoria: "Diretoria",
};

export const LENTES = [
  "marca_preco",
  "mix",
  "concorrencia",
  "argumento",
  "decisao",
  "oportunidades",
  "governanca",
  "adicionais",
] as const;
export type Lente = (typeof LENTES)[number];

export type CampoDef = {
  key: string;
  label: string;
  /** Campo de opinião: valores diferentes entre fontes indicam divergência. */
  opiniao?: boolean;
  /** Campo aceita múltiplos itens (um por linha). */
  multi?: boolean;
};

export const LENTE_DEF: Record<
  Lente,
  { label: string; descricao: string; campos: CampoDef[]; oposicoes?: [string, string][]; acaoCampo?: string }
> = {
  marca_preco: {
    label: "Marca e preço",
    descricao: "Percepção de marca e preço",
    campos: [
      { key: "top_of_mind", label: "Top of mind", opiniao: true },
      { key: "percepcao_preco", label: "Percepção de preço", opiniao: true },
      { key: "checou_tabela", label: "Checou tabela", opiniao: true },
      { key: "evidencia", label: "Evidência" },
    ],
  },
  mix: {
    label: "Mix",
    descricao: "Mix ofertado e esforço de venda",
    campos: [
      { key: "o_que_funciona", label: "O que funciona", multi: true },
      { key: "o_que_nao_funciona", label: "O que não funciona", multi: true },
      { key: "skus_adormecidos", label: "SKUs adormecidos", multi: true },
      { key: "motivo", label: "Motivo" },
      { key: "evidencia", label: "Evidência" },
    ],
    oposicoes: [["o_que_funciona", "o_que_nao_funciona"], ["o_que_funciona", "skus_adormecidos"]],
  },
  concorrencia: {
    label: "Concorrência",
    descricao: "Competição de mercado",
    campos: [
      { key: "concorrente", label: "Concorrente", multi: true },
      { key: "categorias_onde_ganha", label: "Categorias onde ganha", multi: true },
      { key: "evidencia", label: "Evidência" },
    ],
  },
  argumento: {
    label: "Argumento",
    descricao: "Argumento técnico no ponto de venda",
    campos: [
      { key: "produto", label: "Produto", multi: true },
      { key: "objecao", label: "Objeção", multi: true },
      { key: "argumento_usado", label: "Argumento usado", multi: true },
      { key: "qualidade_argumento", label: "Qualidade do argumento", opiniao: true },
      { key: "evidencia", label: "Evidência" },
    ],
  },
  decisao: {
    label: "Decisão",
    descricao: "Critério de decisão do cliente",
    campos: [
      { key: "criterio_declarado", label: "Critério declarado", opiniao: true },
      { key: "criterio_revelado", label: "Critério revelado", opiniao: true },
      { key: "valor_defensavel", label: "Valor defensável" },
      { key: "evidencia", label: "Evidência" },
    ],
    oposicoes: [["criterio_declarado", "criterio_revelado"]],
  },
  oportunidades: {
    label: "Oportunidades",
    descricao: "Oportunidades, ameaças e cuidados",
    campos: [
      { key: "oportunidade", label: "Oportunidade", multi: true },
      { key: "ameaca", label: "Ameaça", multi: true },
      { key: "cuidado", label: "Cuidado", multi: true },
      { key: "acao_sugerida", label: "Ação sugerida", multi: true },
      { key: "evidencia", label: "Evidência" },
    ],
    oposicoes: [["oportunidade", "ameaca"]],
    acaoCampo: "acao_sugerida",
  },
  governanca: {
    label: "Governança",
    descricao: "Governança comercial e autonomia",
    campos: [
      { key: "decisao_mencionada", label: "Decisão mencionada", multi: true },
      { key: "sinal_autonomia", label: "Sinal de autonomia", opiniao: true },
      { key: "impacto_relatado", label: "Impacto relatado" },
      { key: "evidencia", label: "Evidência" },
    ],
  },
  adicionais: {
    label: "Adicionais",
    descricao: "Perfil da carteira / contexto da fonte",
    campos: [
      { key: "perfil_carteira", label: "Perfil da carteira" },
      { key: "clientes_estrategicos", label: "Clientes estratégicos", multi: true },
      { key: "evidencias_documentais", label: "Evidências documentais", multi: true },
    ],
  },
};

export type SinteseCampos = Record<string, string | string[] | null>;

/**
 * Normalização obrigatória de ingestão: toda lente existe e toda chave existe,
 * com `null` explícito quando ausente. Impede comparar campos que faltam.
 */
export function normalizeSinteseCampos(lente: Lente, raw: unknown): SinteseCampos {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: SinteseCampos = {};
  for (const campo of LENTE_DEF[lente].campos) {
    const v = src[campo.key];
    if (v === undefined || v === null || v === "") out[campo.key] = null;
    else if (Array.isArray(v)) {
      const arr = v.map(x => String(x).trim()).filter(Boolean);
      out[campo.key] = arr.length ? arr : null;
    } else out[campo.key] = String(v).trim() || null;
  }
  return out;
}

export function normalizeHighlights(raw: unknown): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map(x => (typeof x === "string" ? x : (x as any)?.texto ?? ""))
    .map(s => String(s).trim())
    .filter(Boolean)
    .slice(0, 4);
}

export function toValues(v: string | string[] | null | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map(s => String(s).trim()).filter(Boolean);
}
