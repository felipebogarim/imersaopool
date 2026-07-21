import * as XLSX from "xlsx";
import { FAROL_LABEL, FAROL_ORDER, statusFromPercent, type FarolStatus } from "./performance-farol";

// ============= Types =============

export type FamiliaResultado = {
  familia: string;
  atingimento: number | null; // decimal (0..>1) ou percent (0..>100) — sempre preservamos 0
  participacao?: number | null; // decimal 0..1
  farol: string | null;
};

export type ClientBIData = {
  geral: number | null; // decimal 0..>1
  categoria: string | null;
  familias: FamiliaResultado[];
  melhor_familia: { label: string | null; atingimento: number | null };
  pior_familia: { label: string | null; atingimento: number | null };
  distribuicao_farol: Array<{ grupo: string; quantidade: number }>;
};

export type ClientFamiliasData = { itens: FamiliaResultado[] };

// ============= Famílias canônicas =============

export const CANONICAL_FAMILIES = [
  "DECOR NEWLINE",
  "DECOR STUDIO",
  "SISTEMAS E MÓDULOS",
  "PRO LED",
  "PRO LAMP",
  "PERFIL",
  "FITAS E FONTES",
] as const;

const CANONICAL_ORDER: Record<string, number> = Object.fromEntries(
  CANONICAL_FAMILIES.map((f, i) => [f, i]),
);

const normalize = (s: unknown): string =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();

const CANONICAL_BY_NORM: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const f of CANONICAL_FAMILIES) m[normalize(f)] = f;
  // aliases
  m["SISTEMAS E MODULOS"] = "SISTEMAS E MÓDULOS";
  return m;
})();

export function normalizeFamilyName(v: unknown): string | null {
  const n = normalize(v);
  return CANONICAL_BY_NORM[n] ?? null;
}

export function isCanonicalFamily(v: unknown): boolean {
  return normalizeFamilyName(v) !== null;
}

const FAROL_BY_NORM: Record<string, FarolStatus> = (() => {
  const m: Record<string, FarolStatus> = {};
  for (const k of FAROL_ORDER) m[normalize(FAROL_LABEL[k])] = k;
  return m;
})();

export function normalizeTrafficLightGroup(v: unknown): string | null {
  const n = normalize(v);
  if (!n) return null;
  const k = FAROL_BY_NORM[n];
  return k ? FAROL_LABEL[k] : null;
}

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
    n === "POSICAO" ||
    n === "POSIÇÃO" ||
    n.startsWith("POSICAO") ||
    n.startsWith("TRES PIORES") ||
    n.startsWith("COEFICIENTES") ||
    n.startsWith("LEITURA DO GRAFICO") ||
    n.startsWith("MELHOR FAMILIA") ||
    n.startsWith("PIOR FAMILIA") ||
    n.startsWith("RESULTADO GERAL") // rodapé "LEITURA DO GRÁFICO" tem essa linha
  );
}

// ============= Cálculos =============

export function calculateBestFamily(fams: FamiliaResultado[]): FamiliaResultado | null {
  if (!fams.length) return null;
  return fams.slice().sort((a, b) => {
    const ar = a.atingimento ?? -Infinity;
    const br = b.atingimento ?? -Infinity;
    if (br !== ar) return br - ar;
    const ap = a.participacao ?? -Infinity;
    const bp = b.participacao ?? -Infinity;
    if (bp !== ap) return bp - ap;
    return (CANONICAL_ORDER[a.familia] ?? 99) - (CANONICAL_ORDER[b.familia] ?? 99);
  })[0];
}

export function calculateWorstFamily(fams: FamiliaResultado[]): FamiliaResultado | null {
  if (!fams.length) return null;
  return fams.slice().sort((a, b) => {
    const ar = a.atingimento ?? Infinity;
    const br = b.atingimento ?? Infinity;
    if (ar !== br) return ar - br;
    const ap = a.participacao ?? Infinity;
    const bp = b.participacao ?? Infinity;
    if (ap !== bp) return ap - bp;
    return (CANONICAL_ORDER[a.familia] ?? 99) - (CANONICAL_ORDER[b.familia] ?? 99);
  })[0];
}

export function calculateTrafficLightDistribution(
  fams: FamiliaResultado[],
): Array<{ grupo: string; quantidade: number }> {
  const counts = new Map<string, number>();
  for (const f of fams) {
    const g = normalizeTrafficLightGroup(f.farol);
    if (!g) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([grupo, quantidade]) => ({ grupo, quantidade }));
}

export function validateSevenFamilies(fams: FamiliaResultado[]): string | null {
  if (fams.length !== 7) return `Esperado 7 famílias, encontradas ${fams.length}.`;
  const seen = new Set<string>();
  for (const f of fams) {
    if (!isCanonicalFamily(f.familia)) return `Família desconhecida: ${f.familia}`;
    if (seen.has(f.familia)) return `Família duplicada: ${f.familia}`;
    seen.add(f.familia);
  }
  return null;
}

function buildBI(
  categoria: string | null,
  geral: number | null,
  familias: FamiliaResultado[],
): ClientBIData {
  const best = calculateBestFamily(familias);
  const worst = calculateWorstFamily(familias);
  return {
    geral,
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
        farol: normalizeTrafficLightGroup(r[h.idx["GRUPO DO FAROL"]]),
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
    if (err) {
      // eslint-disable-next-line no-console
      console.warn(`[BI] ${row.cliente} (${row.aba}): ${err}`);
      continue;
    }
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
    const iFarol = h.idx["GRUPO DO FAROL"];
    const iFarolCol =
      iFarol != null
        ? iFarol
        : (rows[h.row] ?? []).findIndex((c) => normalize(c) === "GRUPO DO FAROL");
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
        farol:
          iFarolCol >= 0 ? normalizeTrafficLightGroup(r[iFarolCol]) : statusToLabel(resultado),
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
  if (decimal == null) return null;
  const pct = Math.abs(decimal) <= 1.5 ? decimal * 100 : decimal;
  const st = statusFromPercent(pct);
  return st ? FAROL_LABEL[st] : null;
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
    if (err) {
      // eslint-disable-next-line no-console
      console.warn(`[Gráfico] ${row.cliente} (${row.aba}): ${err}`);
      continue;
    }
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
    const iFarol = (rows[h.row] ?? []).findIndex((c) => normalize(c) === "GRUPO DO FAROL");
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
        farol: iFarol >= 0 ? normalizeTrafficLightGroup(r[iFarol]) : statusToLabel(resultado),
      });
    }
    if (groups.size === 0) continue;
    const out: Array<{ razao_social: string; data: ClientBIData }> = [];
    for (const g of groups.values()) {
      const err = validateSevenFamilies(g.familias);
      if (err) {
        // eslint-disable-next-line no-console
        console.warn(`[Long] ${g.cliente}: ${err}`);
        continue;
      }
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
      const farolLabel = normalizeTrafficLightGroup(r[h.idx["FAROL"]]);
      g.familias.push({
        familia: fam,
        atingimento: coef,
        farol: farolLabel,
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
      if (err) {
        // eslint-disable-next-line no-console
        console.warn(`[Base] ${g.cliente}: ${err}`);
        continue;
      }
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

export function parseFamilyChartWorkbook(buf: ArrayBuffer): Array<{
  razao_social: string;
  data: ClientFamiliasData;
}> {
  const wb = XLSX.read(buf, { type: "array" });
  // 1) Gráficos de barras — Índice + abas
  const g = parseGrafPorCliente(wb);
  if (g && g.length) return g.map((it) => ({ razao_social: it.razao_social, data: { itens: it.data.familias } }));
  // 2) "Dados para gráfico" (long)
  const l = parseDadosGraficoLong(wb);
  if (l && l.length) return l.map((it) => ({ razao_social: it.razao_social, data: { itens: it.data.familias } }));
  // 3) BI canônico — reaproveita famílias
  const bi = parseBiPorCliente(wb);
  if (bi && bi.length) return bi.map((it) => ({ razao_social: it.razao_social, data: { itens: it.data.familias } }));
  const base = parseBaseLong(wb);
  if (base && base.length) return base.map((it) => ({ razao_social: it.razao_social, data: { itens: it.data.familias } }));
  throw new Error("Formato de planilha não reconhecido para resultado por família.");
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
