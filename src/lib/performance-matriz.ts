// Leitura e validação determinística da aba "Matriz Financeira" das planilhas
// de performance. Os valores financeiros vêm EXCLUSIVAMENTE desta aba — nunca
// são derivados das faixas textuais da aba de performance.
//
// Estrutura esperada:
// CATEGORIA | DECOR NEWLINE | DECOR STUDIO | SISTEMAS E MÓDULOS | PRO LED |
// PRO LAMP | PERFIL | FITAS E FONTES | TOTAL META
// Linhas obrigatórias: Black, Gold, Silver.

import { CANONICAL_FAMILIES, normalizeFamilyName } from "./client-bi-parser";

export const MATRIZ_CATEGORIAS = ["Black", "Gold", "Silver"] as const;
export type MatrizCategoria = (typeof MATRIZ_CATEGORIAS)[number];

/** categoria -> família canônica -> valor de meta (R$) */
export type MatrizFinanceira = Record<string, Record<string, number>>;

export type MatrizParseResult = {
  matriz: MatrizFinanceira;
  totais: Record<string, number | null>;
  categorias: string[];
  familias: string[];
};

const norm = (v: unknown): string =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

/** Rótulo amigável usado em mensagens de erro (ex.: "Perfil", "Sistemas e Módulos"). */
export function familiaLabel(f: string): string {
  return f
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((w) => (w === "e" ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1)))
    .join(" ");
}

export function toAmount(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v)
    .replace(/[R$\s\u00a0]/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const CATEGORIA_BY_NORM: Record<string, MatrizCategoria> = {
  BLACK: "Black",
  GOLD: "Gold",
  SILVER: "Silver",
};

/** Lê a matriz a partir de uma grade bruta (linhas × colunas) da aba. */
export function parseMatrizFinanceiraGrid(grid: unknown[][]): MatrizParseResult {
  let headerRow = -1;
  for (let r = 0; r < Math.min(grid.length, 30); r++) {
    if (norm(grid[r]?.[0]) === "CATEGORIA") {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) {
    throw new Error(
      'Aba "Matriz Financeira" inválida: cabeçalho com a coluna CATEGORIA não encontrado.',
    );
  }

  const hdr = grid[headerRow] ?? [];
  const famCols: { familia: string; col: number }[] = [];
  let totalCol = -1;
  for (let c = 1; c < hdr.length; c++) {
    const raw = hdr[c];
    if (raw == null || String(raw).trim() === "") continue;
    if (norm(raw).startsWith("TOTAL")) {
      totalCol = c;
      continue;
    }
    const fam = normalizeFamilyName(raw);
    if (fam) famCols.push({ familia: fam, col: c });
  }

  const matriz: MatrizFinanceira = {};
  const totais: Record<string, number | null> = {};
  const categorias: string[] = [];

  for (let r = headerRow + 1; r < grid.length; r++) {
    const cat = CATEGORIA_BY_NORM[norm(grid[r]?.[0])];
    if (!cat) continue;
    categorias.push(cat);
    const linha: Record<string, number> = {};
    for (const { familia, col } of famCols) {
      const amount = toAmount(grid[r]?.[col]);
      if (amount != null) linha[familia] = amount;
    }
    matriz[cat] = linha;
    totais[cat] = totalCol >= 0 ? toAmount(grid[r]?.[totalCol]) : null;
  }

  return {
    matriz,
    totais,
    categorias,
    familias: famCols.map((f) => f.familia),
  };
}

/**
 * Valida as 3 categorias × 7 famílias e a coerência do Total Meta.
 * Retorna a lista de mensagens de erro (vazia = matriz válida).
 * As mensagens NUNCA contêm valores financeiros brutos.
 */
export function validateMatrizFinanceira(res: MatrizParseResult): string[] {
  const erros: string[] = [];

  for (const cat of MATRIZ_CATEGORIAS) {
    const linha = res.matriz[cat];
    if (!linha) {
      erros.push(`Matriz financeira incompleta. Categoria ${cat} ausente.`);
      continue;
    }
    let soma = 0;
    let completa = true;
    for (const fam of CANONICAL_FAMILIES) {
      const v = linha[fam];
      if (v == null || !Number.isFinite(v) || v <= 0) {
        erros.push(
          `Matriz financeira incompleta. Categoria ${cat} sem valor para a família ${familiaLabel(fam)}.`,
        );
        completa = false;
        continue;
      }
      soma += v;
    }
    const total = res.totais[cat];
    if (completa && total != null && Math.abs(total - soma) > Math.max(1, soma * 0.005)) {
      erros.push(
        `Matriz financeira inválida. Categoria ${cat}: Total Meta não corresponde à soma das sete famílias.`,
      );
    }
  }

  return erros;
}
