// Configuração por família do Mapa de Preços.
// A arquitetura é genérica: cada família define sua própria MARCA BASE,
// unidade comparativa, campos técnicos e aliases de cabeçalho da planilha.
// Nenhuma dependência fixa da marca "Newline".

export type MapaFieldKey =
  | "familia"
  | "baseProduto"
  | "baseCodigo"
  | "baseDescricao"
  | "basePreco"
  | "concMarca"
  | "concModelo"
  | "concCodigo"
  | "concPreco"
  | "classificacao"
  | "status"
  | "observacao"
  | "fonte"
  | "dimensaoBase"
  | "nichoBase"
  | "dimensaoConcorrente"
  | "largura"
  | "altura";

/** Campo técnico de uma família (rótulo, aliases da marca base e do concorrente). */
export type MapaTechField = {
  key: string;
  label: string;
  /** Aliases de cabeçalho para o valor da marca base. */
  aliases: string[];
  /** Aliases de cabeçalho para o valor do concorrente. */
  aliasesConcorrente?: string[];
  /** Unidade exibida no comparativo (W/m, lm/m, mm...). */
  unidade?: string;
  /** Direção técnica: "maior" = quanto maior melhor, "menor" = quanto menor melhor. */
  direcao?: "maior" | "menor" | "neutro";
  /** Semântica da comparação técnica. */
  tipo?: "numerico" | "patamar" | "categorico" | "tecnologia" | "aplicacao" | "cct";
  /** Tolerância (%) para considerar tecnicamente equivalente. */
  toleranciaPct?: number;
  /** Acima deste percentual a diferença é considerada relevante (vermelho). */
  limiteRelevantePct?: number;
  /** Quando false, o campo não entra na seção Comparativo Técnico. */
  comparativo?: boolean;
};

export type MapaFamilyConfig = {
  familia: string;
  baseBrand: string;
  unidade: string;
  /** Tabelas de preço da marca base (quando aplicável). */
  tabelasBase?: string[];
  /** Exibe dimensão/nicho (lógica dimensional típica de Perfis). */
  mostrarDimensoes?: boolean;
  /** Campos técnicos relevantes da família, na ordem de prioridade de exibição. */
  camposTecnicos: MapaTechField[];
  /** Aliases de cabeçalho por campo lógico. */
  aliases: Partial<Record<MapaFieldKey, string[]>>;
};


/** Aliases genéricos aplicados a qualquer família (fallback). */
const ALIASES_GENERICOS: Record<MapaFieldKey, string[]> = {
  familia: ["Família", "Familia", "familia"],
  baseProduto: ["Produto Base", "Produto", "base_produto", "PRODUTO_BASE"],
  baseCodigo: ["Código Base", "Codigo Base", "Código", "Codigo", "SKU", "base_codigo"],
  baseDescricao: ["Descrição Base", "Descrição", "Descricao", "base_descricao"],
  basePreco: ["Preço Base", "Preco Base", "Preço Produto Base", "Preço", "base_preco", "VALOR_BASE"],
  concMarca: ["Marca Concorrente", "Marca", "concorrente_marca", "CONCORRENTE"],
  concModelo: ["Modelo Concorrente", "Modelo", "concorrente_modelo", "ITEM"],
  concCodigo: ["Código Concorrente", "Codigo Concorrente", "concorrente_codigo"],
  concPreco: [
    "Preço Concorrente Normalizado por m",
    "Preço Concorrente R$/m",
    "Preço Concorrente",
    "Preco Concorrente",
    "concorrente_preco",
  ],
  classificacao: ["Classificação Técnica", "Classificação", "Classificacao", "classificacao", "EQUIVALÊNCIA"],
  status: ["Status", "status"],
  observacao: ["Observação Técnica", "Observação", "Observacoes", "Observações", "Notas", "notas"],
  fonte: ["Fonte Principal", "Fonte", "fonte"],
  dimensaoBase: ["Dimensão Base", "Dimensao Base", "Dimensão"],
  nichoBase: ["Nicho Base", "Nicho"],
  dimensaoConcorrente: ["Dimensão Concorrente", "Dimensao Concorrente", "dimensao_concorrente"],
  largura: ["Largura", "largura"],
  altura: ["Altura", "altura"],
};

export const FAMILY_CONFIGS: Record<string, MapaFamilyConfig> = {
  Perfis: {
    familia: "Perfis",
    baseBrand: "Newline",
    unidade: "R$/m",
    tabelasBase: ["Black Brasil", "Black SP"],
    mostrarDimensoes: true,
    camposTecnicos: [
      {
        key: "dimensao",
        label: "Dimensão",
        aliases: ["Dimensão Newline", "Dimensao Newline", "Dimensão"],
        aliasesConcorrente: ["Dimensão Concorrente", "Dimensao Concorrente", "dimensao_concorrente"],
        direcao: "neutro",
      },
      {
        key: "nicho",
        label: "Nicho",
        aliases: ["Nicho Newline mm", "Nicho Newline", "Nicho"],
        aliasesConcorrente: ["Nicho Concorrente mm", "Nicho Concorrente"],
        unidade: "mm",
        direcao: "neutro",
      },
      {
        key: "instalacao",
        label: "Instalação",
        aliases: ["Instalação", "Instalacao"],
        aliasesConcorrente: ["Instalação Concorrente", "Instalacao Concorrente"],
        direcao: "neutro",
      },
    ],
    aliases: {
      baseProduto: ["Produto Base Newline", "Produto Base Standard"],
      baseCodigo: ["Código Newline", "Codigo Newline", "SKU_NEWLINE", "Código Standard"],
      basePreco: [
        "Preço Newline Black Brasil",
        "Preço Newline Black SP",
        "Preço Newline R$/m",
        "Preço Newline",
        "VALOR_NEWLINE",
      ],
      dimensaoBase: ["Dimensão Newline", "Dimensao Newline", "dimensao_newline"],
      nichoBase: ["Nicho Newline mm", "Nicho Newline", "nicho_newline"],
    },
  },
  "Fitas e Fontes": {
    familia: "Fitas e Fontes",
    baseBrand: "Studio",
    unidade: "R$/m",
    mostrarDimensoes: false,
    camposTecnicos: [
      {
        key: "potencia_m",
        label: "Potência W/m",
        aliases: ["Potência Studio W/m", "Potência Base W/m", "Potência W/m", "Potencia W/m", "Potência por metro"],
        aliasesConcorrente: [
          "Potência Concorrente W/m",
          "Potencia Concorrente W/m",
          "Potência Concorrente",
          "Potencia Concorrente",
          "Potência W/m Concorrente",
          "W/m Concorrente",
        ],
        unidade: "W/m",
        direcao: "neutro",
        tipo: "numerico",
        toleranciaPct: 5,
        limiteRelevantePct: 15,
      },
      {
        key: "fluxo_m",
        label: "Fluxo lm/m",
        aliases: ["Fluxo Studio lm/m", "Fluxo Base lm/m", "Fluxo lm/m", "Fluxo luminoso lm/m", "Lumens/m"],
        aliasesConcorrente: [
          "Fluxo Concorrente lm/m",
          "Fluxo Concorrente",
          "Fluxo luminoso Concorrente",
          "Lumens/m Concorrente",
          "lm/m Concorrente",
        ],
        unidade: "lm/m",
        direcao: "maior",
        tipo: "numerico",
      },
      {
        key: "leds_m",
        label: "LEDs/m",
        aliases: ["LEDs/m Studio", "LEDs/m Base", "LEDs/m", "Leds/m", "LEDs por metro"],
        aliasesConcorrente: [
          "LEDs/m Concorrente",
          "Leds/m Concorrente",
          "LEDs Concorrente",
          "LEDs por metro Concorrente",
        ],
        direcao: "maior",
        tipo: "numerico",
      },
      {
        key: "irc",
        label: "IRC",
        aliases: ["IRC Studio", "IRC Base", "IRC", "CRI Studio", "CRI"],
        aliasesConcorrente: ["IRC Concorrente", "CRI Concorrente", "IRC/CRI Concorrente"],
        direcao: "maior",
        tipo: "patamar",
      },
      {
        key: "sdcm",
        label: "SDCM",
        aliases: ["SDCM Studio", "SDCM Base", "SDCM", "MacAdam Studio", "MacAdam"],
        aliasesConcorrente: ["SDCM Concorrente", "MacAdam Concorrente", "SDCM (Concorrente)"],
        direcao: "menor",
        tipo: "patamar",
      },
      {
        key: "tensao",
        label: "Tensão",
        aliases: ["Tensão Studio", "Tensão Base", "Tensão", "Tensao"],
        aliasesConcorrente: ["Tensão Concorrente", "Tensao Concorrente", "Voltagem Concorrente", "V Concorrente"],
        direcao: "neutro",
        tipo: "aplicacao",
      },
      {
        key: "ip",
        label: "IP",
        aliases: ["IP Studio", "IP Base", "IP", "Grau de Proteção"],
        aliasesConcorrente: ["IP Concorrente", "Grau de Proteção Concorrente", "Grau de Protecao Concorrente"],
        direcao: "maior",
        tipo: "patamar",
      },
      {
        key: "cct",
        label: "CCT",
        aliases: ["CCT Studio", "CCT Base", "CCT", "Temperatura de Cor"],
        aliasesConcorrente: ["CCT Concorrente", "Temperatura de Cor Concorrente", "Temperatura Concorrente"],
        direcao: "neutro",
        tipo: "cct",
      },
      {
        key: "eficiencia",
        label: "Eficiência lm/W",
        aliases: ["Eficiência Studio lm/W", "Eficiência lm/W", "Eficiencia lm/W", "Eficiência"],
        aliasesConcorrente: [
          "Eficiência Concorrente lm/W",
          "Eficiencia Concorrente lm/W",
          "Eficiência Concorrente",
          "Eficiencia Concorrente",
          "lm/W Concorrente",
        ],
        unidade: "lm/W",
        direcao: "maior",
        tipo: "numerico",
      },
      {
        key: "largura_fita",
        label: "Largura da fita",
        aliases: ["Largura Studio", "Largura da Fita", "Largura"],
        aliasesConcorrente: ["Largura Concorrente", "Largura da Fita Concorrente", "Largura Fita Concorrente"],
        unidade: "mm",
        direcao: "neutro",
        tipo: "numerico",
        toleranciaPct: 10,
      },
      {
        key: "passo_corte",
        label: "Passo de corte",
        aliases: ["Passo de Corte Studio", "Passo de Corte", "Corte"],
        aliasesConcorrente: ["Passo de Corte Concorrente", "Passo Corte Concorrente", "Corte Concorrente"],
        direcao: "menor",
        tipo: "numerico",
      },
      {
        key: "bobina",
        label: "Comprimento da bobina",
        aliases: [
          "Comprimento Bobina Studio",
          "Comprimento da Bobina Studio",
          "Comprimento da Bobina",
          "Comprimento Bobina",
          "Bobina",
        ],
        aliasesConcorrente: [
          "Comprimento Bobina Concorrente",
          "Comprimento da Bobina Concorrente",
          "Bobina Concorrente",
        ],
        unidade: "m",
        direcao: "neutro",
        tipo: "numerico",
        toleranciaPct: 10,
      },
      {
        key: "tecnologia",
        label: "Tecnologia",
        aliases: ["Tecnologia Studio", "Tecnologia", "Tecnologia Base"],
        aliasesConcorrente: ["Tecnologia Concorrente", "Tecnologia do Concorrente"],
        direcao: "neutro",
        tipo: "tecnologia",
      },
    ],
    aliases: {
      baseProduto: ["Produto Base Studio", "Produto Studio"],
      baseCodigo: ["Código Studio", "Codigo Studio", "SKU Studio"],
      baseDescricao: ["Descrição Studio", "Descricao Studio"],
      basePreco: ["Preço Studio R$/m", "Preco Studio R$/m", "Preço Studio", "Preço Base Studio"],
    },
  },

};

export function getFamilyConfig(familia: string): MapaFamilyConfig {
  return (
    FAMILY_CONFIGS[familia] ?? {
      familia,
      baseBrand: "Marca Base",
      unidade: "R$/m",
      camposTecnicos: [],
      aliases: {},
    }
  );
}

/** Rótulo de preço base contextualizado: "Preço Base — Studio". */
export function labelPrecoBase(cfg: MapaFamilyConfig): string {
  return `Preço Base — ${cfg.baseBrand}`;
}

/** Cabeçalho da coluna de preço base na tabela: "STUDIO (R$/M)". */
export function labelColunaBase(cfg: MapaFamilyConfig): string {
  return `${cfg.baseBrand} (${cfg.unidade})`.toUpperCase();
}

export function normalizeHeader(h: string): string {
  return String(h)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

/** Resolve o valor de um campo lógico numa linha, testando aliases da família e genéricos. */
export function pickField(
  row: Record<string, unknown>,
  cfg: MapaFamilyConfig,
  key: MapaFieldKey,
): unknown {
  const candidates = [...(cfg.aliases[key] ?? []), ...(ALIASES_GENERICOS[key] ?? [])];
  const normalizedRow = new Map<string, unknown>();
  Object.entries(row).forEach(([k, v]) => normalizedRow.set(normalizeHeader(k), v));

  for (const c of candidates) {
    const v = normalizedRow.get(normalizeHeader(c));
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

export function pickByAliases(row: Record<string, unknown>, aliases: string[]): unknown {
  const normalizedRow = new Map<string, unknown>();
  Object.entries(row).forEach(([k, v]) => normalizedRow.set(normalizeHeader(k), v));
  for (const a of aliases) {
    const v = normalizedRow.get(normalizeHeader(a));
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

/** Converte texto monetário/numérico em número. Nunca devolve 0 como fallback. */
export function parsePreco(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s
    .replace(/r\$/i, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
