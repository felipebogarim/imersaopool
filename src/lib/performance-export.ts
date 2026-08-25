// Exporta a matriz de performance para .xlsx no MESMO padrão visual do painel
// de Performance (mesma ordem de colunas, mesmo cabeçalho sólido, mesmas
// linhas de rodapé Total / Participação / Atingimento e mesma paleta do farol).
import * as XLSXStyle from "xlsx-js-style";
import { FAROL_HEX, FAROL_FAIXA_TEXT, type FarolStatus } from "./performance-farol";

type ExportRow = {
  razao_social: string;
  categoria: string | null;
  metas: Record<string, number>;
  metas_status?: Record<string, FarolStatus>;
  metas_cores?: Record<string, string>;
  realizado?: Record<string, number> | null;
  familia_pct?: Record<string, number> | null;
  total_meta: number | null;
  total_pct?: number | null;
  total_pct_status?: FarolStatus | null;
};

/** Percentual armazenado em ratio (1 = 100%) → número em %. */
const pctOf = (v: unknown): number | null => {
  const n = Number(v);
  if (v == null || Number.isNaN(n)) return null;
  return n * 100;
};

const fmtPctCell = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;


const HEX = {
  headerBg: "1F2937",
  headerFg: "FFFFFF",
  totalBg: "E5E7EB",
  participacaoBg: "E0F2FE",
  atingimentoBg: "FEF3C7",
  totalMetaCol: "F3F4F6",
  border: "D1D5DB",
};

const border = {
  top: { style: "thin", color: { rgb: HEX.border } },
  bottom: { style: "thin", color: { rgb: HEX.border } },
  left: { style: "thin", color: { rgb: HEX.border } },
  right: { style: "thin", color: { rgb: HEX.border } },
} as const;

export function exportPerformanceXlsx(opts: {
  filename: string;
  representante: string;
  periodo: string;
  familias: string[];
  rows: ExportRow[];
  totals: { perFamilia: Record<string, number>; grand: number };
  participacao?: { __total__: number | null } & Record<string, number | null>;
  atingimento?: { __total__: number | null } & Record<string, number | null>;
}) {
  const { filename, representante, periodo, familias, rows, totals } = opts;

  // Ordem canônica: Razão social | Categoria | Total meta | Total % | famílias...
  const header = ["Razão social", "Categoria", "Total meta", "Total %", ...familias];
  const nCols = header.length;

  const aoa: any[][] = [
    [`Performance — ${representante}`],
    [`Período: ${periodo}`],
    [],
    header,
  ];

  for (const r of rows) {
    const somaMetas = familias.reduce((s, f) => s + (Number(r.metas?.[f]) || 0), 0);
    const totalMeta = Number(r.total_meta) || somaMetas || null;
    const totalPct = pctOf(r.total_pct);
    aoa.push([
      r.razao_social,
      r.categoria ?? "",
      totalMeta,
      totalPct != null
        ? fmtPctCell(totalPct)
        : r.total_pct_status
          ? FAROL_FAIXA_TEXT[r.total_pct_status]
          : "",
      ...familias.map((f) => {
        // Espelha exatamente o que o painel mostra na célula:
        // valor monetário quando existe meta, senão percentual, senão faixa do farol.
        const meta = Number(r.metas?.[f]) || 0;
        const real = Number(r.realizado?.[f]) || 0;
        const pct = meta > 0 && real > 0 ? (real / meta) * 100 : pctOf(r.familia_pct?.[f]);
        if (meta > 0 && real === 0) return meta as any;
        if (pct != null) return fmtPctCell(pct) as any;
        const st = r.metas_status?.[f];
        return st ? (FAROL_FAIXA_TEXT[st] as any) : (null as any);
      }),
    ]);
  }


  // Rodapé — 3 linhas fixas
  const totalRow: any[] = [
    "TOTAL GERAL DA META",
    "",
    totals.grand || "",
    "",
    ...familias.map((f) => totals.perFamilia[f] || ""),
  ];

  const fmtPct = (n: number | null | undefined) => {
    if (n == null || Number.isNaN(n)) return "";
    const v = Math.abs(n) <= 1.5 ? n * 100 : n;
    return `${v.toFixed(1).replace(".", ",")}%`;
  };
  const participacaoRow: any[] = [
    "PARTICIPAÇÃO ESTIMADA NA VENDA",
    "",
    "",
    fmtPct(opts.participacao?.__total__ ?? null),
    ...familias.map((f) => fmtPct((opts.participacao?.[f] as number | null | undefined) ?? null)),
  ];
  const atingimentoRow: any[] = [
    "ATINGIMENTO ESTIMADO DA META",
    "",
    "",
    fmtPct(opts.atingimento?.__total__ ?? null),
    ...familias.map((f) => fmtPct((opts.atingimento?.[f] as number | null | undefined) ?? null)),
  ];
  aoa.push(totalRow, participacaoRow, atingimentoRow);

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);

  const headerRowIdx = 3; // 0-indexed
  const dataStart = 4;
  const totalRowIdx = dataStart + rows.length;
  const participacaoRowIdx = totalRowIdx + 1;
  const atingimentoRowIdx = totalRowIdx + 2;

  // Cabeçalho — SEM transparência
  for (let c = 0; c < nCols; c++) {
    const ref = XLSXStyle.utils.encode_cell({ r: headerRowIdx, c });
    if (!ws[ref]) ws[ref] = { t: "s", v: header[c] };
    ws[ref].s = {
      font: { bold: true, color: { rgb: HEX.headerFg }, sz: 11 },
      fill: { patternType: "solid", fgColor: { rgb: HEX.headerBg } },
      alignment: {
        horizontal: c === 0 || c === 1 ? "left" : c === 2 ? "right" : "center",
        vertical: "center",
      },
      border,
    };
  }

  // Linhas de clientes
  rows.forEach((r, i) => {
    const rowIdx = dataStart + i;

    // Razão social
    const razaoRef = XLSXStyle.utils.encode_cell({ r: rowIdx, c: 0 });
    if (ws[razaoRef])
      ws[razaoRef].s = { font: { bold: true }, alignment: { horizontal: "left" }, border };

    // Categoria
    const catRef = XLSXStyle.utils.encode_cell({ r: rowIdx, c: 1 });
    if (ws[catRef]) ws[catRef].s = { alignment: { horizontal: "left" }, border };

    // Total meta
    const totalMetaRef = XLSXStyle.utils.encode_cell({ r: rowIdx, c: 2 });
    if (ws[totalMetaRef])
      ws[totalMetaRef].s = {
        font: { bold: true },
        fill: { patternType: "solid", fgColor: { rgb: HEX.totalMetaCol } },
        alignment: { horizontal: "right" },
        numFmt: '"R$" #,##0',
        border,
      };

    // Total %
    const totalPctRef = XLSXStyle.utils.encode_cell({ r: rowIdx, c: 3 });
    const totalPctHex = r.total_pct_status ? FAROL_HEX[r.total_pct_status] : null;
    if (ws[totalPctRef])
      ws[totalPctRef].s = {
        font: { bold: true },
        fill: totalPctHex
          ? { patternType: "solid", fgColor: { rgb: totalPctHex } }
          : undefined,
        alignment: { horizontal: "center" },
        border,
      };

    // Famílias
    familias.forEach((f, j) => {
      const cellRef = XLSXStyle.utils.encode_cell({ r: rowIdx, c: 4 + j });
      const cell = ws[cellRef];
      if (!cell) return;

      const hex =
        r.metas_cores?.[f] ??
        (r.metas_status?.[f] ? FAROL_HEX[r.metas_status[f]] : null);

      // Se o valor da célula for a faixa textual do farol, mantém como string; senão como número R$.
      const isFaixaText = typeof cell.v === "string";
      cell.s = {
        fill: hex
          ? { patternType: "solid", fgColor: { rgb: hex.replace(/^#/, "") } }
          : undefined,
        alignment: { horizontal: isFaixaText ? "center" : "right" },
        numFmt: isFaixaText ? undefined : '"R$" #,##0',
        font: isFaixaText ? { bold: true } : undefined,
        border,
      };
    });
  });

  // Linha TOTAL GERAL DA META
  for (let c = 0; c < nCols; c++) {
    const ref = XLSXStyle.utils.encode_cell({ r: totalRowIdx, c });
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = {
      font: { bold: true, sz: 11 },
      fill: { patternType: "solid", fgColor: { rgb: HEX.totalBg } },
      alignment: {
        horizontal: c === 0 || c === 1 ? "left" : c === 3 ? "center" : "right",
      },
      numFmt: c === 2 || c >= 4 ? '"R$" #,##0' : undefined,
      border,
    };
  }

  // Linha PARTICIPAÇÃO
  for (let c = 0; c < nCols; c++) {
    const ref = XLSXStyle.utils.encode_cell({ r: participacaoRowIdx, c });
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = {
      font: { bold: c === 0 },
      fill: { patternType: "solid", fgColor: { rgb: HEX.participacaoBg } },
      alignment: {
        horizontal: c === 0 || c === 1 ? "left" : "center",
      },
      border,
    };
  }

  // Linha ATINGIMENTO
  for (let c = 0; c < nCols; c++) {
    const ref = XLSXStyle.utils.encode_cell({ r: atingimentoRowIdx, c });
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = {
      font: { bold: c === 0 },
      fill: { patternType: "solid", fgColor: { rgb: HEX.atingimentoBg } },
      alignment: {
        horizontal: c === 0 || c === 1 ? "left" : "center",
      },
      border,
    };
  }

  // Congela linhas de cabeçalho e primeiras 2 colunas (como no painel).
  ws["!freeze"] = { xSplit: 2, ySplit: headerRowIdx + 1 } as any;
  (ws as any)["!panes"] = [
    { state: "frozen", xSplit: 2, ySplit: headerRowIdx + 1, topLeftCell: "C5", activePane: "bottomRight" },
  ];

  ws["!cols"] = [
    { wch: 34 }, // razão
    { wch: 12 }, // categoria
    { wch: 16 }, // total meta
    { wch: 10 }, // total %
    ...familias.map(() => ({ wch: 14 })),
  ];
  ws["!rows"] = [{ hpt: 22 }, { hpt: 18 }, { hpt: 10 }, { hpt: 26 }];

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, "Performance");
  XLSXStyle.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
