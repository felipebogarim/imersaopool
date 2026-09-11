import * as XLSXStyle from "xlsx-js-style";
import { isClientRow, isTotalRowName, type IgnoredRow } from "./client-row-filter";
import { normalizeFamilyName } from "./client-bi-parser";
import { statusFromRatio, type FarolStatus } from "./performance-farol";
import { resolveNumericAchievement } from "./performance-metrics";

export type RawCell = {
  v: unknown;
  w: string | null;
  z: string | null;
  addr: string;
  hex: string | null;
  rawColor: string | null;
  hasStyle: boolean;
};

export type DetectedSubcolumnKind = "realizado" | "media" | "meta" | "percentual" | "farol" | "desconhecida";

export type DetectedFamilyGroup = {
  familia: string;
  header: string;
  startCol: number;
  endCol: number;
  subcolumns: Partial<Record<DetectedSubcolumnKind, number>>;
};

export type StructureDiagnostic = {
  sheetName: string;
  headerRows: number[];
  dataStartRow: number;
  razaoCol: number;
  categoriaCol: number;
  totalMetaCol: number | null;
  totalPctCol: number | null;
  groups: DetectedFamilyGroup[];
};

export type ValidationIssue = {
  severity: "erro" | "alerta";
  scope: string;
  message: string;
};

export type ImportDiagnostic = {
  mode: "deterministic" | "deterministic_color_fallback";
  confidence: "alta" | "media" | "baixa";
  score: number;
  estrutura: StructureDiagnostic;
  validacao: {
    rowsRead: number;
    rowsAccepted: number;
    familiesDetected: number;
    numericMetaCells: number;
    numericRealizadoCells: number;
    numericPercentCells: number;
    calculatedPercentCells: number;
    colorFallbackCells: number;
    emptyCells: number;
    zeroCells: number;
    mathChecks: number;
    mathMismatches: number;
    issues: ValidationIssue[];
  };
  preservacao: {
    ignoredRows: IgnoredRow[];
    missingFamilies: string[];
  };
  resultado: {
    statusCells: number;
    rowsWithNumbers: number;
    rowsWithStatus: number;
  };
};

export type NormalizedPerformanceRow = {
  ordem: number;
  razao_social: string;
  categoria: string | null;
  metas: Record<string, number>;
  realizado: Record<string, number>;
  media: Record<string, number>;
  familia_pct: Record<string, number>;
  metas_status: Record<string, FarolStatus>;
  metas_cores: Record<string, string>;
  total_meta: number | null;
  total_pct: number | null;
  total_pct_status: FarolStatus | null;
};

export type AutonomousPerformanceResult = {
  familias: string[];
  rows: NormalizedPerformanceRow[];
  ignoradas: IgnoredRow[];
  linhas_lidas: number;
  diagnostic: ImportDiagnostic;
};

const strip = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const norm = (v: unknown) =>
  strip(v)
    .toUpperCase()
    .replace(/[ºª]/g, "")
    .replace(/[^A-Z0-9%$]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function cellText(c: RawCell | undefined): string {
  if (!c) return "";
  return strip(c.v ?? c.w ?? "");
}

function fillOf(cell: any): Pick<RawCell, "hex" | "rawColor" | "hasStyle"> {
  const style = cell?.s;
  if (!style) return { hex: null, rawColor: null, hasStyle: false };
  const fg = style?.fgColor ?? style?.fill?.fgColor ?? null;
  const rawRgb = fg?.rgb ?? null;
  if (typeof rawRgb !== "string") {
    if (fg?.theme != null) return { hex: null, rawColor: `theme:${fg.theme}`, hasStyle: true };
    if (fg?.indexed != null) return { hex: null, rawColor: `indexed:${fg.indexed}`, hasStyle: true };
    return { hex: null, rawColor: null, hasStyle: true };
  }
  let hex = rawRgb.trim().replace(/^#/, "").toUpperCase();
  if (hex.length === 8) hex = hex.slice(2);
  if (!/^[0-9A-F]{6}$/.test(hex) || hex === "000000") return { hex: null, rawColor: rawRgb, hasStyle: true };
  return { hex, rawColor: rawRgb, hasStyle: true };
}

function sheetGrid(ws: XLSXStyle.WorkSheet): RawCell[][] {
  const range = XLSXStyle.utils.decode_range(ws["!ref"] || "A1");
  const out: RawCell[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: RawCell[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r, c });
      const cell = ws[addr];
      const fill = fillOf(cell);
      row.push({
        v: cell ? cell.v : null,
        w: cell?.w ?? null,
        z: cell?.z ?? null,
        addr,
        ...fill,
      });
    }
    out.push(row);
  }
  return out;
}

function parseAmount(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s || s === "-" || /^n\/?a$/i.test(s)) return null;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/[()R$\s\u00a0]/gi, "").replace(/^-/, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Normaliza uma célula de coluna percentual para o ratio canônico (1 = 100%). */
export function parsePercentRatio(cell: Pick<RawCell, "v" | "w" | "z"> | undefined): number | null {
  const v = cell?.v;
  if (v == null || v === "") return null;
  // Em uma coluna estruturalmente reconhecida como percentual, o valor numérico
  // bruto do Excel já é o ratio. Sua magnitude nunca altera a unidade.
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const raw = String(v).trim();
  if (!raw || raw === "-") return null;
  if (/^>\s*100%?$/i.test(raw)) return null;
  if (/^<\s*50%?$/i.test(raw)) return null;
  const hasPct = raw.includes("%");
  const cleaned = raw.replace("%", "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  // Texto com símbolo é uma representação visual ("125%" = ratio 1,25).
  // Texto numérico sem símbolo herda a semântica percentual da coluna.
  return hasPct ? n / 100 : n;
}

function classifySubheader(v: unknown): DetectedSubcolumnKind {
  const s = norm(v);
  if (!s) return "desconhecida";
  if (s.includes("%") || s.includes("ATING") || s.includes("RESULT")) return "percentual";
  if (s.includes("META")) return "meta";
  if (s.includes("MEDIA") || s.includes("MÉDIA")) return "media";
  if (s.includes("REAL") || s.includes("FATUR") || s.includes("VENDA")) return "realizado";
  if (s.includes("FAROL") || s.includes("FAIXA") || s.includes("STATUS")) return "farol";
  return "desconhecida";
}

function looksLikePercentCell(cell: RawCell | undefined): boolean {
  if (!cell) return false;
  if (typeof cell.z === "string" && cell.z.includes("%")) return true;
  const text = String(cell.w ?? cell.v ?? "");
  return text.includes("%") && parsePercentRatio(cell) != null;
}

function inferSingleDataColumnKind(grid: RawCell[][], dataStartRow: number, col: number): DetectedSubcolumnKind {
  let pct = 0;
  let numeric = 0;
  for (let r = dataStartRow; r < Math.min(grid.length, dataStartRow + 30); r++) {
    const cell = grid[r]?.[col];
    if (!cell || cell.v == null || String(cell.v).trim() === "") continue;
    if (looksLikePercentCell(cell)) pct++;
    else if (typeof parseAmount(cell.v) === "number") numeric++;
  }
  if (pct > 0) return "percentual";
  if (numeric > 0) return "meta";
  return "desconhecida";
}

function isRazaoHeader(v: unknown): boolean {
  const s = norm(v);
  return s === "RAZAO SOCIAL" || s === "GRUPO" || s === "CLIENTE" || s.includes("RAZAO");
}

function isCategoriaHeader(v: unknown): boolean {
  return norm(v) === "CATEGORIA";
}

function detectStructure(name: string, grid: RawCell[][]): StructureDiagnostic | null {
  for (let hr = 0; hr < Math.min(grid.length, 40); hr++) {
    const row = grid[hr] ?? [];
    const razaoCol = row.findIndex((c) => isRazaoHeader(c.v));
    const categoriaCol = row.findIndex((c) => isCategoriaHeader(c.v));
    if (razaoCol < 0 || categoriaCol < 0) continue;

    let familyRow = hr;
    let bestCount = 0;
    for (let r = Math.max(0, hr - 4); r <= hr; r++) {
      const count = (grid[r] ?? []).filter((c) => normalizeFamilyName(c.v)).length;
      if (count > bestCount) {
        bestCount = count;
        familyRow = r;
      }
    }
    if (bestCount < 2) continue;

    const groups: DetectedFamilyGroup[] = [];
    let current: DetectedFamilyGroup | null = null;
    for (let c = Math.max(categoriaCol + 1, 0); c < Math.max(row.length, grid[familyRow]?.length ?? 0); c++) {
      const fam = normalizeFamilyName(grid[familyRow]?.[c]?.v);
      const header = cellText(grid[familyRow]?.[c]);
      if (fam) {
        if (current) groups.push(current);
        current = { familia: fam, header, startCol: c, endCol: c, subcolumns: {} };
      } else if (current) {
        current.endCol = c;
      }
    }
    if (current) groups.push(current);
    const validGroups = groups.filter((g) => g.familia);
    if (validGroups.length < 2) continue;

    const stopAt = row.findIndex((c, i) => i > categoriaCol && norm(c.v).includes("TOTAL") && norm(c.v).includes("META"));
    for (const g of validGroups) {
      for (let c = g.startCol; c <= g.endCol; c++) {
        if (stopAt >= 0 && c >= stopAt) break;
        const kind = classifySubheader(row[c]?.v);
        if (kind !== "desconhecida" && g.subcolumns[kind] == null) g.subcolumns[kind] = c;
      }
      if (!Object.keys(g.subcolumns).length) {
        const kind = classifySubheader(row[g.startCol]?.v);
        const inferred = kind === "desconhecida" ? inferSingleDataColumnKind(grid, hr + 1, g.startCol) : kind;
        if (inferred !== "desconhecida") g.subcolumns[inferred] = g.startCol;
      }
    }

    const totalMetaCol = row.findIndex((c, i) => i > categoriaCol && norm(c.v).includes("TOTAL") && norm(c.v).includes("META"));
    const totalPctCol = row.findIndex((c, i) => i > categoriaCol && (norm(c.v).includes("TOTAL") || norm(c.v).includes("ATING")) && norm(c.v).includes("%"));

    return {
      sheetName: name,
      headerRows: Array.from(new Set([familyRow, hr])).sort((a, b) => a - b).map((r) => r + 1),
      dataStartRow: hr + 2,
      razaoCol,
      categoriaCol,
      totalMetaCol: totalMetaCol >= 0 ? totalMetaCol : null,
      totalPctCol: totalPctCol >= 0 ? totalPctCol : null,
      groups: validGroups.map((g) => ({ ...g, endCol: stopAt >= 0 ? Math.min(g.endCol, stopAt - 1) : g.endCol })),
    };
  }
  return null;
}

function scoreDiagnostic(d: ImportDiagnostic): ImportDiagnostic {
  let score = 0;
  if (d.validacao.rowsAccepted > 0) score += 25;
  if (d.validacao.familiesDetected >= 5) score += 20;
  if (d.validacao.numericPercentCells > 0 || d.validacao.calculatedPercentCells > 0) score += 30;
  if (d.validacao.mathChecks > 0 && d.validacao.mathMismatches === 0) score += 15;
  if (d.resultado.statusCells > 0) score += 10;
  if (d.validacao.issues.some((i) => i.severity === "erro")) score = Math.min(score, 45);
  d.score = score;
  d.confidence = score >= 80 ? "alta" : score >= 55 ? "media" : "baixa";
  d.mode = "deterministic";
  return d;
}

export function parsePerformanceWorkbookDeterministic(wb: XLSXStyle.WorkBook): AutonomousPerformanceResult | null {
  const candidates: { name: string; grid: RawCell[][]; structure: StructureDiagnostic }[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const grid = sheetGrid(ws);
    const structure = detectStructure(name, grid);
    if (structure) candidates.push({ name, grid, structure });
  }
  if (!candidates.length) return null;

  candidates.sort((a, b) => b.structure.groups.length - a.structure.groups.length);
  const { grid, structure } = candidates[0];
  const rows: NormalizedPerformanceRow[] = [];
  const ignoradas: IgnoredRow[] = [];
  const issues: ValidationIssue[] = [];
  let linhas_lidas = 0;
  let numericMetaCells = 0;
  let numericRealizadoCells = 0;
  let numericPercentCells = 0;
  let calculatedPercentCells = 0;
  let colorFallbackCells = 0;
  let emptyCells = 0;
  let zeroCells = 0;
  let mathChecks = 0;
  let mathMismatches = 0;
  let rowsWithNumbers = 0;
  let rowsWithStatus = 0;

  const familias = Array.from(new Set(structure.groups.map((g) => g.familia)));
  let ordem = 0;
  for (let r = structure.dataStartRow - 1; r < grid.length; r++) {
    const line = grid[r] ?? [];
    const razao = cellText(line[structure.razaoCol]);
    if (!razao) continue;
    linhas_lidas++;
    const categoria = cellText(line[structure.categoriaCol]);
    if (isTotalRowName(razao)) {
      ignoradas.push({ razao_social: razao, motivo: "Linha de totalização/legenda" });
      continue;
    }
    if (!isClientRow({ razao_social: razao, categoria })) {
      ignoradas.push({ razao_social: razao, motivo: "Categoria ausente ou inválida" });
      continue;
    }

    const row: NormalizedPerformanceRow = {
      ordem: ordem++,
      razao_social: razao,
      categoria: categoria || null,
      metas: {},
      realizado: {},
      media: {},
      familia_pct: {},
      metas_status: {},
      metas_cores: {},
      total_meta: structure.totalMetaCol != null ? parseAmount(line[structure.totalMetaCol]?.v) : null,
      total_pct: structure.totalPctCol != null ? parsePercentRatio(line[structure.totalPctCol]) : null,
      total_pct_status: null,
    };

    let rowMetaSum = 0;
    let rowRealSum = 0;
    let rowHasNumbers = false;

    for (const group of structure.groups) {
      const metaCell = group.subcolumns.meta != null ? line[group.subcolumns.meta] : undefined;
      const realCell = group.subcolumns.realizado != null ? line[group.subcolumns.realizado] : undefined;
      const mediaCell = group.subcolumns.media != null ? line[group.subcolumns.media] : undefined;
      const pctCell = group.subcolumns.percentual != null ? line[group.subcolumns.percentual] : undefined;
      const meta = parseAmount(metaCell?.v);
      const realizado = parseAmount(realCell?.v);
      const media = parseAmount(mediaCell?.v);
      const explicitPct = parsePercentRatio(pctCell);
      const pct = resolveNumericAchievement({ percentual: explicitPct, realizado, media, meta });

      if (meta != null) {
        numericMetaCells++;
        if (meta === 0) zeroCells++;
      }
      if (realizado != null) {
        numericRealizadoCells++;
        if (realizado === 0) zeroCells++;
      }
      if (pct != null) {
        numericPercentCells++;
        if (pct === 0) zeroCells++;
      }
      if (meta == null && realizado == null && media == null && explicitPct == null) emptyCells++;
      if (explicitPct == null && pct != null) calculatedPercentCells++;
      if (pct != null && meta != null && meta > 0 && realizado != null) {
        mathChecks++;
        const expected = realizado / meta;
        if (Math.abs(expected - pct) > 0.015) {
          mathMismatches++;
          issues.push({
            severity: "alerta",
            scope: `${razao} / ${group.familia}`,
            message: "Percentual informado diverge de realizado ÷ meta acima da tolerância.",
          });
        }
      }

      const status: FarolStatus | null = statusFromRatio(pct);

      if (meta != null) {
        row.metas[group.familia] = meta;
        rowMetaSum += meta;
        rowHasNumbers = true;
      }
      if (realizado != null) {
        row.realizado[group.familia] = realizado;
        rowRealSum += realizado;
        rowHasNumbers = true;
      } else if (media != null) {
        row.media[group.familia] = media;
        rowRealSum += media;
        rowHasNumbers = true;
      }
      if (pct != null) row.familia_pct[group.familia] = pct;
      if (status) row.metas_status[group.familia] = status;
    }

    if (row.total_pct == null && rowMetaSum > 0 && Object.keys(row.realizado).length > 0) {
      row.total_pct = rowRealSum / rowMetaSum;
    }
    row.total_pct_status = statusFromRatio(row.total_pct);
    if (row.total_meta == null && rowMetaSum > 0) row.total_meta = rowMetaSum;
    if (rowHasNumbers) rowsWithNumbers++;
    if (Object.keys(row.metas_status).length > 0 || row.total_pct_status) rowsWithStatus++;
    rows.push(row);
  }

  const statusCells = rows.reduce((sum, row) => sum + Object.keys(row.metas_status).length + (row.total_pct_status ? 1 : 0), 0);
  if (!rows.length) issues.push({ severity: "erro", scope: "estrutura", message: "Nenhuma linha de cliente válida foi encontrada." });
  if (!familias.length) issues.push({ severity: "erro", scope: "estrutura", message: "Nenhuma família de produto foi reconhecida." });
  if (!statusCells && numericPercentCells + calculatedPercentCells === 0) {
    issues.push({ severity: "erro", scope: "resultado", message: "Nenhuma célula de desempenho foi interpretada." });
  }

  const diagnostic = scoreDiagnostic({
    mode: "deterministic",
    confidence: "baixa",
    score: 0,
    estrutura: structure,
    validacao: {
      rowsRead: linhas_lidas,
      rowsAccepted: rows.length,
      familiesDetected: familias.length,
      numericMetaCells,
      numericRealizadoCells,
      numericPercentCells,
      calculatedPercentCells,
      colorFallbackCells,
      emptyCells,
      zeroCells,
      mathChecks,
      mathMismatches,
      issues,
    },
    preservacao: {
      ignoredRows: ignoradas,
      missingFamilies: [],
    },
    resultado: {
      statusCells,
      rowsWithNumbers,
      rowsWithStatus,
    },
  });

  return { familias, rows, ignoradas, linhas_lidas, diagnostic };
}
