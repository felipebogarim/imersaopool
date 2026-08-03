// Núcleo de regras do módulo Price › Comparativos.
// Lógica pura (sem React, sem Supabase) para normalização de valores,
// cálculo de proximidade técnica, classificação de equivalência,
// farol por célula, faróis de preço e índice de custo-benefício.

// ============ Tipos ============

export type EquivalenceLevel =
  | "direto"
  | "aproximado"
  | "alternativo"
  | "incompativel"
  | "insuficiente";

export type EquivalenceStatus = "em_analise" | "validado" | "incompativel";

export type Confidence =
  | "catalogo"
  | "tabela_precos"
  | "ficha_tecnica"
  | "fornecedor"
  | "excel"
  | "pdf"
  | "ocr"
  | "herdado"
  | "estimado"
  | "manual"
  | "nao_informado"
  | "pendente";

export type CellFarol = "igual" | "moderado" | "relevante" | "incompativel" | "sem_dado";

export type PriceFarol = "menor" | "proximo" | "superior" | "muito_superior" | "sem_dado";

export type PriceAvailability =
  | "informado"
  | "nao_informado"
  | "sob_consulta"
  | "nao_aplicavel"
  | "indisponivel"
  | "retirado";

export type ComparisonRule = {
  attribute_key: string;
  attribute_name: string;
  weight: number;
  tolerance_direct: number;
  tolerance_approximate: number;
  is_critical: boolean;
  is_eliminatory: boolean;
  missing_data_penalty: number;
};

export type SpecValue = {
  attribute_key: string;
  original_value: string | null;
  normalized_value: string | null;
  value_numeric: number | null;
  value_text: string | null;
  original_unit?: string | null;
  normalized_unit?: string | null;
  confidence_level?: Confidence;
};

export type ProductLike = {
  id: string;
  marca: string;
  nome: string;
  sku: string | null;
  referencia: string | null;
  familia: string;
  categoria: string;
  tipo: string | null;
  specs: Record<string, SpecValue>;
  preco: number | null;
  precoDisponibilidade?: PriceAvailability;
  precoPorMetro?: number | null;
  precoPorWatt?: number | null;
  precoPor1000lm?: number | null;
};

export type AttributeComparison = {
  attributeKey: string;
  attributeName: string;
  base: SpecValue | null;
  comparado: SpecValue | null;
  farol: CellFarol;
  deltaPct: number | null;
  descricao: string;
  peso: number;
  eliminatorio: boolean;
};

export type ScoreResult = {
  score: number | null;
  level: EquivalenceLevel;
  atributos: AttributeComparison[];
  semelhancas: string[];
  diferencas: string[];
  impactos: string[];
  avisos: string[];
  cobertura: number; // % de peso com dado nos dois lados
  eliminado: boolean;
};

export const CALCULATION_VERSION = "v1";

// ============ Rótulos ============

export const LEVEL_LABEL: Record<EquivalenceLevel, string> = {
  direto: "Equivalente direto",
  aproximado: "Equivalente aproximado",
  alternativo: "Alternativo",
  incompativel: "Incompatível tecnicamente",
  insuficiente: "Dados insuficientes",
};

export const LEVEL_DESCRIPTION: Record<EquivalenceLevel, string> = {
  direto:
    "Produto tecnicamente muito próximo da referência, com baixa necessidade de adaptação.",
  aproximado:
    "Produto comparável, mas com diferenças técnicas que precisam ser avaliadas.",
  alternativo:
    "Produto destinado a uma aplicação semelhante, mas que altera um atributo estrutural.",
  incompativel:
    "As diferenças técnicas impedem a substituição direta ou alteram significativamente a aplicação.",
  insuficiente:
    "Não existem informações suficientes para determinar a equivalência com segurança.",
};

/** Classe de cor por classificação — usa apenas tokens semânticos do tema. */
export const LEVEL_CLASS: Record<EquivalenceLevel, string> = {
  direto: "bg-emerald-500/12 text-emerald-600 border-emerald-500/30",
  aproximado: "bg-amber-500/12 text-amber-600 border-amber-500/30",
  alternativo: "bg-orange-500/12 text-orange-600 border-orange-500/30",
  incompativel: "bg-destructive/10 text-destructive border-destructive/30",
  insuficiente: "bg-muted text-muted-foreground border-border",
};

export const STATUS_LABEL: Record<EquivalenceStatus, string> = {
  em_analise: "Em análise",
  validado: "Validado",
  incompativel: "Incompatível",
};

export const STATUS_CLASS: Record<EquivalenceStatus, string> = {
  em_analise: "bg-amber-500/12 text-amber-600 border-amber-500/30",
  validado: "bg-emerald-500/12 text-emerald-600 border-emerald-500/30",
  incompativel: "bg-destructive/10 text-destructive border-destructive/30",
};

export const CELL_FAROL_LABEL: Record<CellFarol, string> = {
  igual: "Igual ou muito próximo",
  moderado: "Diferença moderada",
  relevante: "Diferença relevante",
  incompativel: "Incompatível",
  sem_dado: "Não informado",
};

export const CELL_FAROL_CLASS: Record<CellFarol, string> = {
  igual: "bg-emerald-500/10 text-emerald-600",
  moderado: "bg-amber-500/10 text-amber-600",
  relevante: "bg-orange-500/10 text-orange-600",
  incompativel: "bg-destructive/10 text-destructive",
  sem_dado: "bg-muted text-muted-foreground",
};

export const PRICE_FAROL_LABEL: Record<PriceFarol, string> = {
  menor: "Menor que a referência",
  proximo: "Próximo da referência",
  superior: "Superior à referência",
  muito_superior: "Muito superior à referência",
  sem_dado: "Preço não disponível",
};

export const PRICE_FAROL_CLASS: Record<PriceFarol, string> = {
  menor: "bg-emerald-500/10 text-emerald-600",
  proximo: "bg-sky-500/10 text-sky-600",
  superior: "bg-amber-500/10 text-amber-600",
  muito_superior: "bg-destructive/10 text-destructive",
  sem_dado: "bg-muted text-muted-foreground",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  catalogo: "Confirmado em catálogo",
  tabela_precos: "Confirmado em tabela de preços",
  ficha_tecnica: "Confirmado em ficha técnica",
  fornecedor: "Informado pelo fornecedor",
  excel: "Importado de Excel",
  pdf: "Extraído de PDF",
  ocr: "Extraído por OCR",
  herdado: "Herdado da família",
  estimado: "Estimado",
  manual: "Editado manualmente",
  nao_informado: "Não informado",
  pendente: "Pendente de validação",
};

export const PRICE_AVAILABILITY_LABEL: Record<PriceAvailability, string> = {
  informado: "Informado",
  nao_informado: "Não informado",
  sob_consulta: "Sob consulta",
  nao_aplicavel: "Não aplicável",
  indisponivel: "Preço indisponível",
  retirado: "Produto retirado",
};

// ============ Hierarquia de produtos ============

export const FAMILIAS = [
  "Fitas e Fontes",
  "Lâmpadas",
  "Luminárias Técnicas",
  "Luminárias Decorativas",
  "Perfis",
  "Jardim",
  "Sistemas Lineares",
  "Controles e Automação",
] as const;

export const CATEGORIAS: Record<string, string[]> = {
  "Fitas e Fontes": [
    "Fitas LED",
    "Fontes e Drivers",
    "Controladores",
    "Dimmers",
    "Amplificadores",
    "Conectores",
    "Acessórios",
  ],
};

export const TIPOS: Record<string, string[]> = {
  "Fitas LED": [
    "SMD",
    "COB",
    "RGB",
    "RGBW",
    "CCT",
    "Neon Flex",
    "Alta eficiência",
    "Longa distância",
    "IP20",
    "IP65",
    "IP67",
    "IP68",
  ],
  "Fontes e Drivers": [
    "Tensão constante",
    "Corrente constante",
    "Dimerizável",
    "Não dimerizável",
    "TRIAC",
    "DALI",
    "0 a 10 V",
    "PWM",
    "IP20",
    "IP65",
    "IP67",
  ],
};

/** Atributos de Fitas LED na ordem canônica da planilha modelo. */
export const FITA_ATTRIBUTES: { key: string; name: string; unit?: string }[] = [
  { key: "tecnologia", name: "Tecnologia" },
  { key: "tensao", name: "Tensão", unit: "V" },
  { key: "potencia_m", name: "Potência / m", unit: "W/m" },
  { key: "fluxo_m", name: "Fluxo luminoso / m", unit: "lm/m" },
  { key: "irc", name: "IRC" },
  { key: "cct", name: "CCT", unit: "K" },
  { key: "eficiencia", name: "Eficiência", unit: "lm/W" },
  { key: "ip", name: "IP" },
  { key: "leds_m", name: "LEDs por metro", unit: "un/m" },
  { key: "largura", name: "Largura", unit: "mm" },
  { key: "comprimento", name: "Comprimento", unit: "mm" },
  { key: "layer", name: "Layer" },
  { key: "vida_util", name: "Vida útil", unit: "h" },
  { key: "cut_size", name: "Corte" },
  { key: "sdcm", name: "SDCM" },
  { key: "bobina", name: "Bobina", unit: "m" },
];

export const DRIVER_ATTRIBUTES: { key: string; name: string; unit?: string }[] = [
  { key: "tipo_saida", name: "Tipo de saída" },
  { key: "tensao_entrada", name: "Tensão de entrada", unit: "V" },
  { key: "tensao_saida", name: "Tensão de saída", unit: "V" },
  { key: "potencia_nominal", name: "Potência nominal", unit: "W" },
  { key: "potencia_utilizavel", name: "Potência utilizável", unit: "W" },
  { key: "corrente_saida", name: "Corrente de saída", unit: "A" },
  { key: "fator_potencia", name: "Fator de potência" },
  { key: "eficiencia", name: "Eficiência", unit: "%" },
  { key: "ip", name: "IP" },
  { key: "dimerizacao", name: "Dimerização" },
  { key: "protocolo", name: "Protocolo" },
  { key: "ripple", name: "Ripple", unit: "%" },
  { key: "protecoes", name: "Proteções" },
  { key: "dimensoes", name: "Dimensões" },
  { key: "vida_util", name: "Vida útil", unit: "h" },
  { key: "garantia", name: "Garantia" },
];

export function attributesFor(categoria: string) {
  return categoria === "Fontes e Drivers" ? DRIVER_ATTRIBUTES : FITA_ATTRIBUTES;
}

/** Atributos tratados como texto/categoria (comparação por igualdade). */
const TEXT_ATTRS = new Set([
  "tecnologia",
  "ip",
  "layer",
  "sdcm",
  "cut_size",
  "tipo_saida",
  "dimerizacao",
  "protocolo",
  "protecoes",
  "dimensoes",
  "garantia",
]);

// ============ Normalização ============

/** Converte texto livre em número, tolerando vírgula decimal, unidades e ">"/"<". */
export function parseNumeric(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/\u00a0/g, " ");
  // "25000h", "5W/m", ">90", "<3", "IP65", "3 LEDs"
  const m = s.match(/-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  let n = m[0];
  if (n.includes(",") && n.includes(".")) n = n.replace(/\./g, "").replace(",", ".");
  else if (n.includes(",")) n = n.replace(",", ".");
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

/** Normaliza texto para comparação (maiúsculas, sem acento, espaços colapsados). */
export function normalizeText(raw: unknown): string {
  if (raw == null) return "";
  return String(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Constrói uma SpecValue preservando sempre o valor original. */
export function buildSpec(
  attributeKey: string,
  original: unknown,
  confidence: Confidence = "excel",
  unit?: string,
): SpecValue | null {
  if (original == null || String(original).trim() === "") return null;
  const originalValue = String(original).trim();
  const numeric = TEXT_ATTRS.has(attributeKey) ? null : parseNumeric(originalValue);
  return {
    attribute_key: attributeKey,
    original_value: originalValue,
    normalized_value: numeric != null ? String(numeric) : normalizeText(originalValue),
    value_numeric: numeric,
    value_text: numeric == null ? normalizeText(originalValue) : null,
    original_unit: unit ?? null,
    normalized_unit: unit ?? null,
    confidence_level: confidence,
  };
}

export function formatSpec(spec: SpecValue | null | undefined, unit?: string): string {
  if (!spec) return "—";
  const base = spec.original_value ?? spec.normalized_value ?? "—";
  if (unit && !base.toLowerCase().includes(unit.toLowerCase())) return `${base} ${unit}`;
  return base;
}

// ============ Comparação por atributo ============

function compareAttribute(
  rule: ComparisonRule,
  name: string,
  base: SpecValue | null,
  comp: SpecValue | null,
): AttributeComparison {
  const common = {
    attributeKey: rule.attribute_key,
    attributeName: name,
    base,
    comparado: comp,
    peso: rule.weight,
    eliminatorio: rule.is_eliminatory,
  };

  if (!base || !comp) {
    return {
      ...common,
      farol: "sem_dado",
      deltaPct: null,
      descricao: "Informação não disponível para comparar.",
    };
  }

  // Comparação textual/categórica
  if (base.value_numeric == null || comp.value_numeric == null) {
    const igual = normalizeText(base.original_value) === normalizeText(comp.original_value);
    return {
      ...common,
      farol: igual ? "igual" : rule.is_eliminatory ? "incompativel" : "relevante",
      deltaPct: null,
      descricao: igual
        ? `Mesmo ${name.toLowerCase()} (${base.original_value}).`
        : `${name}: ${base.original_value} contra ${comp.original_value}.`,
    };
  }

  const b = base.value_numeric;
  const c = comp.value_numeric;
  const delta = b === 0 ? (c === 0 ? 0 : 100) : ((c - b) / Math.abs(b)) * 100;
  const abs = Math.abs(delta);

  let farol: CellFarol;
  if (abs <= rule.tolerance_direct) farol = "igual";
  else if (abs <= rule.tolerance_approximate) farol = "moderado";
  else if (rule.is_eliminatory) farol = "incompativel";
  else farol = abs <= rule.tolerance_approximate * 2 ? "relevante" : "incompativel";

  const sinal = delta > 0 ? "superior" : "inferior";
  return {
    ...common,
    farol,
    deltaPct: delta,
    descricao:
      abs <= rule.tolerance_direct
        ? `${name} equivalente (${base.original_value} contra ${comp.original_value}).`
        : `${name} ${Math.abs(delta).toFixed(1).replace(".", ",")}% ${sinal} (${base.original_value} contra ${comp.original_value}).`,
  };
}

const FAROL_SCORE: Record<CellFarol, number> = {
  igual: 1,
  moderado: 0.7,
  relevante: 0.35,
  incompativel: 0,
  sem_dado: 0,
};

const IMPACTO_POR_ATRIBUTO: Record<string, string> = {
  largura: "Pode exigir perfil de instalação com largura diferente.",
  irc: "Pode reduzir a fidelidade de cor da aplicação.",
  cut_size: "Pode reduzir a flexibilidade de corte e instalação.",
  potencia_m: "Pode exigir revisão do dimensionamento da fonte.",
  fluxo_m: "Pode alterar o nível de iluminação projetado.",
  tensao: "Exige revisão completa da fonte e do circuito.",
  ip: "Pode restringir o uso em ambientes úmidos ou externos.",
  cct: "Altera a temperatura de cor percebida no ambiente.",
  eficiencia: "Pode alterar o consumo de energia da instalação.",
  vida_util: "Pode antecipar a necessidade de manutenção.",
  potencia_utilizavel: "Pode exigir revisão da carga conectada ao driver.",
  dimerizacao: "Pode inviabilizar o sistema de controle previsto.",
  tensao_saida: "Incompatível com a carga prevista sem troca de projeto.",
};

/** Calcula proximidade técnica (0 a 100) e classifica a equivalência. */
export function scoreEquivalence(
  base: ProductLike,
  comp: ProductLike,
  rules: ComparisonRule[],
  attrNames: Record<string, string>,
): ScoreResult {
  const atributos: AttributeComparison[] = [];
  let pesoTotal = 0;
  let pesoComDado = 0;
  let somaPonderada = 0;
  let eliminado = false;
  const avisos: string[] = [];

  for (const rule of rules) {
    const name = attrNames[rule.attribute_key] ?? rule.attribute_name;
    const cmp = compareAttribute(
      rule,
      name,
      base.specs[rule.attribute_key] ?? null,
      comp.specs[rule.attribute_key] ?? null,
    );
    atributos.push(cmp);
    pesoTotal += rule.weight;

    if (cmp.farol === "sem_dado") {
      // Penalização por dado ausente: não inventa valor, apenas reduz a nota.
      const penal = Math.max(0, Math.min(100, rule.missing_data_penalty)) / 100;
      somaPonderada += rule.weight * (1 - penal) * 0;
      avisos.push(`Sem dado de ${name} em um dos produtos.`);
      continue;
    }
    pesoComDado += rule.weight;
    somaPonderada += rule.weight * FAROL_SCORE[cmp.farol];
    if (rule.is_eliminatory && cmp.farol === "incompativel") eliminado = true;
  }

  const cobertura = pesoTotal > 0 ? (pesoComDado / pesoTotal) * 100 : 0;
  const score = pesoTotal > 0 ? Math.round((somaPonderada / pesoTotal) * 1000) / 10 : null;

  const semelhancas = atributos
    .filter((a) => a.farol === "igual")
    .map((a) => a.descricao);
  const diferencas = atributos
    .filter((a) => a.farol === "moderado" || a.farol === "relevante" || a.farol === "incompativel")
    .map((a) => a.descricao);
  const impactos = Array.from(
    new Set(
      atributos
        .filter((a) => a.farol === "relevante" || a.farol === "incompativel")
        .map((a) => IMPACTO_POR_ATRIBUTO[a.attributeKey])
        .filter((x): x is string => !!x),
    ),
  );

  let level: EquivalenceLevel;
  if (cobertura < 50 || score == null) level = "insuficiente";
  else if (eliminado) level = "incompativel";
  else if (score >= 90) level = "direto";
  else if (score >= 75) level = "aproximado";
  else if (score >= 60) level = "alternativo";
  else if (score >= 40) level = "alternativo";
  else level = "incompativel";

  return { score, level, atributos, semelhancas, diferencas, impactos, avisos, cobertura, eliminado };
}

export function faixaTextual(score: number | null): string {
  if (score == null) return "Sem cálculo";
  if (score >= 90) return "Equivalência muito alta";
  if (score >= 75) return "Equivalência alta";
  if (score >= 60) return "Equivalência moderada";
  if (score >= 40) return "Equivalência baixa";
  return "Incompatibilidade ou baixa correspondência";
}

// ============ Preço ============

export function priceFarol(base: number | null, comp: number | null): PriceFarol {
  if (base == null || comp == null || base <= 0) return "sem_dado";
  const diff = ((comp - base) / base) * 100;
  if (diff < -3) return "menor";
  if (diff <= 3) return "proximo";
  if (diff <= 25) return "superior";
  return "muito_superior";
}

export function formatBRL(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPctDiff(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = Math.abs(v).toFixed(1).replace(".", ",");
  if (Math.abs(v) < 0.05) return "0,0%";
  return `${v > 0 ? "+" : "−"}${s}%`;
}

// ============ Custo-benefício ============

export type CostBenefitWeights = {
  proximidade: number;
  preco: number;
  eficiencia: number;
  irc: number;
  vidaUtil: number;
  qualidadeDados: number;
};

export const DEFAULT_CB_WEIGHTS: CostBenefitWeights = {
  proximidade: 35,
  preco: 30,
  eficiencia: 12,
  irc: 8,
  vidaUtil: 5,
  qualidadeDados: 10,
};

function ratioScore(base: number | null, comp: number | null, maiorMelhor = true): number | null {
  if (base == null || comp == null || base <= 0) return null;
  const r = comp / base;
  const v = maiorMelhor ? r : 1 / r;
  return Math.max(0, Math.min(100, v * 70));
}

/** Índice de custo-benefício de 0 a 100. */
export function costBenefit(
  base: ProductLike,
  comp: ProductLike,
  score: number | null,
  cobertura: number,
  w: CostBenefitWeights = DEFAULT_CB_WEIGHTS,
): { valor: number | null; categoria: string } {
  const parts: { peso: number; valor: number }[] = [];
  const push = (peso: number, valor: number | null) => {
    if (valor != null && Number.isFinite(valor)) parts.push({ peso, valor });
  };

  push(w.proximidade, score);
  push(w.preco, ratioScore(base.preco, comp.preco, false));
  push(
    w.eficiencia,
    ratioScore(
      base.specs["eficiencia"]?.value_numeric ?? null,
      comp.specs["eficiencia"]?.value_numeric ?? null,
    ),
  );
  push(
    w.irc,
    ratioScore(base.specs["irc"]?.value_numeric ?? null, comp.specs["irc"]?.value_numeric ?? null),
  );
  push(
    w.vidaUtil,
    ratioScore(
      base.specs["vida_util"]?.value_numeric ?? null,
      comp.specs["vida_util"]?.value_numeric ?? null,
    ),
  );
  push(w.qualidadeDados, cobertura);

  const pesoTotal = parts.reduce((a, p) => a + p.peso, 0);
  if (!pesoTotal) return { valor: null, categoria: "Sem dados" };
  const v = Math.round((parts.reduce((a, p) => a + p.peso * p.valor, 0) / pesoTotal) * 10) / 10;
  return { valor: v, categoria: cbCategoria(v) };
}

export function cbCategoria(v: number | null): string {
  if (v == null) return "Sem dados";
  if (v >= 85) return "Excelente";
  if (v >= 70) return "Muito bom";
  if (v >= 55) return "Bom";
  if (v >= 40) return "Regular";
  return "Baixo";
}
