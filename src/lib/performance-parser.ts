// Parser da planilha Excel de metas/desempenho por representante.
// Usa xlsx-js-style para conseguir ler a cor de fundo de cada célula
// (a lib "xlsx" pura não expõe estilos).

import * as XLSXStyle from "xlsx-js-style";
import { statusFromHex, type FarolStatus } from "./performance-farol";

export type ParsedRow = {
  ordem: number;
  razao_social: string;
  categoria: string | null;
  metas: Record<string, number>;
  metas_status: Record<string, FarolStatus>;
  metas_cores: Record<string, string>; // hex sem "#"
  total_meta: number | null;
};

export type ParsedSheet = {
  familias: string[];
  categoriaMetas: Record<string, number>;
  escala: { label: string; min: number | null; max: number | null }[];
  rows: ParsedRow[];
};

function parseRule(s: string): { min: number | null; max: number | null } {
  const nums = Array.from(s.matchAll(/(\d+[.,]?\d*)/g)).map((m) =>
    parseFloat(m[1].replace(",", ".")),
  );
  const lower = s.toLowerCase();
  if (lower.includes("acima")) return { min: nums[0] ?? null, max: null };
  if (lower.includes("abaixo")) return { min: null, max: nums[0] ?? null };
  if (nums.length >= 2) return { min: nums[0], max: nums[1] };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: null, max: null };
}

function cellHex(cell: any): string | null {
  const fg = cell?.s?.fill?.fgColor?.rgb ?? cell?.s?.fill?.bgColor?.rgb ?? null;
  if (!fg) return null;
  return String(fg).replace(/^#/, "").toUpperCase();
}

export async function parseWorkbook(buf: ArrayBuffer): Promise<ParsedSheet> {
  const wb = XLSXStyle.read(buf, { type: "array", cellStyles: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Planilha vazia.");
  const range = XLSXStyle.utils.decode_range(ws["!ref"] || "A1");

  // Grade [row][col] com a célula "crua" (para ler cor) e valor.
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

  // Localizar linha de cabeçalho: col 0 = GRUPO/RAZÃO SOCIAL, col 1 = CATEGORIA
  let headerRow = -1;
  for (let r = 0; r < Math.min(grid.length, 25); r++) {
    const a = String(grid[r]?.[0]?.v ?? "").trim().toUpperCase();
    const b = String(grid[r]?.[1]?.v ?? "").trim().toUpperCase();
    if ((a === "GRUPO" || a.startsWith("RAZAO") || a.startsWith("RAZÃO")) && b === "CATEGORIA") {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0)
    throw new Error("Cabeçalho não encontrado (linha com GRUPO/RAZÃO SOCIAL + CATEGORIA).");

  // Famílias na linha acima do cabeçalho
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

  // Metas por categoria e escala (linhas acima do cabeçalho)
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
    for (const cell of row) {
      const s = String(cell?.v ?? "").trim();
      if (s && /=/.test(s) && /%/.test(s)) {
        const [labelRaw, ruleRaw] = s.split("=");
        escala.push({ label: labelRaw.trim(), ...parseRule(ruleRaw) });
      }
    }
  }

  const rows: ParsedRow[] = [];
  let ordem = 0;
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const razao = String(row[0]?.v ?? "").trim();
    const categoria = String(row[1]?.v ?? "").trim();
    if (!razao) continue;
    // pula linha de totais (sem categoria + número na col 2)
    if (!categoria && typeof row[2]?.v === "number") continue;

    const metas: Record<string, number> = {};
    const metas_status: Record<string, FarolStatus> = {};
    const metas_cores: Record<string, string> = {};
    familias.forEach((f, i) => {
      const cell = row[famCols[i]];
      if (typeof cell?.v === "number") metas[f] = cell.v;
      if (cell?.c) {
        metas_cores[f] = cell.c;
        const st = statusFromHex(cell.c);
        if (st) metas_status[f] = st;
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
    });
  }

  return { familias, categoriaMetas, escala, rows };
}
