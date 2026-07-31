// Parser da planilha Excel de metas/desempenho por representante.
// Suporta o formato AJUSTADO (novo): cabeçalho na linha 1 com
// [RAZÃO SOCIAL, CATEGORIA, TOTAL META, TOTAL %, <famílias...>] e valores
// de família como faixa em texto ("0%", "<50", "50-69", "70-89", "90-100", ">100").
// Também mantém compatibilidade retroativa com o formato antigo (numérico + cor).
//
// Os valores financeiros vêm EXCLUSIVAMENTE da aba "Matriz Financeira".

import * as XLSXStyle from "xlsx-js-style";
import { statusFromFaixa, type FarolStatus } from "./performance-farol";
import { resolveCellStatus, type CellConflict } from "./performance-cell-status";
import {
  parseMatrizFinanceiraGrid,
  validateMatrizFinanceira,
  type MatrizParseResult,
} from "./performance-matriz";
import { isClientRow, isTotalRowName, type IgnoredRow } from "./client-row-filter";

export const PARSER_VERSION = "performance-parser@3";

export type ParsedRow = {
  ordem: number;
  razao_social: string;
  categoria: string | null;
  metas: Record<string, number>;
  metas_status: Record<string, FarolStatus>;
  metas_cores: Record<string, string>; // hex sem "#"
  total_meta: number | null;
  total_pct_status: FarolStatus | null;
};

export type ResumoPct = { __total__: number | null; [familia: string]: number | null };

export type ParsedSheet = {
  familias: string[];
  categoriaMetas: Record<string, number>;
  escala: { label: string; min: number | null; max: number | null }[];
  rows: ParsedRow[];
  participacao: ResumoPct | null;
  atingimento: ResumoPct | null;
  /** Linhas descartadas (totais, legendas, sem categoria) com o motivo. */
  ignoradas: IgnoredRow[];
  /** Total de linhas de dados lidas (antes de qualquer filtro). */
  linhas_lidas: number;
  /** Matriz financeira lida da aba dedicada (null quando a aba não existe). */
  matriz: MatrizParseResult | null;
  /** Erros de validação da matriz financeira (sem valores brutos). */
  matriz_erros: string[];
  /** Divergências entre faixa textual e cor (bloqueiam a importação). */
  conflitos: CellConflict[];
  parser_version: string;
};

export type CellFill = {
  /** true quando a célula possui objeto de estilo. */
  hasStyle: boolean;
  /** Valor bruto encontrado (rgb, "theme:N", "indexed:N") ou null. */
  raw: string | null;
  /** Cor normalizada RRGGBB ou null. */
  hex: string | null;
};

/**
 * Extrai a cor de preenchimento aceitando o formato ACHATADO do xlsx-js-style
 * (cell.s.fgColor.rgb) e o formato aninhado (cell.s.fill.fgColor.rgb).
 * bgColor.indexed nunca é usado como cor de farol.
 */
export function cellFill(cell: any): CellFill {
  const style = cell?.s;
  if (!style) return { hasStyle: false, raw: null, hex: null };

  const fg = style?.fgColor ?? style?.fill?.fgColor ?? null;
  const rawRgb = fg?.rgb ?? null;

  if (rawRgb == null || typeof rawRgb !== "string") {
    // Cores de tema/indexadas não são "cor ausente": registram-se como brutas.
    if (fg && fg.theme != null) return { hasStyle: true, raw: `theme:${fg.theme}`, hex: null };
    if (fg && fg.indexed != null) return { hasStyle: true, raw: `indexed:${fg.indexed}`, hex: null };
    return { hasStyle: true, raw: null, hex: null };
  }

  let hex = rawRgb.replace(/^#/, "").trim().toUpperCase();
  if (hex.length === 8) hex = hex.slice(2);
  if (!/^[0-9A-F]{6}$/.test(hex)) return { hasStyle: true, raw: rawRgb, hex: null };
  // 000000 / 00000000 = "sem preenchimento" em muitos exports
  if (hex === "000000") return { hasStyle: true, raw: null, hex: null };
  return { hasStyle: true, raw: rawRgb, hex };
}

export function cellHex(cell: any): string | null {
  return cellFill(cell).hex;
}


function findHeaderRow(grid: { v: any }[][]): { row: number; layout: "novo" | "antigo" } | null {
  for (let r = 0; r < Math.min(grid.length, 25); r++) {
    const row = grid[r] ?? [];
    const a = String(row[0]?.v ?? "").trim().toUpperCase();
    const b = String(row[1]?.v ?? "").trim().toUpperCase();
    const c = String(row[2]?.v ?? "").trim().toUpperCase();
    const d = String(row[3]?.v ?? "").trim().toUpperCase();
    if ((a === "RAZÃO SOCIAL" || a === "RAZAO SOCIAL" || a === "GRUPO") && b === "CATEGORIA") {
      if (c.startsWith("TOTAL META") && d.startsWith("TOTAL")) {
        return { row: r, layout: "novo" };
      }
      return { row: r, layout: "antigo" };
    }
  }
  return null;
}

const normSheet = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

function readMatriz(wb: XLSXStyle.WorkBook): MatrizParseResult | null {
  const name = wb.SheetNames.find((n) => {
    const v = normSheet(n);
    return v.includes("MATRIZ") && v.includes("FINANC");
  });
  if (!name) return null;
  const ws = wb.Sheets[name];
  if (!ws) return null;
  const grid = XLSXStyle.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: true });
  return parseMatrizFinanceiraGrid(grid as unknown[][]);
}

export async function parseWorkbook(buf: ArrayBuffer): Promise<ParsedSheet> {
  const wb = XLSXStyle.read(buf, { type: "array", cellStyles: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Planilha vazia.");
  const range = XLSXStyle.utils.decode_range(ws["!ref"] || "A1");

  const grid: { v: any; c: string | null }[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: { v: any; c: string | null }[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r, c });
      const cell = ws[addr];
      row.push({ v: cell ? cell.v : null, c: cellHex(cell) });
    }
    grid.push(row);
  }

  const head = findHeaderRow(grid);
  if (!head) throw new Error("Cabeçalho não encontrado (linha com RAZÃO SOCIAL + CATEGORIA).");

  const matriz = readMatriz(wb);
  const matriz_erros = matriz ? validateMatrizFinanceira(matriz) : [];

  const base =
    head.layout === "novo" ? parseNovo(grid, head.row) : parseAntigo(grid, head.row);

  return { ...base, matriz, matriz_erros };
}

// ---------- Novo formato (planilha ajustada) ----------
function toPct(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return Math.abs(v) <= 1.5 ? v * 100 : v;
  }
  const s = String(v).trim().replace("%", "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

type BaseSheet = Omit<ParsedSheet, "matriz" | "matriz_erros">;

function parseNovo(grid: { v: any; c: string | null }[][], headerRow: number): BaseSheet {
  const hdr = grid[headerRow] ?? [];
  // colunas: 0 Razão, 1 Categoria, 2 Total Meta, 3 Total %, 4.. famílias
  const familias: string[] = [];
  const famCols: number[] = [];
  for (let c = 4; c < hdr.length; c++) {
    const v = hdr[c]?.v;
    if (v && String(v).trim()) {
      familias.push(String(v).trim());
      famCols.push(c);
    }
  }

  const rows: ParsedRow[] = [];
  let participacao: ResumoPct | null = null;
  let atingimento: ResumoPct | null = null;
  const ignoradas: IgnoredRow[] = [];
  const conflitos: CellConflict[] = [];
  let linhas_lidas = 0;
  let ordem = 0;
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const razao = String(row[0]?.v ?? "").trim();
    if (!razao) continue;
    linhas_lidas++;
    const razaoU = razao.toUpperCase();

    if (razaoU.startsWith("PARTICIPA")) {
      const out: ResumoPct = { __total__: toPct(row[3]?.v) };
      familias.forEach((f, i) => {
        const p = toPct(row[famCols[i]]?.v);
        if (p != null) out[f] = p;
      });
      participacao = out;
      continue;
    }
    if (razaoU.startsWith("ATINGIMENTO")) {
      const out: ResumoPct = { __total__: toPct(row[3]?.v) };
      familias.forEach((f, i) => {
        const p = toPct(row[famCols[i]]?.v);
        if (p != null) out[f] = p;
      });
      atingimento = out;
      continue;
    }
    // Nunca importar totais, subtotais, legendas ou rodapés como cliente
    if (isTotalRowName(razao)) {
      ignoradas.push({ razao_social: razao, motivo: "Linha de totalização/legenda" });
      continue;
    }

    const categoria = String(row[1]?.v ?? "").trim();
    if (!isClientRow({ razao_social: razao, categoria })) {
      ignoradas.push({ razao_social: razao, motivo: "Categoria ausente ou inválida" });
      continue;
    }
    const total_meta = typeof row[2]?.v === "number" ? (row[2].v as number) : null;
    const total_pct_status = statusFromFaixa(row[3]?.v);

    const metas: Record<string, number> = {};
    const metas_status: Record<string, FarolStatus> = {};
    const metas_cores: Record<string, string> = {};
    familias.forEach((f, i) => {
      const cell = row[famCols[i]];
      if (typeof cell?.v === "number" && Number.isFinite(cell.v)) metas[f] = cell.v;
      const res = resolveCellStatus(cell?.v, cell?.c);
      if (res.ok) {
        if (res.status) metas_status[f] = res.status;
      } else {
        conflitos.push({ ...res.conflito, linha: r + 1, razao_social: razao, familia: f });
      }
      if (cell?.c) metas_cores[f] = cell.c;
    });

    rows.push({
      ordem: ordem++,
      razao_social: razao,
      categoria: categoria || null,
      metas,
      metas_status,
      metas_cores,
      total_meta,
      total_pct_status,
    });
  }

  return {
    familias,
    categoriaMetas: {},
    escala: [],
    rows,
    participacao,
    atingimento,
    ignoradas,
    linhas_lidas,
    conflitos,
    parser_version: PARSER_VERSION,
  };
}

// ---------- Formato antigo (mantido para compatibilidade) ----------
function parseAntigo(grid: { v: any; c: string | null }[][], headerRow: number): BaseSheet {
  const famRow = grid[headerRow - 1] ?? [];
  const familias: string[] = [];
  const famCols: number[] = [];
  for (let c = 2; c < famRow.length; c++) {
    const v = famRow[c]?.v;
    if (v && String(v).trim()) {
      familias.push(String(v).trim());
      famCols.push(c);
    }
  }
  const totalCol = famCols.length ? famCols[famCols.length - 1] + 1 : 2;

  const categoriaMetas: Record<string, number> = {};
  const escala: { label: string; min: number | null; max: number | null }[] = [];
  const CATS = ["BLACK", "GOLD", "SILVER", "BRONZE", "DIAMOND", "PLATINUM"];
  for (let r = 0; r < headerRow; r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length - 1; c++) {
      const key = String(row[c]?.v ?? "").trim();
      const val = row[c + 1]?.v;
      if (!key) continue;
      const kU = key.toUpperCase();
      if (CATS.includes(kU) && typeof val === "number") {
        categoriaMetas[kU.charAt(0) + kU.slice(1).toLowerCase()] = val;
      }
    }
  }

  const rows: ParsedRow[] = [];
  const ignoradas: IgnoredRow[] = [];
  let linhas_lidas = 0;
  let ordem = 0;
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const razao = String(row[0]?.v ?? "").trim();
    const categoria = String(row[1]?.v ?? "").trim();
    if (!razao) continue;
    linhas_lidas++;
    if (isTotalRowName(razao)) {
      ignoradas.push({ razao_social: razao, motivo: "Linha de totalização/legenda" });
      continue;
    }
    if (!categoria && typeof row[2]?.v === "number") continue;

    const metas: Record<string, number> = {};
    const metas_status: Record<string, FarolStatus> = {};
    const metas_cores: Record<string, string> = {};
    familias.forEach((f, i) => {
      const cell = row[famCols[i]];
      if (typeof cell?.v === "number") metas[f] = cell.v;
      if (cell?.c) {
        metas_cores[f] = cell.c;
        const res = resolveCellStatus(null, cell.c);
        if (res.ok && res.status) metas_status[f] = res.status;
      }
    });
    const total = typeof row[totalCol]?.v === "number" ? (row[totalCol].v as number) : null;
    rows.push({
      ordem: ordem++,
      razao_social: razao,
      categoria: categoria || null,
      metas,
      metas_status,
      metas_cores,
      total_meta: total,
      total_pct_status: null,
    });
  }

  return {
    familias,
    categoriaMetas,
    escala,
    rows,
    participacao: null,
    atingimento: null,
    ignoradas,
    linhas_lidas,
    conflitos: [],
    parser_version: PARSER_VERSION,
  };
}
