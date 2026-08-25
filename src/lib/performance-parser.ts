// Parser da planilha Excel de metas/desempenho por representante.
// Suporta o formato AJUSTADO (novo): cabeçalho na linha 1 com
// [RAZÃO SOCIAL, CATEGORIA, TOTAL META, TOTAL %, <famílias...>] e valores
// de família como faixa em texto ("0%", "<50", "50-69", "70-89", "90-100", ">100").
// Também mantém compatibilidade retroativa com o formato antigo (numérico + cor).
//
// Os valores financeiros vêm EXCLUSIVAMENTE da aba "Matriz Financeira".

import * as XLSXStyle from "xlsx-js-style";
import { statusFromFaixa, statusFromHex, statusFromPercent, statusFromRatio, type FarolStatus } from "./performance-farol";
import { resolveCellStatus, type CellConflict } from "./performance-cell-status";
import {
  parseMatrizFinanceiraGrid,
  validateMatrizFinanceira,
  type MatrizParseResult,
} from "./performance-matriz";
import { isClientRow, isTotalRowName, type IgnoredRow } from "./client-row-filter";
import { normalizeFamilyName } from "./client-bi-parser";
import {
  parsePerformanceWorkbookDeterministic,
  type ImportDiagnostic,
  type AutonomousPerformanceResult,
} from "./performance-import-engine";

export const PARSER_VERSION = "performance-parser@8-deterministic";

export type ParsedRow = {
  ordem: number;
  razao_social: string;
  categoria: string | null;
  metas: Record<string, number>;
  realizado?: Record<string, number>;
  familia_pct?: Record<string, number>;
  metas_status: Record<string, FarolStatus>;
  metas_cores: Record<string, string>; // hex sem "#"
  total_meta: number | null;
  total_pct?: number | null;
  total_pct_status: FarolStatus | null;
};

export type CellStats = {
  celulas_avaliadas: number;
  celulas_total_pct: number;
  celulas_familias: number;
  estilos_carregados: number;
  estilos_ausentes: number;
  cores_extraidas: number;
  cores_ausentes: number;
  cores_desconhecidas: number;
  divergencias_texto_cor: number;
  cores_distintas: string[];
  por_status: Partial<Record<FarolStatus, number>>;
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
  /** Conflitos de validação (bloqueiam a importação). */
  conflitos: CellConflict[];
  /** Contagens de validação de células/cores. */
  stats: CellStats;
  /** Diagnóstico técnico da leitura estrutural/autônoma, quando disponível. */
  diagnostic?: ImportDiagnostic;
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

  let hex = rawRgb.trim().replace(/^#/, "").trim().toUpperCase();
  if (hex.length === 8) hex = hex.slice(2);
  if (!/^[0-9A-F]{6}$/.test(hex)) return { hasStyle: true, raw: rawRgb, hex: null };
  // 000000 / 00000000 = "sem preenchimento" em muitos exports
  if (hex === "000000") return { hasStyle: true, raw: null, hex: null };
  return { hasStyle: true, raw: rawRgb, hex };
}

export function cellHex(cell: any): string | null {
  return cellFill(cell).hex;
}


function findHeaderRow(grid: { v: any }[][]): { row: number; layout: "novo" | "antigo" | "percentual" } | null {
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
      if (c.includes("ATINGIMENTO") || c.startsWith("TOTAL %") || c.includes("%")) {
        return { row: r, layout: "percentual" };
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

export type GridCell = { v: any; c: string | null; raw: string | null; hasStyle: boolean };

function statusFromFarolText(v: unknown): FarolStatus | null {
  const faixa = statusFromFaixa(v == null ? null : String(v));
  if (faixa) return faixa;
  const s = normSheet(String(v ?? ""));
  if (!s) return null;
  if (s === "SEM COMPRA" || s === "SEM VENDA") return "sem_compra";
  if (s === "ABAIXO DA META" || s === "ABAIXO META") return "abaixo_meta";
  if (s === "PODE MELHORAR") return "pode_melhorar";
  if (s === "PROXIMO" || s === "PROXIMO DA META") return "proximo";
  if (s === "OTIMO") return "otimo";
  if (s === "EXCELENTE") return "excelente";
  return null;
}

export const statusCount = (stats: CellStats) =>
  Object.values(stats.por_status).reduce((sum, n) => sum + (Number(n) || 0), 0);

export function validatePerformanceStatusCoverage(parsed: ParsedSheet): {
  ok: boolean;
  statusCells: number;
  rowsWithStatus: number;
  expectedCells: number;
} {
  const statusCells = parsed.rows.reduce(
    (sum, row) => sum + Object.keys(row.metas_status ?? {}).length + (row.total_pct_status ? 1 : 0),
    0,
  );
  const rowsWithStatus = parsed.rows.filter(
    (row) => Object.keys(row.metas_status ?? {}).length > 0 || Boolean(row.total_pct_status),
  ).length;
  const expectedCells = parsed.rows.length * Math.max(parsed.familias.length, 1);

  return {
    ok: parsed.rows.length > 0 && parsed.familias.length > 0 && statusCells > 0 && rowsWithStatus > 0,
    statusCells,
    rowsWithStatus,
    expectedCells,
  };
}

function collectFamilyColumns(row: GridCell[], startCol: number): { familias: string[]; famCols: number[] } {
  const familias: string[] = [];
  const famCols: number[] = [];
  const seen = new Set<string>();
  for (let c = startCol; c < row.length; c++) {
    const fam = normalizeFamilyName(row[c]?.v);
    if (!fam || seen.has(fam)) continue;
    seen.add(fam);
    familias.push(fam);
    famCols.push(c);
  }
  return { familias, famCols };
}

function parseBaseBISheet(wb: XLSXStyle.WorkBook): BaseSheet | null {
  const name = wb.SheetNames.find((n) => normSheet(n) === "BASE BI");
  if (!name) return null;
  const ws = wb.Sheets[name];
  if (!ws) return null;
  const raw = XLSXStyle.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: true }) as unknown[][];
  const headerRow = raw.findIndex((row) => {
    const cells = (row ?? []).map((v) => normSheet(String(v ?? "")));
    return cells.includes("CLIENTE") && cells.includes("CATEGORIA") && cells.includes("FAMILIA") && cells.some((v) => v.includes("FAROL"));
  });
  if (headerRow < 0) return null;

  const header = raw[headerRow] ?? [];
  const indexOf = (pred: (s: string) => boolean) =>
    header.findIndex((v) => pred(normSheet(String(v ?? ""))));
  const clienteCol = indexOf((s) => s === "CLIENTE" || s === "RAZAO SOCIAL");
  const categoriaCol = indexOf((s) => s === "CATEGORIA");
  const familiaCol = indexOf((s) => s === "FAMILIA");
  const metaCol = indexOf((s) => s === "META" || s.includes("R$ META"));
  const farolCol = indexOf((s) => s.includes("FAROL"));
  if (clienteCol < 0 || categoriaCol < 0 || familiaCol < 0 || farolCol < 0) return null;

  const byClient = new Map<string, ParsedRow>();
  const familias: string[] = [];
  const familySet = new Set<string>();
  const stats = emptyStats();
  let linhas_lidas = 0;

  for (let r = headerRow + 1; r < raw.length; r++) {
    const row = raw[r] ?? [];
    const razao = String(row[clienteCol] ?? "").trim();
    const categoria = String(row[categoriaCol] ?? "").trim();
    const familia = normalizeFamilyName(row[familiaCol]);
    if (!razao || !familia) continue;
    linhas_lidas++;
    if (!isClientRow({ razao_social: razao, categoria })) continue;
    if (!familySet.has(familia)) {
      familySet.add(familia);
      familias.push(familia);
    }
    const key = `${normSheet(razao)}|${normSheet(categoria)}`;
    let out = byClient.get(key);
    if (!out) {
      out = {
        ordem: byClient.size,
        razao_social: razao,
        categoria: categoria || null,
        metas: {},
        metas_status: {},
        metas_cores: {},
        total_meta: null,
        total_pct_status: null,
      };
      byClient.set(key, out);
    }
    const meta = metaCol >= 0 ? row[metaCol] : null;
    if (typeof meta === "number" && Number.isFinite(meta)) out.metas[familia] = meta;
    const status = statusFromFarolText(row[farolCol]);
    stats.celulas_avaliadas++;
    stats.celulas_familias++;
    stats.estilos_ausentes++;
    if (status) {
      out.metas_status[familia] = status;
      stats.por_status[status] = (stats.por_status[status] ?? 0) + 1;
    }
  }

  return {
    familias,
    categoriaMetas: {},
    escala: [],
    rows: Array.from(byClient.values()).filter((r) => Object.keys(r.metas_status).length > 0),
    participacao: null,
    atingimento: null,
    ignoradas: [],
    linhas_lidas,
    conflitos: [],
    stats,
    parser_version: PARSER_VERSION,
  };
}

function statusFromPercentCellValue(v: unknown): FarolStatus | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return statusFromRatio(v);
  }
  const raw = String(v).trim();
  if (!raw) return null;
  const compact = raw.toLowerCase().replace(/\s+/g, "");
  if (compact.startsWith("<") || compact.startsWith(">") || /^\d+[-–a]\d+/.test(compact)) return null;
  if (!/%/.test(raw) && !/^[-+]?\d+(?:[,.]\d+)?$/.test(raw)) return null;
  const n = Number(raw.replace("%", "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return raw.includes("%") ? statusFromPercent(n) : statusFromRatio(n);
}

function isExplicitPercentStatusHeader(v: unknown): boolean {
  const s = normSheet(String(v ?? ""));
  if (!s) return false;
  return s.includes("%") || s.includes("ATINGIMENTO") || s.includes("FAROL");
}

export function findPerformanceSheetName(names: string[]): string | undefined {
  return (
    names.find((n) => normSheet(n) === "PERFORMANCE") ??
    names.find((n) => normSheet(n).includes("PERFORMANC"))
  );
}

/** Última tentativa: qualquer aba que contenha o cabeçalho canônico (RAZÃO SOCIAL + CATEGORIA). */
function sheetHasPerformanceHeader(wb: XLSXStyle.WorkBook, name: string): boolean {
  const ws = wb.Sheets[name];
  if (!ws) return false;
  const grid = XLSXStyle.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: true }) as unknown[][];
  const asCells = grid.slice(0, 25).map((r) => (r ?? []).map((v) => ({ v })));
  return !!findHeaderRow(asCells);
}

function findSheetByHeader(wb: XLSXStyle.WorkBook): string | undefined {
  return wb.SheetNames.find((name) => sheetHasPerformanceHeader(wb, name));
}

/** Abas auxiliares que devem acompanhar qualquer aba de performance selecionada. */
function isAuxSheet(name: string): boolean {
  const v = normSheet(name);
  return (v.includes("MATRIZ") && v.includes("FINANC")) || v === "BASE BI";
}

/**
 * Lista TODAS as abas do arquivo que contêm uma matriz de performance
 * (uma por representante, no caso do envio em massa).
 */
export function listPerformanceSheetNames(buf: ArrayBuffer): string[] {
  const wb = XLSXStyle.read(buf, { type: "array" });
  return wb.SheetNames.filter(
    (n) => !isAuxSheet(n) && (normSheet(n).includes("PERFORMANC") || sheetHasPerformanceHeader(wb, n)),
  );
}

export async function parseWorkbook(
  buf: ArrayBuffer,
  opts?: { sheetName?: string },
): Promise<ParsedSheet> {
  const full = XLSXStyle.read(buf, { type: "array", cellStyles: true });
  let wb = full;
  if (opts?.sheetName && full.SheetNames.includes(opts.sheetName)) {
    const keep = full.SheetNames.filter((n) => n === opts.sheetName || isAuxSheet(n));
    const sheets: Record<string, any> = {};
    for (const n of keep) sheets[n] = full.Sheets[n];
    wb = { ...full, SheetNames: keep, Sheets: sheets } as XLSXStyle.WorkBook;
  }
  const deterministic = parsePerformanceWorkbookDeterministic(wb);
  const performanceSheetName =
    (opts?.sheetName && wb.SheetNames.includes(opts.sheetName) ? opts.sheetName : undefined) ??
    findPerformanceSheetName(wb.SheetNames) ??
    findSheetByHeader(wb);
  const matriz = readMatriz(wb);
  const matriz_erros = matriz ? validateMatrizFinanceira(matriz) : [];
  if (deterministic && deterministic.diagnostic.resultado.statusCells > 0) {
    return deterministicToParsedSheet(deterministic, matriz, matriz_erros);
  }
  const baseBI = parseBaseBISheet(wb);
  if (!performanceSheetName) {
    if (baseBI && statusCount(baseBI.stats) > 0) return { ...baseBI, matriz, matriz_erros };
    throw new Error(
      `Não encontramos a aba de Performance no arquivo. Abas disponíveis: ${wb.SheetNames.join(", ") || "nenhuma"}. Renomeie a aba com os dados para "Performance" ou garanta o cabeçalho RAZÃO SOCIAL + CATEGORIA.`,
    );
  }
  const ws = wb.Sheets[performanceSheetName];
  if (!ws) throw new Error("Planilha vazia.");

  const range = XLSXStyle.utils.decode_range(ws["!ref"] || "A1");

  const grid: GridCell[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: GridCell[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r, c });
      const cell = ws[addr];
      const fill = cellFill(cell);
      row.push({ v: cell ? cell.v : null, c: fill.hex, raw: fill.raw, hasStyle: fill.hasStyle });
    }
    grid.push(row);
  }

  const head = findHeaderRow(grid);
  if (!head) throw new Error("Cabeçalho não encontrado (linha com RAZÃO SOCIAL + CATEGORIA).");

  const base =
    head.layout === "novo"
      ? parseNovo(grid, head.row)
      : head.layout === "percentual"
        ? parsePercentual(grid, head.row)
        : parseAntigo(grid, head.row);

  if (statusCount(base.stats) === 0 && baseBI && statusCount(baseBI.stats) > 0) {
    return { ...baseBI, matriz, matriz_erros };
  }

  if (base.stats.celulas_familias > 0 && statusCount(base.stats) === 0) {
    throw new Error(
      "Não foi possível ler os faróis de desempenho da planilha. As células de família não trouxeram cores/faixas válidas, então a importação foi interrompida para evitar resultados zerados ou incorretos.",
    );
  }

  return { ...base, matriz, matriz_erros };
}

function deterministicToParsedSheet(
  result: AutonomousPerformanceResult,
  matriz: MatrizParseResult | null,
  matriz_erros: string[],
): ParsedSheet {
  const stats = emptyStats();
  stats.celulas_familias = result.rows.length * result.familias.length;
  stats.celulas_total_pct = result.rows.length;
  stats.celulas_avaliadas = result.diagnostic.resultado.statusCells;
  stats.cores_extraidas = result.diagnostic.validacao.colorFallbackCells;
  stats.estilos_ausentes = result.diagnostic.validacao.emptyCells;
  for (const row of result.rows) {
    for (const status of Object.values(row.metas_status)) {
      stats.por_status[status] = (stats.por_status[status] ?? 0) + 1;
    }
    if (row.total_pct_status) {
      stats.por_status[row.total_pct_status] = (stats.por_status[row.total_pct_status] ?? 0) + 1;
    }
    for (const color of Object.values(row.metas_cores ?? {})) {
      if (!stats.cores_distintas.includes(color)) stats.cores_distintas.push(color);
    }
  }
  stats.cores_distintas.sort();

  return {
    familias: result.familias,
    categoriaMetas: {},
    escala: [],
    rows: result.rows,
    participacao: null,
    atingimento: null,
    ignoradas: result.ignoradas,
    linhas_lidas: result.linhas_lidas,
    matriz,
    matriz_erros,
    conflitos: [],
    stats,
    diagnostic: result.diagnostic,
    parser_version: PARSER_VERSION,
  };
}


// ---------- Novo formato (planilha ajustada) ----------
function toPct(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return v * 100;
  }
  const s = String(v).trim().replace("%", "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

type BaseSheet = Omit<ParsedSheet, "matriz" | "matriz_erros">;

function parseNovo(grid: GridCell[][], headerRow: number): BaseSheet {
  const hdr = grid[headerRow] ?? [];
  // colunas: 0 Razão, 1 Categoria, 2 Total Meta, 3 Total %, 4.. famílias
  const { familias, famCols } = collectFamilyColumns(hdr, 4);

  const rows: ParsedRow[] = [];
  let participacao: ResumoPct | null = null;
  let atingimento: ResumoPct | null = null;
  const ignoradas: IgnoredRow[] = [];
  const conflitos: CellConflict[] = [];
  const stats: CellStats = {
    celulas_avaliadas: 0,
    celulas_total_pct: 0,
    celulas_familias: 0,
    estilos_carregados: 0,
    estilos_ausentes: 0,
    cores_extraidas: 0,
    cores_ausentes: 0,
    cores_desconhecidas: 0,
    divergencias_texto_cor: 0,
    cores_distintas: [],
    por_status: {},
  };
  const distintas = new Set<string>();
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

    const avaliar = (cell: GridCell | undefined, familia: string): FarolStatus | null => {
      stats.celulas_avaliadas++;
      if (cell?.hasStyle) stats.estilos_carregados++;
      else stats.estilos_ausentes++;
      if (cell?.c) {
        stats.cores_extraidas++;
        distintas.add(cell.c);
      }
      const res = resolveCellStatus(cell?.v, cell?.c, {
        hasStyle: Boolean(cell?.hasStyle),
        rawColor: cell?.raw ?? null,
      });
      if (res.ok) {
        const status = res.status ?? statusFromPercentCellValue(cell?.v) ?? statusFromFarolText(cell?.v);
        if (status) stats.por_status[status] = (stats.por_status[status] ?? 0) + 1;
        return status;
      }
      const fallback = statusFromPercentCellValue(cell?.v) ?? statusFromFarolText(cell?.v);
      if (fallback && (res.conflito.motivo === "estilo_ausente" || res.conflito.motivo === "cor_ausente")) {
        if (res.conflito.motivo === "cor_ausente") stats.cores_ausentes++;
        stats.por_status[fallback] = (stats.por_status[fallback] ?? 0) + 1;
        return fallback;
      }
      if (res.conflito.motivo === "cor_ausente") stats.cores_ausentes++;
      else if (res.conflito.motivo === "cor_nao_reconhecida") stats.cores_desconhecidas++;
      else if (res.conflito.motivo === "divergencia_texto_cor") stats.divergencias_texto_cor++;
      conflitos.push({ ...res.conflito, linha: r + 1, razao_social: razao, familia });
      return null;
    };

    stats.celulas_total_pct++;
    const total_pct_status = avaliar(row[3], "TOTAL %");

    const metas: Record<string, number> = {};
    const metas_status: Record<string, FarolStatus> = {};
    const metas_cores: Record<string, string> = {};
    familias.forEach((f, i) => {
      const cell = row[famCols[i]];
      if (typeof cell?.v === "number" && Number.isFinite(cell.v)) metas[f] = cell.v;
      stats.celulas_familias++;
      const status = avaliar(cell, f);
      if (status) metas_status[f] = status;
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

  stats.cores_distintas = Array.from(distintas).sort();

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
    stats,
    parser_version: PARSER_VERSION,
  };
}

// ---------- Formato percentual/exportado ----------
// Colunas: RAZÃO SOCIAL | CATEGORIA | ATINGIMENTO % | <famílias canônicas...> | totais...
// Usado por planilhas/exportações que trazem percentuais numéricos em vez das faixas textuais.
function parsePercentual(grid: GridCell[][], headerRow: number): BaseSheet {
  const hdr = grid[headerRow] ?? [];
  const { familias, famCols } = collectFamilyColumns(hdr, 3);
  const rows: ParsedRow[] = [];
  const ignoradas: IgnoredRow[] = [];
  const conflitos: CellConflict[] = [];
  const stats: CellStats = emptyStats();
  const distintas = new Set<string>();
  let linhas_lidas = 0;
  let ordem = 0;

  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const razao = String(row[0]?.v ?? "").trim();
    if (!razao) continue;
    linhas_lidas++;

    if (isTotalRowName(razao)) {
      ignoradas.push({ razao_social: razao, motivo: "Linha de totalização/legenda" });
      continue;
    }

    const categoria = String(row[1]?.v ?? "").trim();
    if (!isClientRow({ razao_social: razao, categoria })) {
      ignoradas.push({ razao_social: razao, motivo: "Categoria ausente ou inválida" });
      continue;
    }

    const avaliar = (cell: GridCell | undefined, familia: string): FarolStatus | null => {
      stats.celulas_avaliadas++;
      if (cell?.hasStyle) stats.estilos_carregados++;
      else stats.estilos_ausentes++;
      if (cell?.c) {
        stats.cores_extraidas++;
        distintas.add(cell.c);
      }
      const res = resolveCellStatus(cell?.v, cell?.c, {
        hasStyle: Boolean(cell?.hasStyle),
        rawColor: cell?.raw ?? null,
      });
      if (res.ok) {
        const status = res.status ?? statusFromPercentCellValue(cell?.v) ?? statusFromFarolText(cell?.v);
        if (status) stats.por_status[status] = (stats.por_status[status] ?? 0) + 1;
        return status;
      }
      const fallback = statusFromPercentCellValue(cell?.v) ?? statusFromFarolText(cell?.v);
      if (fallback && (res.conflito.motivo === "estilo_ausente" || res.conflito.motivo === "cor_ausente")) {
        if (res.conflito.motivo === "cor_ausente") stats.cores_ausentes++;
        stats.por_status[fallback] = (stats.por_status[fallback] ?? 0) + 1;
        return fallback;
      }
      if (res.conflito.motivo === "cor_ausente") stats.cores_ausentes++;
      else if (res.conflito.motivo === "cor_nao_reconhecida") stats.cores_desconhecidas++;
      else if (res.conflito.motivo === "divergencia_texto_cor") stats.divergencias_texto_cor++;
      conflitos.push({ ...res.conflito, linha: r + 1, razao_social: razao, familia });
      return null;
    };

    stats.celulas_total_pct++;
    const total_pct_status = avaliar(row[2], "ATINGIMENTO %");
    const metas_status: Record<string, FarolStatus> = {};
    const metas_cores: Record<string, string> = {};
    familias.forEach((f, i) => {
      const cell = row[famCols[i]];
      stats.celulas_familias++;
      const status = avaliar(cell, f);
      if (status) metas_status[f] = status;
      if (cell?.c) metas_cores[f] = cell.c;
    });

    rows.push({
      ordem: ordem++,
      razao_social: razao,
      categoria: categoria || null,
      metas: {},
      metas_status,
      metas_cores,
      total_meta: null,
      total_pct_status,
    });
  }

  stats.cores_distintas = Array.from(distintas).sort();
  return {
    familias,
    categoriaMetas: {},
    escala: [],
    rows,
    participacao: null,
    atingimento: null,
    ignoradas,
    linhas_lidas,
    conflitos,
    stats,
    parser_version: PARSER_VERSION,
  };
}


export function emptyStats(): CellStats {
  return {
    celulas_avaliadas: 0,
    celulas_total_pct: 0,
    celulas_familias: 0,
    estilos_carregados: 0,
    estilos_ausentes: 0,
    cores_extraidas: 0,
    cores_ausentes: 0,
    cores_desconhecidas: 0,
    divergencias_texto_cor: 0,
    cores_distintas: [],
    por_status: {},
  };
}

// ---------- Formato antigo (mantido para compatibilidade) ----------
function parseAntigo(grid: GridCell[][], headerRow: number): BaseSheet {
  const famRow = grid[headerRow - 1] ?? [];
  const { familias, famCols } = collectFamilyColumns(famRow, 2);
  const totalCol = famCols.length ? famCols[famCols.length - 1] + 1 : 2;
  const hasTotalPctStatus = isExplicitPercentStatusHeader(grid[headerRow]?.[totalCol]?.v);
  const legacyUsesColorFarol = grid
    .slice(headerRow + 1)
    .some((row) => famCols.some((col) => statusFromHex(row[col]?.c)) || statusFromHex(row[totalCol]?.c));
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
  const conflitos: CellConflict[] = [];
  const stats: CellStats = emptyStats();
  const distintas = new Set<string>();
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
    if (!isClientRow({ razao_social: razao, categoria })) {
      ignoradas.push({ razao_social: razao, motivo: "Categoria ausente ou inválida" });
      continue;
    }

    const avaliar = (cell: GridCell | undefined, familia: string): FarolStatus | null => {
      stats.celulas_avaliadas++;
      if (cell?.hasStyle) stats.estilos_carregados++;
      else stats.estilos_ausentes++;
      if (cell?.c) {
        stats.cores_extraidas++;
        distintas.add(cell.c);
      }

      const res = resolveCellStatus(cell?.v, cell?.c, {
        hasStyle: Boolean(cell?.hasStyle),
        rawColor: cell?.raw ?? null,
      });
      if (res.ok) {
        const status = res.status ?? statusFromFarolText(cell?.v);
        if (status) stats.por_status[status] = (stats.por_status[status] ?? 0) + 1;
        return status;
      }

      const fallback = statusFromFarolText(cell?.v);
      if (fallback && (res.conflito.motivo === "estilo_ausente" || res.conflito.motivo === "cor_ausente")) {
        if (res.conflito.motivo === "cor_ausente") stats.cores_ausentes++;
        stats.por_status[fallback] = (stats.por_status[fallback] ?? 0) + 1;
        return fallback;
      }

      if (res.conflito.motivo === "cor_ausente") stats.cores_ausentes++;
      else if (res.conflito.motivo === "cor_nao_reconhecida") stats.cores_desconhecidas++;
      else if (res.conflito.motivo === "divergencia_texto_cor") stats.divergencias_texto_cor++;
      conflitos.push({ ...res.conflito, linha: r + 1, razao_social: razao, familia });
      return null;
    };

    const metas: Record<string, number> = {};
    const metas_status: Record<string, FarolStatus> = {};
    const metas_cores: Record<string, string> = {};
    familias.forEach((f, i) => {
      const cell = row[famCols[i]];
      if (typeof cell?.v === "number" && Number.isFinite(cell.v)) metas[f] = cell.v;
      stats.celulas_familias++;
      const status = avaliar(cell, f);
      if (status) metas_status[f] = status;
      else if (
        legacyUsesColorFarol &&
        typeof cell?.v === "number" &&
        Number.isFinite(cell.v) &&
        cell.v > 0 &&
        !cell.c &&
        !cell.raw
      ) {
        metas_status[f] = "sem_compra";
        stats.por_status.sem_compra = (stats.por_status.sem_compra ?? 0) + 1;
      }
      if (cell?.c) metas_cores[f] = cell.c;
    });
    const totalCell = row[totalCol];
    const total = typeof totalCell?.v === "number" ? (totalCell.v as number) : null;
    const shouldReadTotalStatus = hasTotalPctStatus || Boolean(totalCell?.c);
    const total_pct_status = shouldReadTotalStatus ? avaliar(totalCell, "TOTAL") : null;
    if (shouldReadTotalStatus) stats.celulas_total_pct++;
    rows.push({
      ordem: ordem++,
      razao_social: razao,
      categoria: categoria || null,
      metas,
      metas_status,
      metas_cores,
      total_meta: total,
      total_pct_status,
    });
  }

  stats.cores_distintas = Array.from(distintas).sort();

  return {
    familias,
    categoriaMetas,
    escala,
    rows,
    participacao: null,
    atingimento: null,
    ignoradas,
    linhas_lidas,
    conflitos,
    stats,
    parser_version: PARSER_VERSION,
  };
}
