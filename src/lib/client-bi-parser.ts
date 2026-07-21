import * as XLSX from "xlsx";
import { statusFromPercent, FAROL_LABEL, type FarolStatus } from "./performance-farol";

// ============= Types =============

export type FamiliaResultado = {
  familia: string;
  atingimento: number | null; // fração 0..>1
  farol: string | null; // "Ótimo" | "Sem compra" | ...
};

export type ClientBIData = {
  geral: number | null;
  categoria: string | null;
  familias: FamiliaResultado[];
  // derivados
  melhor_familia: { label: string | null; atingimento: number | null };
  pior_familia: { label: string | null; atingimento: number | null };
  distribuicao_farol: Array<{ grupo: string; quantidade: number }>;
};

export type ClientFamiliasData = {
  itens: FamiliaResultado[];
};

// ============= Helpers =============

const num = (v: any): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace("%", "").replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const str = (v: any): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

function farolFromAtingimento(a: number | null): string | null {
  if (a == null) return null;
  const pct = Math.abs(a) <= 1.5 ? a * 100 : a;
  const st = statusFromPercent(pct);
  return st ? FAROL_LABEL[st as FarolStatus] : null;
}

function buildBIData(
  categoria: string | null,
  geral: number | null,
  familias: FamiliaResultado[],
): ClientBIData {
  const withF = familias.map((f) => ({ ...f, farol: f.farol ?? farolFromAtingimento(f.atingimento) }));
  const sorted = withF.slice().sort((a, b) => (a.atingimento ?? -1) - (b.atingimento ?? -1));
  const melhor = sorted[sorted.length - 1];
  const pior = sorted[0];
  const counts = new Map<string, number>();
  for (const f of withF) if (f.farol) counts.set(f.farol, (counts.get(f.farol) ?? 0) + 1);
  const distribuicao_farol = Array.from(counts.entries()).map(([grupo, quantidade]) => ({
    grupo,
    quantidade,
  }));
  return {
    geral,
    categoria,
    familias: withF,
    melhor_familia: melhor
      ? { label: melhor.familia, atingimento: melhor.atingimento }
      : { label: null, atingimento: null },
    pior_familia: pior
      ? { label: pior.familia, atingimento: pior.atingimento }
      : { label: null, atingimento: null },
    distribuicao_farol,
  };
}

// ============= Long-format sheet (Dados para gráfico) =============
// Header: ID CLIENTE | CLIENTE | CATEGORIA | ORDEM | TIPO | INDICADOR | RESULTADO | GRUPO DO FAROL

type LongIdx = {
  cli: number;
  cat: number;
  tipo: number;
  ind: number;
  res: number;
  farol: number;
};

function findLongHeader(rows: any[][]): { headerIdx: number; idx: LongIdx } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = (rows[i] ?? []).map((c) => (c == null ? "" : normalize(String(c))));
    const cli = cells.findIndex((c) => c === "CLIENTE" || c === "RAZAO SOCIAL");
    const tipo = cells.findIndex((c) => c === "TIPO");
    const ind = cells.findIndex((c) => c.includes("INDICADOR") || c.includes("FAMILIA"));
    const res = cells.findIndex((c) => c.includes("RESULTADO") || c.includes("ATING"));
    if (cli >= 0 && tipo >= 0 && ind >= 0 && res >= 0) {
      return {
        headerIdx: i,
        idx: {
          cli,
          cat: cells.findIndex((c) => c === "CATEGORIA"),
          tipo,
          ind,
          res,
          farol: cells.findIndex((c) => c.includes("FAROL")),
        },
      };
    }
  }
  return null;
}

type LongGrouped = Map<string, { categoria: string | null; geral: number | null; familias: FamiliaResultado[] }>;

function readLongRows(rows: any[][], header: { headerIdx: number; idx: LongIdx }): LongGrouped {
  const { headerIdx, idx } = header;
  const groups: LongGrouped = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const cli = str(r[idx.cli]);
    if (!cli) continue;
    let g = groups.get(cli);
    if (!g) {
      g = { categoria: null, geral: null, familias: [] };
      groups.set(cli, g);
    }
    if (idx.cat >= 0 && !g.categoria) g.categoria = str(r[idx.cat]);
    const tipo = normalize(String(r[idx.tipo] ?? ""));
    const indicador = str(r[idx.ind]);
    const resultado = num(r[idx.res]);
    const farol = idx.farol >= 0 ? str(r[idx.farol]) : null;
    if (tipo.startsWith("GERAL") || (indicador && normalize(indicador).includes("RESULTADO GERAL"))) {
      g.geral = resultado ?? g.geral;
      continue;
    }
    if (!indicador) continue;
    g.familias.push({ familia: indicador, atingimento: resultado, farol });
  }
  return groups;
}

// ============= Per-sheet parser (Graficos_Barras layout) =============
// Cada aba tem:
//   linha 1: "RESULTADO GERAL E POR FAMÍLIA — <CLIENTE>"
//   linha 2: "Período: ... · Categoria: <cat>"
//   linha 4 (approx): ORDEM | TIPO | INDICADOR | RESULTADO | GRUPO DO FAROL

function parsePerClientSheet(ws: any, fallbackName: string): {
  razao_social: string;
  data: ClientBIData;
} | null {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: null });
  if (!rows.length) return null;

  // Título — aceita separadores "—", "–", "-" e "·"
  let cliente: string | null = null;
  for (let i = 0; i < Math.min(rows.length, 4); i++) {
    const t = str(rows[i]?.[0]);
    if (!t) continue;
    const up = t.toUpperCase();
    if (!(up.includes("RESULTADO") || up.includes("FAMÍLIA") || up.includes("FAMILIA") || up.includes("INDICADORES"))) continue;
    // Pega o último segmento após qualquer separador
    const parts = t.split(/\s*[—–\-·]\s*/);
    if (parts.length >= 2) {
      cliente = parts[parts.length - 1].trim();
      break;
    }
  }
  // Categoria
  let categoria: string | null = null;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const t = str(rows[i]?.[0]);
    if (t && /Categoria\s*:/i.test(t)) {
      const m = t.match(/Categoria\s*:\s*([^·|]+)/i);
      if (m) categoria = m[1].trim();
    }
  }

  // Header — aceita variações:
  //   ORDEM | TIPO | INDICADOR | RESULTADO | GRUPO DO FAROL
  //   FAMÍLIA | RESULTADO | PARTICIPAÇÃO | GRUPO DO FAROL
  let headerIdx = -1;
  let iTipo = -1;
  let iInd = -1;
  let iRes = -1;
  let iFarol = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = (rows[i] ?? []).map((c) => (c == null ? "" : normalize(String(c))));
    const ind = cells.findIndex((c) => c.includes("INDICADOR") || c === "FAMILIA" || c.startsWith("FAMILIA"));
    const res = cells.findIndex((c) => c === "RESULTADO" || c.includes("ATING"));
    if (ind >= 0 && res >= 0) {
      headerIdx = i;
      iTipo = cells.indexOf("TIPO");
      iInd = ind;
      iRes = res;
      iFarol = cells.findIndex((c) => c.includes("FAROL"));
      break;
    }
  }
  if (headerIdx < 0) return null;

  let geral: number | null = null;
  const familias: FamiliaResultado[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const tipo = iTipo >= 0 ? normalize(String(r[iTipo] ?? "")) : "";
    const indicador = str(r[iInd]);
    const resultado = num(r[iRes]);
    const farol = iFarol >= 0 ? str(r[iFarol]) : null;
    if (!indicador && resultado == null) continue;
    if (tipo.startsWith("GERAL") || (indicador && normalize(indicador).includes("RESULTADO GERAL"))) {
      geral = resultado ?? geral;
      continue;
    }
    if (!indicador) continue;
    if (normalize(indicador).startsWith("LEITURA")) break;
    familias.push({ familia: indicador, atingimento: resultado, farol });
  }
  if (!familias.length && geral == null) return null;
  return {
    razao_social: (cliente ?? fallbackName).trim(),
    data: buildBIData(categoria, geral, familias),
  };
}

// ============= Public API — single-file parsers =============

export function parseClientBIWorkbook(buf: ArrayBuffer): ClientBIData {
  const items = parseClientBIWorkbookBatch(buf);
  if (!items.length) throw new Error("Nenhum cliente encontrado na planilha.");
  return items[0].data;
}

export function parseClientFamiliasWorkbook(buf: ArrayBuffer): ClientFamiliasData {
  const items = parseClientFamiliasWorkbookBatch(buf);
  if (!items.length) throw new Error("Nenhum cliente encontrado na planilha.");
  return items[0].data;
}

// ============= Batch parsers =============

function tryLongWorkbook(buf: ArrayBuffer): LongGrouped | null {
  const wb = XLSX.read(buf, { type: "array" });
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: null });
    const header = findLongHeader(rows);
    if (header) {
      const g = readLongRows(rows, header);
      if (g.size > 0) return g;
    }
  }
  return null;
}

function tryBaseWorkbook(buf: ArrayBuffer): Array<{ razao_social: string; data: ClientBIData }> | null {
  const wb = XLSX.read(buf, { type: "array" });
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: null });
    // Header esperado: CLIENTE | CATEGORIA | FAMÍLIA | META | FAROL | COEFICIENTE | ÍNDICE PONDERADO
    let headerIdx = -1;
    let iCli = -1, iCat = -1, iFam = -1, iFarol = -1, iCoef = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const cells = (rows[i] ?? []).map((c) => (c == null ? "" : normalize(String(c))));
      const cli = cells.findIndex((c) => c === "CLIENTE" || c === "RAZAO SOCIAL");
      const fam = cells.findIndex((c) => c.includes("FAMILIA"));
      const farol = cells.findIndex((c) => c.includes("FAROL"));
      if (cli >= 0 && fam >= 0 && farol >= 0) {
        headerIdx = i;
        iCli = cli;
        iCat = cells.findIndex((c) => c === "CATEGORIA");
        iFam = fam;
        iFarol = farol;
        iCoef = cells.findIndex((c) => c === "COEFICIENTE" || c.includes("INDICE PONDERADO"));
        break;
      }
    }
    if (headerIdx < 0) continue;

    const groups = new Map<string, { categoria: string | null; familias: FamiliaResultado[] }>();
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const cli = str(r[iCli]);
      const fam = str(r[iFam]);
      if (!cli || !fam) continue;
      let g = groups.get(cli);
      if (!g) { g = { categoria: null, familias: [] }; groups.set(cli, g); }
      if (iCat >= 0 && !g.categoria) g.categoria = str(r[iCat]);
      const farol = iFarol >= 0 ? str(r[iFarol]) : null;
      const coef = iCoef >= 0 ? num(r[iCoef]) : null;
      g.familias.push({ familia: fam, atingimento: coef, farol });
    }
    if (groups.size > 0) {
      return Array.from(groups.entries()).map(([cli, g]) => ({
        razao_social: cli,
        data: buildBIData(g.categoria, null, g.familias),
      }));
    }
  }
  return null;
}

export function parseClientBIWorkbookBatch(
  buf: ArrayBuffer,
): Array<{ razao_social: string; data: ClientBIData }> {
  // 1) Formato "Dados para gráfico" (long)
  const long = tryLongWorkbook(buf);
  if (long) {
    return Array.from(long.entries()).map(([cli, g]) => ({
      razao_social: cli,
      data: buildBIData(g.categoria, g.geral, g.familias),
    }));
  }

  // 2) Formato "BI de Desempenho" — aba Base com CLIENTE/FAMÍLIA/FAROL/COEFICIENTE
  const base = tryBaseWorkbook(buf);
  if (base && base.length) return base;

  // 3) Formato "Graficos_Barras" — uma aba por cliente
  const wb = XLSX.read(buf, { type: "array" });
  const out: Array<{ razao_social: string; data: ClientBIData }> = [];
  for (const name of wb.SheetNames) {
    if (normalize(name).startsWith("INDICE") || normalize(name) === "ÍNDICE") continue;
    const parsed = parsePerClientSheet(wb.Sheets[name], name);
    if (parsed) out.push(parsed);
  }
  if (!out.length) throw new Error("Formato de planilha não reconhecido.");
  return out;
}

export function parseClientFamiliasWorkbookBatch(
  buf: ArrayBuffer,
): Array<{ razao_social: string; data: ClientFamiliasData }> {
  // Reusa o parser de BI e projeta apenas as famílias (o gráfico usa os mesmos dados)
  const items = parseClientBIWorkbookBatch(buf);
  return items.map(({ razao_social, data }) => ({
    razao_social,
    data: { itens: data.familias },
  }));
}
