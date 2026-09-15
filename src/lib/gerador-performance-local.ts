// Leitura determinística das planilhas no Gerador de Performance.
// A família é identificada pelo NOME do cabeçalho (nunca pela posição da coluna),
// o valor numérico da célula tem prioridade absoluta e a cor só é usada em
// arquivos antigos sem número. Quando nada pode ser interpretado, o resultado
// fica ausente (null) — nunca 0%.

import { listPerformanceSheetNames, parseWorkbook, type ParsedSheet } from "./performance-parser";
import type { GeneratedPerformance, GeneratedRow } from "./generate-performance.functions";

const keyOf = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

async function parseAllSheets(file: File): Promise<ParsedSheet[]> {
  const buf = await file.arrayBuffer();
  let names: string[] = [];
  try {
    names = listPerformanceSheetNames(buf);
  } catch {
    names = [];
  }
  const out: ParsedSheet[] = [];
  if (!names.length) {
    out.push(await parseWorkbook(buf));
    return out;
  }
  for (const sheetName of names) {
    try {
      out.push(await parseWorkbook(buf, { sheetName }));
    } catch {
      /* aba sem estrutura reconhecível é ignorada */
    }
  }
  return out;
}

/**
 * Converte uma ou mais planilhas no formato canônico do Gerador.
 * Retorna null quando nenhuma estrutura confiável foi reconhecida
 * (nesse caso o chamador pode recorrer à leitura assistida por IA).
 */
export async function buildPerformanceFromWorkbooks(files: File[]): Promise<GeneratedPerformance | null> {
  const sheets: ParsedSheet[] = [];
  for (const file of files) {
    try {
      sheets.push(...(await parseAllSheets(file)));
    } catch {
      /* arquivo não reconhecido pelo leitor determinístico */
    }
  }
  const usable = sheets.filter((s) => s.rows.length > 0 && s.familias.length > 0);
  if (!usable.length) return null;

  const familias: string[] = [];
  for (const sheet of usable) {
    for (const fam of sheet.familias) if (!familias.includes(fam)) familias.push(fam);
  }

  const byClient = new Map<string, GeneratedRow>();
  const matrix: Record<string, Record<string, number>> = {};

  for (const sheet of usable) {
    for (const row of sheet.rows) {
      const k = keyOf(row.razao_social);
      let out = byClient.get(k);
      if (!out) {
        out = {
          razao_social: row.razao_social,
          categoria: row.categoria ?? null,
          total_meta: null,
          total_pct: null,
          total_pct_status: null,
          metas: {},
          realizado: {},
          media: {},
          familia_pct: {},
          metas_status: {},
        };
        byClient.set(k, out);
      }
      if (!out.categoria && row.categoria) out.categoria = row.categoria;
      for (const fam of familias) {
        const meta = row.metas?.[fam];
        if (typeof meta === "number") out.metas[fam] = meta;
        const real = row.realizado?.[fam];
        if (typeof real === "number") out.realizado[fam] = real;
        const med = row.media?.[fam];
        if (typeof med === "number") out.media[fam] = med;
        const pct = row.familia_pct?.[fam];
        if (typeof pct === "number") out.familia_pct[fam] = pct;
        const st = row.metas_status?.[fam];
        if (st) out.metas_status[fam] = st;
      }
      if (row.total_meta != null) out.total_meta = row.total_meta;
      if (row.total_pct != null) out.total_pct = row.total_pct;
      if (row.total_pct_status) out.total_pct_status = row.total_pct_status;

      const cat = row.categoria?.trim();
      if (cat) {
        const bucket = (matrix[cat] ??= {});
        for (const fam of familias) {
          const meta = row.metas?.[fam];
          if (typeof meta === "number" && (bucket[fam] == null || meta > bucket[fam])) bucket[fam] = meta;
        }
      }
    }
  }

  const categoria_metas: GeneratedPerformance["categoria_metas"] = {};
  for (const [cat, fams] of Object.entries(matrix)) {
    categoria_metas[cat] = Object.values(fams).reduce((a, b) => a + b, 0);
  }
  if (Object.keys(matrix).length) {
    (categoria_metas as Record<string, unknown>)["__family_metas_by_category__"] = matrix;
  }

  return {
    familias,
    categoria_metas,
    rows: Array.from(byClient.values()),
    observacoes:
      "Leitura determinística da planilha: famílias reconhecidas pelo nome do cabeçalho, números com prioridade sobre cores e células não interpretáveis mantidas como ausentes.",
  };
}
