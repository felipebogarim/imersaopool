import * as XLSX from "xlsx";
import {
  CANONICAL_ORDER,
  buildBI,
  clientBiErrorMessage,
  isCanonicalFamily,
  normalizeFamilyName,
  normalizeText as normalize,
  normalizeTrafficLightGroup,
  validateFamilias,
  farolFromAtingimento,
  deriveFamiliasItens,
  type ClientBIData,
  type ClientFamiliasData,
  type FamiliaResultado,
} from "./client-bi-familias";

// Reexporta a fonte única de verdade para consumidores antigos.
export {
  CANONICAL_FAMILIES,
  CANONICAL_ORDER,
  calculateBestFamily,
  calculateWorstFamily,
  calculateTrafficLightDistribution,
  deriveFamiliasItens,
  getFamiliasCliente,
  isCanonicalFamily,
  normalizeFamilyName,
  normalizeTrafficLightGroup,
  validateFamilias,
  validateClientBI,
} from "./client-bi-familias";
export type { ClientBIData, ClientFamiliasData, FamiliaResultado } from "./client-bi-familias";

void CANONICAL_ORDER;


// ============= Helpers =============

export function parseDecimalResult(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace("%", "").replace(",", ".").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
const num = parseDecimalResult;
const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

function readSheetRows(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: true, defval: null });
}

function findHeaderRow(
  rows: unknown[][],
  required: string[],
  maxScan = 20,
): { row: number; idx: Record<string, number> } | null {
  const req = required.map((r) => normalize(r));
  const scan = Math.min(rows.length, maxScan);
  for (let i = 0; i < scan; i++) {
    const cells = (rows[i] ?? []).map((c) => normalize(c));
    const idx: Record<string, number> = {};
    let ok = true;
    for (let k = 0; k < req.length; k++) {
      const want = req[k];
      const at = cells.findIndex((c) => c === want || c.startsWith(want));
      if (at < 0) {
        ok = false;
        break;
      }
      idx[required[k]] = at;
    }
    if (ok) return { row: i, idx };
  }
  return null;
}

function isStopMarker(cell: unknown): boolean {
  const n = normalize(cell);
  if (!n) return false;
  return (
    n.startsWith("POSICAO") ||
    n.startsWith("TRES PIORES") ||
    n.startsWith("COEFICIENTES") ||
    n.startsWith("LEITURA DO GRAFICO") ||
    n.startsWith("MELHOR FAMILIA") ||
    n.startsWith("PIOR FAMILIA")
  );
}

// ============= Cálculos =============
// Toda a lógica de cálculo/validação vive em ./client-bi-familias (fonte única).

/** @deprecated use validateFamilias */
export const validateSevenFamilies = validateFamilias;


// ============= 1) BI POR CLIENTE — Índice + abas =============
// Índice: ID | CLIENTE | CATEGORIA | ATINGIMENTO GERAL | ABA
// Cada aba: header "FAMÍLIA | RESULTADO | PARTICIPAÇÃO | GRUPO DO FAROL", 7 famílias.

type IndiceRowBI = {
  id: string;
  cliente: string;
  categoria: string | null;
  geral: number | null;
  aba: string;
};

function readBiIndice(ws: XLSX.WorkSheet): IndiceRowBI[] | null {
  const rows = readSheetRows(ws);
  const h = findHeaderRow(rows, ["ID", "CLIENTE", "CATEGORIA", "ATINGIMENTO GERAL", "ABA"]);
  if (!h) return null;
  const out: IndiceRowBI[] = [];
  for (let i = h.row + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const id = str(r[h.idx["ID"]]);
    const cli = str(r[h.idx["CLIENTE"]]);
    const aba = str(r[h.idx["ABA"]]);
    if (!id || !cli || !aba) continue;
    out.push({
      id,
      cliente: cli,
      categoria: str(r[h.idx["CATEGORIA"]]),
      geral: num(r[h.idx["ATINGIMENTO GERAL"]]),
      aba,
    });
  }
  return out.length ? out : null;
}

function parseBiClientSheet(ws: XLSX.WorkSheet): {
  familias: FamiliaResultado[];
  geralFallback: number | null;
  categoriaFallback: string | null;
} {
  const rows = readSheetRows(ws);
  // Header "FAMÍLIA | RESULTADO | PARTICIPAÇÃO | GRUPO DO FAROL"
  const h = findHeaderRow(rows, ["FAMILIA", "RESULTADO", "PARTICIPACAO", "GRUPO DO FAROL"], 15);
  const familias: FamiliaResultado[] = [];
  if (h) {
    for (let i = h.row + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const first = r[h.idx["FAMILIA"]];
      if (first == null || String(first).trim() === "") break;
      if (isStopMarker(first)) break;
      const fam = normalizeFamilyName(first);
      if (!fam) break; // primeira linha fora do canônico encerra a tabela
      familias.push({
        familia: fam,
        atingimento: num(r[h.idx["RESULTADO"]]),
        participacao: num(r[h.idx["PARTICIPACAO"]]),
        farol: statusToLabel(num(r[h.idx["RESULTADO"]])),
      });
      if (familias.length === 7) break;
    }
  }
  // Fallbacks: "ATINGIMENTO PONDERADO GERAL" e Categoria no rodapé/cabeçalho
  let geralFallback: number | null = null;
  let categoriaFallback: string | null = null;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = rows[i] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (normalize(row[c]).startsWith("ATINGIMENTO PONDERADO GERAL")) {
        const below = rows[i + 1]?.[c];
        const v = num(below);
        if (v != null) geralFallback = v;
      }
    }
    const t = str(row[0]);
    if (t) {
      const m = t.match(/Categoria\s*:\s*([^·|]+)/i);
      if (m) categoriaFallback = m[1].trim();
    }
  }
  return { familias, geralFallback, categoriaFallback };
}

function parseBiPorCliente(
  wb: XLSX.WorkBook,
): Array<{ razao_social: string; data: ClientBIData }> | null {
  const idxSheet = wb.Sheets["Índice"] ?? wb.Sheets["Indice"];
  if (!idxSheet) return null;
  const indice = readBiIndice(idxSheet);
  if (!indice) return null;
  const out: Array<{ razao_social: string; data: ClientBIData }> = [];
  for (const row of indice) {
    const ws = wb.Sheets[row.aba];
    if (!ws) continue;
    const { familias, geralFallback, categoriaFallback } = parseBiClientSheet(ws);
    const err = validateSevenFamilies(familias);
    if (err) throw new Error(clientBiErrorMessage(row.cliente, err));
    out.push({
      razao_social: row.cliente,
      data: buildBI(row.categoria ?? categoriaFallback, row.geral ?? geralFallback, familias),
    });
  }
  return out;
}

// ============= 2) GRÁFICOS DE BARRAS — Índice + abas (RESULTADO GERAL E POR FAMÍLIA) =============
// Índice: ID | CLIENTE | CATEGORIA | RESULTADO GERAL | ABA
// Cada aba: header "ORDEM | TIPO | INDICADOR | RESULTADO | GRUPO DO FAROL"
//           ORDEM=0 TIPO=Geral, seguido de 7 famílias TIPO=Família.

type IndiceRowGraf = {
  id: string;
  cliente: string;
  categoria: string | null;
  geral: number | null;
  aba: string;
};

function readGrafIndice(ws: XLSX.WorkSheet): IndiceRowGraf[] | null {
  const rows = readSheetRows(ws);
  const h = findHeaderRow(rows, ["ID", "CLIENTE", "CATEGORIA", "RESULTADO GERAL", "ABA"]);
  if (!h) return null;
  const out: IndiceRowGraf[] = [];
  for (let i = h.row + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const id = str(r[h.idx["ID"]]);
    const cli = str(r[h.idx["CLIENTE"]]);
    const aba = str(r[h.idx["ABA"]]);
    if (!id || !cli || !aba) continue;
    out.push({
      id,
      cliente: cli,
      categoria: str(r[h.idx["CATEGORIA"]]),
      geral: num(r[h.idx["RESULTADO GERAL"]]),
      aba,
    });
  }
  return out.length ? out : null;
}

function parseGrafClientSheet(ws: XLSX.WorkSheet): {
  familias: FamiliaResultado[];
  geral: number | null;
  categoria: string | null;
} {
  const rows = readSheetRows(ws);
  const h = findHeaderRow(rows, ["ORDEM", "TIPO", "INDICADOR", "RESULTADO"], 15);
  const familias: FamiliaResultado[] = [];
  let geral: number | null = null;
  if (h) {
    for (let i = h.row + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const tipo = normalize(r[h.idx["TIPO"]]);
      const indicador = r[h.idx["INDICADOR"]];
      const indNorm = normalize(indicador);
      if (!tipo && !indNorm) break;
      if (isStopMarker(indicador)) break;
      const resultado = num(r[h.idx["RESULTADO"]]);
      if (tipo === "GERAL") {
        if (geral == null) geral = resultado;
        continue;
      }
      if (tipo !== "FAMILIA") break;
      const fam = normalizeFamilyName(indicador);
      if (!fam) break;
      familias.push({
        familia: fam,
        atingimento: resultado,
        farol: statusToLabel(resultado),
      });
      if (familias.length === 7) break;
    }
  }
  // Categoria no cabeçalho "Período: ... · Categoria: X"
  let categoria: string | null = null;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const t = str((rows[i] ?? [])[0]);
    if (t) {
      const m = t.match(/Categoria\s*:\s*([^·|]+)/i);
      if (m) categoria = m[1].trim();
    }
  }
  return { familias, geral, categoria };
}

function statusToLabel(decimal: number | null): string | null {
  return farolFromAtingimento(decimal);
}


function parseGrafPorCliente(
  wb: XLSX.WorkBook,
): Array<{ razao_social: string; data: ClientBIData }> | null {
  const idxSheet = wb.Sheets["Índice"] ?? wb.Sheets["Indice"];
  if (!idxSheet) return null;
  const indice = readGrafIndice(idxSheet);
  if (!indice) return null;
  const out: Array<{ razao_social: string; data: ClientBIData }> = [];
  for (const row of indice) {
    const ws = wb.Sheets[row.aba];
    if (!ws) continue;
    const { familias, geral, categoria } = parseGrafClientSheet(ws);
    const err = validateSevenFamilies(familias);
    if (err) throw new Error(clientBiErrorMessage(row.cliente, err));
    out.push({
      razao_social: row.cliente,
      data: buildBI(row.categoria ?? categoria, row.geral ?? geral, familias),
    });
  }
  return out;
}

// ============= 3) "Dados para gráfico" (long format) =============
// Header: ID CLIENTE | CLIENTE | CATEGORIA | ORDEM | TIPO | INDICADOR | RESULTADO | GRUPO DO FAROL

function parseDadosGraficoLong(
  wb: XLSX.WorkBook,
): Array<{ razao_social: string; data: ClientBIData }> | null {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = readSheetRows(ws);
    const h = findHeaderRow(rows, ["CLIENTE", "TIPO", "INDICADOR", "RESULTADO"], 5);
    if (!h) continue;
    const iCat = (rows[h.row] ?? []).findIndex((c) => normalize(c) === "CATEGORIA");
    type Acc = {
      cliente: string;
      categoria: string | null;
      geral: number | null;
      familias: FamiliaResultado[];
    };
    const groups = new Map<string, Acc>();
    for (let i = h.row + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const cli = str(r[h.idx["CLIENTE"]]);
      if (!cli) continue;
      let g = groups.get(cli);
      if (!g) {
        g = { cliente: cli, categoria: null, geral: null, familias: [] };
        groups.set(cli, g);
      }
      if (iCat >= 0 && !g.categoria) g.categoria = str(r[iCat]);
      const tipo = normalize(r[h.idx["TIPO"]]);
      const indicador = r[h.idx["INDICADOR"]];
      const resultado = num(r[h.idx["RESULTADO"]]);
      if (tipo === "GERAL") {
        if (g.geral == null) g.geral = resultado;
        continue;
      }
      if (tipo !== "FAMILIA") continue;
      const fam = normalizeFamilyName(indicador);
      if (!fam) continue;
      if (g.familias.some((x) => x.familia === fam)) continue;
      g.familias.push({
        familia: fam,
        atingimento: resultado,
        farol: statusToLabel(resultado),
      });
    }
    if (groups.size === 0) continue;
    const out: Array<{ razao_social: string; data: ClientBIData }> = [];
    for (const g of groups.values()) {
      const err = validateSevenFamilies(g.familias);
      if (err) throw new Error(clientBiErrorMessage(g.cliente, err));
      out.push({ razao_social: g.cliente, data: buildBI(g.categoria, g.geral, g.familias) });
    }
    if (out.length) return out;
  }
  return null;
}

// ============= 4) "Base" (BI de Desempenho legado) — long por CLIENTE/FAMÍLIA/COEFICIENTE =============

function parseBaseLong(
  wb: XLSX.WorkBook,
): Array<{ razao_social: string; data: ClientBIData }> | null {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = readSheetRows(ws);
    const h = findHeaderRow(rows, ["CLIENTE", "FAMILIA", "FAROL"], 10);
    if (!h) continue;
    const iCat = (rows[h.row] ?? []).findIndex((c) => normalize(c) === "CATEGORIA");
    const iMeta = (rows[h.row] ?? []).findIndex((c) => normalize(c) === "META");
    const iCoef = (rows[h.row] ?? []).findIndex(
      (c) => normalize(c) === "COEFICIENTE" || normalize(c).startsWith("INDICE PONDERADO"),
    );
    type Acc = {
      cliente: string;
      categoria: string | null;
      familias: FamiliaResultado[];
      totalMeta: number;
      totalPonderado: number;
    };
    const groups = new Map<string, Acc>();
    for (let i = h.row + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const cli = str(r[h.idx["CLIENTE"]]);
      const famRaw = r[h.idx["FAMILIA"]];
      if (!cli || famRaw == null) continue;
      const fam = normalizeFamilyName(famRaw);
      if (!fam) continue;
      let g = groups.get(cli);
      if (!g) {
        g = { cliente: cli, categoria: null, familias: [], totalMeta: 0, totalPonderado: 0 };
        groups.set(cli, g);
      }
      if (iCat >= 0 && !g.categoria) g.categoria = str(r[iCat]);
      if (g.familias.some((x) => x.familia === fam)) continue;
      const coef = iCoef >= 0 ? num(r[iCoef]) : null;
      const meta = iMeta >= 0 ? num(r[iMeta]) : null;
      g.familias.push({
        familia: fam,
        atingimento: coef,
        farol: statusToLabel(coef),
      });
      // agregado para atingimento geral ponderado por meta
      if (meta != null && coef != null && meta > 0) {
        g.totalMeta += meta;
        g.totalPonderado += meta * coef;
      }
    }
    if (groups.size === 0) continue;

    // participação por meta relativa
    const out: Array<{ razao_social: string; data: ClientBIData }> = [];
    for (const g of groups.values()) {
      const err = validateSevenFamilies(g.familias);
      if (err) throw new Error(clientBiErrorMessage(g.cliente, err));
      const geral = g.totalMeta > 0 ? g.totalPonderado / g.totalMeta : null;
      out.push({ razao_social: g.cliente, data: buildBI(g.categoria, geral, g.familias) });
    }
    if (out.length) return out;
  }
  return null;
}

// ============= Public API =============

export function parseClientBiWorkbook(buf: ArrayBuffer): Array<{
  razao_social: string;
  data: ClientBIData;
}> {
  const wb = XLSX.read(buf, { type: "array" });
  // 1) formato canônico "BI POR CLIENTE" (Índice + abas)
  const a = parseBiPorCliente(wb);
  if (a && a.length) return a;
  // 2) formato "Base" legado (long)
  const b = parseBaseLong(wb);
  if (b && b.length) return b;
  // 3) formatos de gráfico (aceitos para o mesmo BI)
  const c = parseGrafPorCliente(wb);
  if (c && c.length) return c;
  const d = parseDadosGraficoLong(wb);
  if (d && d.length) return d;
  throw new Error("Formato de planilha não reconhecido para BI por cliente.");
}

/**
 * `familias.itens` NUNCA é montado por lógica própria: é sempre derivado do BI
 * canônico (bi.familias), garantindo fonte única entre cards e gráfico.
 */
export function parseFamilyChartWorkbook(buf: ArrayBuffer): Array<{
  razao_social: string;
  data: ClientFamiliasData;
}> {
  const items = parseClientBiWorkbook(buf);
  return items.map((it) => ({ razao_social: it.razao_social, data: deriveFamiliasItens(it.data) }));
}


// ============= Backwards-compat exports =============
// (Mantém os nomes usados pelo ClientBIBatchUpload atual.)

export const parseClientBIWorkbookBatch = parseClientBiWorkbook;
export const parseClientFamiliasWorkbookBatch = parseFamilyChartWorkbook;

export function parseClientBIWorkbook(buf: ArrayBuffer): ClientBIData {
  const items = parseClientBiWorkbook(buf);
  if (!items.length) throw new Error("Nenhum cliente encontrado na planilha.");
  return items[0].data;
}
export function parseClientFamiliasWorkbook(buf: ArrayBuffer): ClientFamiliasData {
  const items = parseFamilyChartWorkbook(buf);
  if (!items.length) throw new Error("Nenhum cliente encontrado na planilha.");
  return items[0].data;
}
