// Escala do farol de performance dos representantes.
// A mesma paleta é usada na leitura (mapa cor→status ao importar Excel)
// e na renderização (classes Tailwind na matriz e nos chips da legenda).

export type FarolStatus =
  | "sem_compra"
  | "abaixo_meta"
  | "pode_melhorar"
  | "proximo"
  | "otimo"
  | "excelente";

export const FAROL_ORDER: FarolStatus[] = [
  "sem_compra",
  "abaixo_meta",
  "pode_melhorar",
  "proximo",
  "otimo",
  "excelente",
];

export const FAROL_LABEL: Record<FarolStatus, string> = {
  sem_compra: "Sem compra",
  abaixo_meta: "Abaixo da meta",
  pode_melhorar: "Pode melhorar",
  proximo: "Próximo",
  otimo: "Ótimo",
  excelente: "Excelente",
};

// Faixas em % (min inclusivo, max exclusivo). "sem_compra" = exatamente 0.
export const FAROL_RANGES: Record<FarolStatus, { min: number; max: number }> = {
  sem_compra: { min: 0, max: 0.0001 },
  abaixo_meta: { min: 0.0001, max: 50 },
  pode_melhorar: { min: 50, max: 70 },
  proximo: { min: 70, max: 90 },
  otimo: { min: 90, max: 100.0001 },
  excelente: { min: 100.0001, max: Infinity },
};

// Classes Tailwind (bg + text) para célula da matriz.
export const FAROL_CELL_CLASS: Record<FarolStatus, string> = {
  sem_compra: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  abaixo_meta: "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-100",
  pode_melhorar: "bg-orange-200 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100",
  proximo: "bg-yellow-200 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-100",
  otimo: "bg-lime-200 text-lime-900 dark:bg-lime-900/50 dark:text-lime-100",
  excelente: "bg-emerald-300 text-emerald-950 dark:bg-emerald-800/60 dark:text-emerald-50",
};

// Cor hex "canônica" por status (usada na exportação de Excel quando não há cor original).
export const FAROL_HEX: Record<FarolStatus, string> = {
  sem_compra: "E5E5E5",
  abaixo_meta: "FCA5A5",
  pode_melhorar: "FDBA74",
  proximo: "FDE68A",
  otimo: "BEF264",
  excelente: "6EE7B7",
};

/** Deriva status a partir de um percentual (0–∞) */
// Texto curto exibido dentro da célula colorida (novo formato da planilha).
export const FAROL_FAIXA_TEXT: Record<FarolStatus, string> = {
  sem_compra: "0%",
  abaixo_meta: "<50",
  pode_melhorar: "50-69",
  proximo: "70-89",
  otimo: "90-100",
  excelente: ">100",
};

// Ponto médio da faixa em % — usado para estimar atingimento quando só temos o farol.
export const FAROL_MIDPOINT: Record<FarolStatus, number> = {
  sem_compra: 0,
  abaixo_meta: 25,
  pode_melhorar: 60,
  proximo: 80,
  otimo: 95,
  excelente: 110,
};

/** Converte a string de faixa da planilha (ex.: "0%", "<50", "50-69", ">100") em FarolStatus. */
export function statusFromFaixa(text: string | null | undefined): FarolStatus | null {
  if (text == null) return null;
  const s = String(text).trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  if (s === "0%" || s === "0" || s === "sem" || s === "semcompra") return "sem_compra";
  if (s.startsWith("<50") || s === "<50%") return "abaixo_meta";
  if (s.startsWith(">100") || s === ">100%" || s === "acima100") return "excelente";
  // ranges "50-69", "70-89", "90-100" (aceita en-dash "–" e "a")
  const m = s.match(/^(\d+)\s*[-–a]\s*(\d+)/);
  if (m) {
    const lo = parseInt(m[1], 10);
    if (lo >= 90) return "otimo";
    if (lo >= 70) return "proximo";
    if (lo >= 50) return "pode_melhorar";
    if (lo >= 0) return "abaixo_meta";
  }
  return null;
}

export function statusFromPercent(p: number | null | undefined): FarolStatus | null {
  if (p == null || Number.isNaN(p)) return null;
  if (p <= 0) return "sem_compra";
  if (p < 50) return "abaixo_meta";
  if (p < 70) return "pode_melhorar";
  if (p < 90) return "proximo";
  if (p <= 100) return "otimo";
  return "excelente";
}

/**
 * Paleta aceita na IMPORTAÇÃO (correspondência exata, sem aproximação).
 * Inclui a paleta canônica do sistema e a paleta original das planilhas.
 */
export const IMPORT_FAROL_HEX: Record<string, FarolStatus> = {
  // Paleta canônica (gerada pelo sistema)
  E5E5E5: "sem_compra",
  FCA5A5: "abaixo_meta",
  FDBA74: "pode_melhorar",
  FDE68A: "proximo",
  BEF264: "otimo",
  "6EE7B7": "excelente",

  // Paleta original das planilhas
  E8A0A0: "abaixo_meta",
  F4D7BE: "pode_melhorar",
  F3EFD9: "proximo",
  DFF0D0: "otimo",
  C2F1C8: "otimo",
  "9FC7E8": "excelente",
};

/** Normaliza uma cor para RRGGBB em caixa alta. Retorna null se inválida. */
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  let hex = String(input).trim().replace(/^#/, "").trim().toUpperCase();
  if (hex.length === 8) hex = hex.slice(2);
  if (!/^[0-9A-F]{6}$/.test(hex)) return null;
  return hex;
}

/**
 * Mapeia uma cor para o status do farol usando SOMENTE correspondência exata.
 * Cor desconhecida retorna null (nunca "sem_compra").
 */
export function statusFromHex(input: string | null | undefined): FarolStatus | null {
  const hex = normalizeHex(input);
  if (!hex) return null;
  return IMPORT_FAROL_HEX[hex] ?? null;
}

/**
 * Aproximação por distância euclidiana — uso EXCLUSIVAMENTE visual/heurístico.
 * NUNCA deve participar da validação de upload.
 */
export function statusFromHexAproximado(hex: string | null | undefined): FarolStatus | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  const exact = IMPORT_FAROL_HEX[h];
  if (exact) return exact;

  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (r > 240 && g > 240 && b > 240) return null;

  const centers: { s: FarolStatus; c: [number, number, number] }[] = [
    { s: "sem_compra", c: [200, 200, 200] },
    { s: "abaixo_meta", c: [220, 60, 60] },
    { s: "pode_melhorar", c: [240, 150, 60] },
    { s: "proximo", c: [245, 220, 90] },
    { s: "otimo", c: [140, 200, 90] },
    { s: "excelente", c: [40, 140, 90] },
  ];
  let best: FarolStatus = "sem_compra";
  let bestD = Infinity;
  for (const { s, c } of centers) {
    const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}


export function catBadge(c: string | null | undefined): string {
  const k = (c ?? "").toLowerCase();
  if (k === "black") return "bg-foreground/10 text-foreground border-foreground/30";
  if (k === "gold") return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
  if (k === "silver") return "bg-muted text-muted-foreground border-border";
  return "bg-muted text-muted-foreground border-border";
}
