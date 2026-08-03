// Parser da planilha comparativa (layout largo): um bloco de identificação
// do produto base e, na sequência, blocos de 16 atributos por marca,
// seguidos da coluna de preço "MARCA (R$)" e das referências.
//
// Preserva sempre o valor original de cada célula.

import * as XLSX from "xlsx";
import {
  FITA_ATTRIBUTES,
  buildSpec,
  normalizeText,
  parseNumeric,
  type SpecValue,
} from "./price-comparativos-core";

export type ParsedProduct = {
  marca: string;
  isBase: boolean;
  sku: string | null;
  referencia: string | null;
  nome: string;
  descricao: string | null;
  specs: Record<string, SpecValue>;
  preco: number | null;
  precoOriginal: string | null;
  equivalenciaTexto: string | null;
  diferencasTexto: string | null;
  linha: number;
};

export type ParsedRow = {
  linha: number;
  base: ParsedProduct;
  concorrentes: ParsedProduct[];
};

export type ParseResult = {
  sheetName: string;
  marcaBase: string;
  marcasConcorrentes: string[];
  linhas: ParsedRow[];
  ignoradas: number;
  avisos: string[];
};

type Bloco = {
  brand: string;
  attrStart: number;
  precoCol: number | null;
  refCol: number | null;
  equivCol: number | null;
  difCol: number | null;
};

const TECNOLOGIA_HEADER = /^TECNOLOGIA/;

function cell(row: unknown[], idx: number | null): string | null {
  if (idx == null) return null;
  const v = row[idx];
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Descobre a linha de cabeçalho (a que contém "SKU" e "Tecnologia"). */
function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i].map((c) => normalizeText(c));
    if (r.some((c) => c === "SKU") && r.some((c) => TECNOLOGIA_HEADER.test(c))) return i;
  }
  return 0;
}

function detectBlocos(header: string[]): Bloco[] {
  const starts: number[] = [];
  header.forEach((h, i) => {
    if (TECNOLOGIA_HEADER.test(h)) starts.push(i);
  });

  const blocos: Bloco[] = [];
  starts.forEach((start, idx) => {
    const attrEnd = start + FITA_ATTRIBUTES.length; // primeira coluna do "rabicho"
    const nextStart = starts[idx + 1] ?? header.length;
    let brand = "";
    let precoCol: number | null = null;
    let refCol: number | null = null;
    let equivCol: number | null = null;
    let difCol: number | null = null;

    for (let c = attrEnd; c < nextStart; c++) {
      const h = header[c] ?? "";
      if (!h) continue;
      if (/\(R\$\)/.test(h)) {
        precoCol = c;
        brand = h.replace(/\(R\$\)/, "").trim();
      } else if (/^REF\b/.test(h) && refCol == null) {
        refCol = c;
        if (!brand) brand = h.replace(/^REF\.?\s*/, "").replace(/\(.*\)/, "").trim();
      } else if (/EQUIVALENCIA/.test(h)) equivCol = c;
      else if (/DIFEREN/.test(h)) difCol = c;
    }

    if (!brand) brand = `MARCA ${idx + 1}`;
    blocos.push({ brand, attrStart: start, precoCol, refCol, equivCol, difCol });
  });

  return blocos;
}

function buildProduct(
  row: unknown[],
  bloco: Bloco,
  isBase: boolean,
  baseSku: string | null,
  baseDesc: string | null,
  linha: number,
): ParsedProduct | null {
  const specs: Record<string, SpecValue> = {};
  let preenchidos = 0;
  FITA_ATTRIBUTES.forEach((attr, i) => {
    const spec = buildSpec(attr.key, row[bloco.attrStart + i], "excel", attr.unit);
    if (spec) {
      specs[attr.key] = spec;
      preenchidos += 1;
    }
  });

  const referencia = cell(row, bloco.refCol);
  const precoOriginal = cell(row, bloco.precoCol);
  const preco = parseNumeric(precoOriginal);

  if (!isBase && preenchidos === 0 && !referencia && preco == null) return null;

  const nome = isBase
    ? (baseDesc ?? baseSku ?? "Produto sem descrição")
    : `${bloco.brand} ${referencia ?? baseSku ?? ""}`.trim();

  return {
    marca: bloco.brand,
    isBase,
    sku: isBase ? baseSku : (referencia ?? null),
    referencia,
    nome,
    descricao: isBase ? baseDesc : (baseDesc ? `Equivalente a: ${baseDesc}` : null),
    specs,
    preco,
    precoOriginal,
    equivalenciaTexto: cell(row, bloco.equivCol),
    diferencasTexto: cell(row, bloco.difCol),
    linha,
  };
}

export function parseComparativoWorkbook(buffer: ArrayBuffer, sheet?: string): ParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = sheet && wb.SheetNames.includes(sheet) ? sheet : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });

  const avisos: string[] = [];
  const headerIdx = findHeaderRow(rows);
  const header = (rows[headerIdx] ?? []).map((c) => normalizeText(c));

  const skuCol = header.findIndex((h) => h === "SKU");
  const descCol = header.findIndex((h) => /^DESCRICAO/.test(h));
  const blocos = detectBlocos(header);

  if (!blocos.length) {
    throw new Error(
      'Não foi possível identificar os blocos de marcas. Verifique se a planilha possui as colunas "Tecnologia", "TENSÃO", "POTÊNCIA / M" etc.',
    );
  }

  const baseBloco = blocos[0];
  const concorrentesBlocos = blocos.slice(1);

  const linhas: ParsedRow[] = [];
  let ignoradas = 0;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const baseSku = skuCol >= 0 ? cell(row, skuCol) : null;
    const baseDesc = descCol >= 0 ? cell(row, descCol) : null;
    if (!baseSku && !baseDesc) {
      ignoradas += 1;
      continue;
    }
    const base = buildProduct(row, baseBloco, true, baseSku, baseDesc, r + 1);
    if (!base) {
      ignoradas += 1;
      continue;
    }
    const concorrentes = concorrentesBlocos
      .map((b) => buildProduct(row, b, false, baseSku, baseDesc, r + 1))
      .filter((p): p is ParsedProduct => p != null);

    linhas.push({ linha: r + 1, base, concorrentes });
  }

  if (!linhas.length) avisos.push("Nenhuma linha de produto foi identificada na planilha.");

  return {
    sheetName,
    marcaBase: baseBloco.brand,
    marcasConcorrentes: concorrentesBlocos.map((b) => b.brand),
    linhas,
    ignoradas,
    avisos,
  };
}

export function listSheetNames(buffer: ArrayBuffer): string[] {
  return XLSX.read(buffer, { type: "array", bookSheets: true }).SheetNames;
}
