// Leitura genérica de planilha/PDF para o "Quadro de valores" (gestor master).
// Diferente do fluxo de Performance, aqui os valores originais são exibidos
// exatamente como na origem — apenas o farol de cor é derivado dos percentuais.

import { statusFromFaixa, statusFromPercent, type FarolStatus } from "./performance-farol";

export type QuadroCell = {
  /** Texto exibido, exatamente como lido (formatado quando numérico). */
  texto: string;
  /** Valor numérico bruto, quando aplicável. */
  numero: number | null;
  /** Percentual detectado (0–∞), quando a célula representa atingimento. */
  pct: number | null;
  status: FarolStatus | null;
};

export type QuadroTabela = {
  nome: string;
  header: string[];
  rows: QuadroCell[][];
};

export type QuadroDoc = {
  origem: string;
  tabelas: QuadroTabela[];
};

const isBlank = (v: unknown) => v == null || String(v).trim() === "";

const fmtNumber = (n: number) =>
  Math.abs(n) >= 1000 || Number.isInteger(n)
    ? n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
    : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Converte um valor bruto de célula em QuadroCell (texto original + farol). */
export function toCell(raw: unknown): QuadroCell {
  if (isBlank(raw)) return { texto: "", numero: null, pct: null, status: null };

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { texto: fmtNumber(raw), numero: raw, pct: null, status: null };
  }

  const s = String(raw).trim();

  // percentual explícito: "87%", "1.234,5%"
  const pm = s.match(/^-?[\d.,]+\s*%$/);
  if (pm) {
    const n = parseFloat(s.replace(/[%\s]/g, "").replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) {
      return { texto: s, numero: n, pct: n, status: statusFromPercent(n) };
    }
  }

  // faixas textuais da planilha de performance ("<50", "70-89", ">100")
  const faixa = statusFromFaixa(s);
  if (faixa) return { texto: s, numero: null, pct: null, status: faixa };

  // número em formato pt-BR / moeda
  const cleaned = s.replace(/[R$\s\u00a0]/gi, "");
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned) || /^-?\d+([.,]\d+)?$/.test(cleaned)) {
    const n = parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) return { texto: s, numero: n, pct: null, status: null };
  }

  return { texto: s, numero: null, pct: null, status: null };
}

/** Marca farol nas colunas cujo cabeçalho indica percentual/atingimento. */
function applyHeaderPercent(header: string[], rows: QuadroCell[][]) {
  const pctCols = header.map(h => /%|percent|atingim|meta/i.test(h));
  for (const row of rows) {
    row.forEach((c, i) => {
      if (!pctCols[i] || c.status || c.numero == null) return;
      const pct = c.numero > 0 && c.numero <= 1.5 ? c.numero * 100 : c.numero;
      c.pct = pct;
      c.status = statusFromPercent(pct);
    });
  }
}

export function gridToTabela(nome: string, grid: unknown[][]): QuadroTabela | null {
  const rowsRaw = grid.filter(r => (r ?? []).some(c => !isBlank(c)));
  if (rowsRaw.length < 2) return null;

  const headerIdx = rowsRaw.findIndex(r => r.filter(c => !isBlank(c)).length >= 2);
  const headerRow = rowsRaw[headerIdx] ?? [];
  const width = Math.max(...rowsRaw.map(r => r.length));
  const header = Array.from({ length: width }, (_, i) => String(headerRow[i] ?? "").trim());

  const rows = rowsRaw
    .slice(headerIdx + 1)
    .map(r => Array.from({ length: width }, (_, i) => toCell(r[i])))
    .filter(r => r.some(c => c.texto !== ""));

  if (!rows.length) return null;
  applyHeaderPercent(header, rows);
  return { nome, header, rows };
}

/** Lê um arquivo .xlsx/.xls/.csv e devolve uma tabela por aba. */
export async function parseQuadroFromExcel(file: File): Promise<QuadroDoc> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const tabelas: QuadroTabela[] = [];
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      blankrows: false,
      raw: true,
    });
    const t = gridToTabela(name, grid as unknown[][]);
    if (t) tabelas.push(t);
  }
  return { origem: file.name, tabelas };
}

/** Leitura best-effort de PDF: cada página vira uma tabela por posição de coluna. */
export async function parseQuadroFromPdf(file: File): Promise<QuadroDoc> {
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;

  const tabelas: QuadroTabela[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // agrupa itens por linha (coordenada Y arredondada)
    const linhas = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as any[]) {
      const str = String(it.str ?? "").trim();
      if (!str) continue;
      const y = Math.round(it.transform[5] / 4) * 4;
      const arr = linhas.get(y) ?? [];
      arr.push({ x: it.transform[4], s: str });
      linhas.set(y, arr);
    }
    const grid = Array.from(linhas.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.s));
    const t = gridToTabela(`Página ${p}`, grid);
    if (t) tabelas.push(t);
  }
  return { origem: file.name, tabelas };
}

export async function parseQuadroFile(file: File): Promise<QuadroDoc> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return parseQuadroFromPdf(file);
  if (["xlsx", "xls", "xlsm", "csv"].includes(ext)) return parseQuadroFromExcel(file);
  throw new Error("Formato não suportado. Envie .xlsx, .xls, .csv ou .pdf.");
}
