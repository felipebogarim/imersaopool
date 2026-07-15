// Exporta a matriz de performance para .xlsx preservando cores originais quando existem
// e recorrendo à paleta canônica do farol quando não.
import * as XLSXStyle from "xlsx-js-style";
import { FAROL_HEX, type FarolStatus } from "./performance-farol";

type ExportRow = {
  razao_social: string;
  categoria: string | null;
  metas: Record<string, number>;
  metas_status?: Record<string, FarolStatus>;
  metas_cores?: Record<string, string>;
  total_meta: number | null;
};

export function exportPerformanceXlsx(opts: {
  filename: string;
  representante: string;
  periodo: string;
  familias: string[];
  rows: ExportRow[];
  totals: { perFamilia: Record<string, number>; grand: number };
}) {
  const { filename, representante, periodo, familias, rows, totals } = opts;

  const aoa: any[][] = [
    [`Performance — ${representante}`],
    [`Período: ${periodo}`],
    [],
    ["Razão social", "Categoria", ...familias, "Meta total"],
  ];

  for (const r of rows) {
    aoa.push([
      r.razao_social,
      r.categoria ?? "",
      ...familias.map((f) => (r.metas[f] ?? null) as any),
      r.total_meta ?? null,
    ]);
  }
  aoa.push([
    "TOTAL",
    "",
    ...familias.map((f) => totals.perFamilia[f] ?? 0),
    totals.grand ?? 0,
  ]);

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);

  // Aplica cores nas células da matriz (linhas de dados = 5..5+rows.length-1)
  const dataStart = 4; // 0-indexed row do primeiro cliente
  rows.forEach((r, i) => {
    familias.forEach((f, j) => {
      const cellRef = XLSXStyle.utils.encode_cell({ r: dataStart + i, c: 2 + j });
      const cell = ws[cellRef];
      if (!cell) return;
      const hex =
        r.metas_cores?.[f] ??
        (r.metas_status?.[f] ? FAROL_HEX[r.metas_status[f]] : null);
      if (hex) {
        cell.s = {
          ...(cell.s ?? {}),
          fill: { patternType: "solid", fgColor: { rgb: hex.replace(/^#/, "") } },
          alignment: { horizontal: "right" },
          numFmt: '"R$" #,##0',
        };
      } else if (typeof cell.v === "number") {
        cell.s = { ...(cell.s ?? {}), alignment: { horizontal: "right" }, numFmt: '"R$" #,##0' };
      }
    });
    // Total meta
    const tRef = XLSXStyle.utils.encode_cell({ r: dataStart + i, c: 2 + familias.length });
    if (ws[tRef]) {
      ws[tRef].s = { font: { bold: true }, alignment: { horizontal: "right" }, numFmt: '"R$" #,##0' };
    }
  });

  // Cabeçalho
  const headerRow = 3;
  for (let c = 0; c < 2 + familias.length + 1; c++) {
    const ref = XLSXStyle.utils.encode_cell({ r: headerRow, c });
    if (ws[ref])
      ws[ref].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "1F2937" } },
        alignment: { horizontal: c < 2 ? "left" : "right" },
      };
  }

  // Totais row
  const totalsRow = dataStart + rows.length;
  for (let c = 0; c < 2 + familias.length + 1; c++) {
    const ref = XLSXStyle.utils.encode_cell({ r: totalsRow, c });
    if (ws[ref])
      ws[ref].s = {
        font: { bold: true },
        fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
        alignment: { horizontal: c < 2 ? "left" : "right" },
        numFmt: c >= 2 ? '"R$" #,##0' : undefined,
      };
  }

  ws["!cols"] = [
    { wch: 34 },
    { wch: 12 },
    ...familias.map(() => ({ wch: 16 })),
    { wch: 16 },
  ];

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, "Performance");
  XLSXStyle.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
