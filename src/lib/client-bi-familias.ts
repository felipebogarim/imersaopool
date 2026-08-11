// Fonte única de verdade para as famílias de produto usadas nos BIs de clientes.
// Centraliza: lista canônica, regras do farol, desempate, validação,
// derivação de `familias.itens` a partir de `bi.familias` e distribuição do farol.

import { FAROL_LABEL, FAROL_ORDER, statusFromPercent, type FarolStatus } from "./performance-farol";

// ============= Famílias oficiais (ordem oficial) =============

export const CANONICAL_FAMILIES = [
  "DECOR NEWLINE",
  "DECOR STUDIO",
  "SISTEMAS E MÓDULOS",
  "PRO LED",
  "PRO LAMP",
  "PERFIL",
  "FITAS E FONTES",
] as const;

export type CanonicalFamily = (typeof CANONICAL_FAMILIES)[number];

export const CANONICAL_ORDER: Record<string, number> = Object.fromEntries(
  CANONICAL_FAMILIES.map((f, i) => [f, i]),
);

export const normalizeText = (s: unknown): string =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();

const CANONICAL_BY_NORM: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const f of CANONICAL_FAMILIES) m[normalizeText(f)] = f;
  m["SISTEMAS E MODULOS"] = "SISTEMAS E MÓDULOS";
  // "ACESSÓRIOS" era o nome legado da 7ª família; hoje é FITAS E FONTES.
  m["ACESSORIOS"] = "FITAS E FONTES";
  m["FITAS/FONTES"] = "FITAS E FONTES";
  return m;
})();

export function normalizeFamilyName(v: unknown): string | null {
  const n = normalizeText(v);
  if (!n) return null;
  // Rejeita famílias numéricas ("1.1", "0,6", "25%")
  if (/^[-+]?[\d.,%\s]+$/.test(n)) return null;
  return CANONICAL_BY_NORM[n] ?? null;
}

export function isCanonicalFamily(v: unknown): boolean {
  return normalizeFamilyName(v) !== null;
}

// ============= Farol =============

export const FAROL_LABELS: string[] = FAROL_ORDER.map((k) => FAROL_LABEL[k]);

const FAROL_BY_NORM: Record<string, FarolStatus> = (() => {
  const m: Record<string, FarolStatus> = {};
  for (const k of FAROL_ORDER) m[normalizeText(FAROL_LABEL[k])] = k;
  return m;
})();

export function normalizeTrafficLightGroup(v: unknown): string | null {
  const n = normalizeText(v);
  if (!n) return null;
  const k = FAROL_BY_NORM[n];
  return k ? FAROL_LABEL[k] : null;
}

/** Converte atingimento (decimal 0..>1 ou percentual) para percentual. */
export function toPercent(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.abs(v) <= 1.5 ? v * 100 : v;
}

/** Farol oficial a partir do atingimento (aceita decimal ou percentual). */
export function farolFromAtingimento(v: number | null | undefined): string | null {
  const pct = toPercent(v);
  if (pct == null) return null;
  const st = statusFromPercent(pct);
  return st ? FAROL_LABEL[st] : null;
}

// ============= Tipos =============

export type FamiliaResultado = {
  familia: string;
  atingimento: number | null;
  participacao?: number | null;
  farol: string | null;
};

export type ClientBIData = {
  geral: number | null;
  categoria: string | null;
  familias: FamiliaResultado[];
  melhor_familia: { label: string | null; atingimento: number | null };
  pior_familia: { label: string | null; atingimento: number | null };
  distribuicao_farol: Array<{ grupo: string; quantidade: number }>;
};

export type ClientFamiliasData = { itens: FamiliaResultado[] };

export const CATEGORIAS_VALIDAS = ["Black", "Gold", "Silver"];

// ============= Desempate =============
// Empate no atingimento → vence a família que vem antes na ordem oficial.

export function calculateBestFamily(fams: FamiliaResultado[]): FamiliaResultado | null {
  if (!fams.length) return null;
  return fams.slice().sort((a, b) => {
    const ar = a.atingimento ?? -Infinity;
    const br = b.atingimento ?? -Infinity;
    if (br !== ar) return br - ar;
    return (CANONICAL_ORDER[a.familia] ?? 99) - (CANONICAL_ORDER[b.familia] ?? 99);
  })[0];
}

export function calculateWorstFamily(fams: FamiliaResultado[]): FamiliaResultado | null {
  if (!fams.length) return null;
  return fams.slice().sort((a, b) => {
    const ar = a.atingimento ?? Infinity;
    const br = b.atingimento ?? Infinity;
    if (ar !== br) return ar - br;
    return (CANONICAL_ORDER[a.familia] ?? 99) - (CANONICAL_ORDER[b.familia] ?? 99);
  })[0];
}

// ============= Distribuição do farol =============

export function calculateTrafficLightDistribution(
  fams: FamiliaResultado[],
): Array<{ grupo: string; quantidade: number }> {
  const counts = new Map<string, number>();
  for (const f of fams) {
    const g = normalizeTrafficLightGroup(f.farol) ?? farolFromAtingimento(f.atingimento);
    if (!g) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return FAROL_LABELS.filter((g) => (counts.get(g) ?? 0) > 0).map((grupo) => ({
    grupo,
    quantidade: counts.get(grupo) as number,
  }));
}

// ============= Fonte única: gráfico e cards leem daqui =============

/** Coleção oficial de famílias de um cliente (usada por cards, gráfico e cálculos). */
export function getFamiliasCliente(
  bi: ClientBIData | { familias?: FamiliaResultado[] } | null | undefined,
): FamiliaResultado[] {
  return (bi?.familias ?? []).filter((f) => isCanonicalFamily(f.familia));
}

/** `familias.itens` é sempre derivado de `bi.familias`. */
export function deriveFamiliasItens(bi: ClientBIData): ClientFamiliasData {
  return { itens: getFamiliasCliente(bi) };
}

export function buildBI(
  categoria: string | null,
  geralLegacy: number | null,
  familiasRaw: FamiliaResultado[],
): ClientBIData {
  const familias = familiasRaw.filter((f) => isCanonicalFamily(f.familia));
  
  // Atingimento geral ponderado canônico (Matriz Financeira)
  // Ref: Memória bi-participacao-familia e instruções do usuário.
  // Nota: BI de cliente recalcula o valor real com base nas famílias extraídas.
  const MATRIZ_GOLD: Record<string, number> = {
    "DECOR NEWLINE": 2500,
    "DECOR STUDIO": 3000,
    "SISTEMAS E MÓDULOS": 2500,
    "PRO LED": 1500,
    "PRO LAMP": 1500,
    "PERFIL": 2000,
    "FITAS E FONTES": 2000,
  };

  const MATRIZ_BLACK: Record<string, number> = {
    "DECOR NEWLINE": 5000,
    "DECOR STUDIO": 6000,
    "SISTEMAS E MÓDULOS": 5000,
    "PRO LED": 3000,
    "PRO LAMP": 3000,
    "PERFIL": 4000,
    "FITAS E FONTES": 4000,
  };

  const MATRIZ_SILVER: Record<string, number> = {
    "DECOR NEWLINE": 1250,
    "DECOR STUDIO": 1500,
    "SISTEMAS E MÓDULOS": 1250,
    "PRO LED": 750,
    "PRO LAMP": 750,
    "PERFIL": 1000,
    "FITAS E FONTES": 1000,
  };

  const cat = (categoria ?? "Gold").toLowerCase();
  const metas = cat.includes("black") ? MATRIZ_BLACK : cat.includes("silver") ? MATRIZ_SILVER : MATRIZ_GOLD;
  
  let totalMeta = 0;
  let totalRealizadoPonderado = 0;

  for (const f of CANONICAL_FAMILIES) {
    const meta = metas[f] || 0;
    const item = familias.find(x => normalizeFamilyName(x.familia) === f);
    const atingimento = item?.atingimento ?? 0;

    totalMeta += meta;
    totalRealizadoPonderado += meta * (atingimento / 100);
  }

  const geralCalculado = totalMeta > 0 ? (totalRealizadoPonderado / totalMeta) * 100 : null;
  const geralFinal = geralCalculado ?? geralLegacy;

  const best = calculateBestFamily(familias);
  const worst = calculateWorstFamily(familias);

  return {
    geral: geralFinal,
    categoria,
    familias,
    melhor_familia: best
      ? { label: best.familia, atingimento: best.atingimento }
      : { label: null, atingimento: null },
    pior_familia: worst
      ? { label: worst.familia, atingimento: worst.atingimento }
      : { label: null, atingimento: null },
    distribuicao_farol: calculateTrafficLightDistribution(familias),
  };
}

// ============= Validação =============

export const FAMILIAS_ERROR_HINT =
  "Cada cliente deve possuir exatamente 7 famílias: Decor Newline, Decor Studio, Sistemas e Módulos, Pro LED, Pro Lamp, Perfil e Fitas e Fontes.";

/** Valida a estrutura das 7 famílias. Retorna a primeira mensagem de erro ou null. */
export function validateFamilias(fams: FamiliaResultado[]): string | null {
  if (fams.length !== 7) return `foram encontradas ${fams.length} famílias, mas o esperado é 7`;
  const seen = new Set<string>();
  for (const f of fams) {
    if (f.familia == null || String(f.familia).trim() === "") return `família nula`;
    if (!isCanonicalFamily(f.familia)) return `família inválida "${f.familia}"`;
    const canon = normalizeFamilyName(f.familia) as string;
    if (seen.has(canon)) return `família duplicada "${canon}"`;
    seen.add(canon);
    if (f.atingimento == null) return `atingimento nulo em "${canon}"`;
    const pct = toPercent(f.atingimento) as number;
    if (pct < 0) return `atingimento negativo em "${canon}"`;
    if (pct > 300) return `atingimento acima de 300% em "${canon}"`;
    if (f.farol == null) return `farol nulo em "${canon}"`;
    const farol = normalizeTrafficLightGroup(f.farol);
    if (!farol) return `farol inválido "${f.farol}" em "${canon}"`;
    if (farol !== farolFromAtingimento(f.atingimento))
      return `atingimento incompatível com o farol em "${canon}"`;
    if (f.participacao != null && f.participacao < 0)
      return `participação negativa em "${canon}"`;
  }
  for (const f of CANONICAL_FAMILIES) if (!seen.has(f)) return `família ausente "${f}"`;
  return null;
}

/** Valida o BI completo de um cliente (estrutura + coerências derivadas). */
export function validateClientBI(bi: ClientBIData): string | null {
  const err = validateFamilias(bi.familias ?? []);
  if (err) return err;
  if (bi.categoria != null && !CATEGORIAS_VALIDAS.includes(bi.categoria))
    return `categoria inválida "${bi.categoria}"`;
  const total = (bi.distribuicao_farol ?? []).reduce((s, g) => s + (g.quantidade ?? 0), 0);
  if (total !== 7) return `distribuição do farol soma ${total}, mas o esperado é 7`;
  const grupos = new Set<string>();
  for (const g of bi.distribuicao_farol ?? []) {
    if (!FAROL_LABELS.includes(g.grupo)) return `grupo de farol desconhecido "${g.grupo}"`;
    if (g.quantidade == null || g.quantidade < 0) return `quantidade inválida em "${g.grupo}"`;
    if (grupos.has(g.grupo)) return `grupo de farol duplicado "${g.grupo}"`;
    grupos.add(g.grupo);
  }
  const best = calculateBestFamily(bi.familias);
  const worst = calculateWorstFamily(bi.familias);
  if (bi.melhor_familia?.label !== best?.familia) return `melhor família inconsistente`;
  if (bi.pior_familia?.label !== worst?.familia) return `pior família inconsistente`;
  const parts = bi.familias.map((f) => f.participacao).filter((p) => p != null) as number[];
  if (parts.length === 7) {
    const soma = parts.reduce((a, b) => a + b, 0);
    const somaPct = soma <= 1.5 ? soma * 100 : soma;
    if (somaPct > 0.5 && Math.abs(somaPct - 100) > 0.5)
      return `soma das participações é ${somaPct.toFixed(2)}%, esperado ~100%`;
  }
  return null;
}

export function clientBiErrorMessage(cliente: string, problema: string): string {
  return [
    "Não foi possível gerar o BI do cliente.",
    "Foram encontrados registros inválidos na estrutura das famílias.",
    FAMILIAS_ERROR_HINT,
    `Cliente: ${cliente}`,
    `Problema: ${problema}`,
  ].join("\n");
}
