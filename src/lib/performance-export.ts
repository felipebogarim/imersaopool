// Exporta a matriz de performance para .xlsx no MESMO padrão visual do painel
// de Performance (mesma ordem de colunas, mesmo cabeçalho sólido, mesmas
// linhas de rodapé Total / Participação / Atingimento e mesma paleta do farol).
import * as XLSXStyle from "xlsx-js-style";
import { FAROL_HEX, FAROL_FAIXA_TEXT, type FarolStatus } from "./performance-farol";
import { sanitizeRatio } from "./performance-metrics";

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
  const r = sanitizeRatio(v);
  return r == null ? null : r * 100;
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

function buildPerformanceSheet(opts: {
  representante: string;
  periodo: string;
  familias: string[];
  rows: ExportRow[];
  totals: { perFamilia: Record<string, number>; grand: number };
  participacao?: { __total__: number | null } & Record<string, number | null>;
  atingimento?: { __total__: number | null } & Record<string, number | null>;
}): ReturnType<typeof XLSXStyle.utils.aoa_to_sheet> {
  const { representante, periodo, familias, rows, totals } = opts;

  const header = ["Razão social", "Categoria", "Total meta", "Total %", ...familias];
  const nCols = header.length;

  const aoa: any[][] = [[`Performance — ${representante}`], [`Período: ${periodo}`], [], header];

  for (const r of rows) {
    const somaMetas = familias.reduce((s, f) => s + (Number(r.metas?.[f]) || 0), 0);
    const totalMeta = Number(r.total_meta) || somaMetas || null;
    const totalPct = pctOf(r.total_pct);
    aoa.push([
      r.razao_social,
      r.categoria ?? "",
      totalMeta,
      totalPct != null ? fmtPctCell(totalPct) : "N/D",
      ...familias.map((f) => {
        const meta = Number(r.metas?.[f]) || 0;
        const realValue = r.realizado?.[f];
        const real = typeof realValue === "number" && Number.isFinite(realValue) ? realValue : null;
        const pct =
          pctOf(r.familia_pct?.[f]) ?? (meta > 0 && real != null ? (real / meta) * 100 : null);
        if (pct != null) return fmtPctCell(pct) as any;
        return "N/D" as any;
      }),
    ]);
  }

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
  const mediaPct = (vals: (number | null)[]) => {
    const ok = vals.filter((v): v is number => v != null && !Number.isNaN(v));
    return ok.length ? ok.reduce((s, v) => s + v, 0) / ok.length : null;
  };
  const atingFam = (f: string) => {
    const given = opts.atingimento?.[f] as number | null | undefined;
    if (given != null) return fmtPct(given);
    const calc = mediaPct(rows.map((r) => pctOf(r.familia_pct?.[f])));
    return calc == null ? "" : fmtPctCell(calc);
  };
  const givenTotal = opts.atingimento?.__total__;
  const calcTotal = mediaPct(rows.map((r) => pctOf(r.total_pct)));
  const atingTotalTxt =
    givenTotal != null ? fmtPct(givenTotal) : calcTotal == null ? "" : fmtPctCell(calcTotal);
  const atingimentoRow: any[] = [
    "ATINGIMENTO ESTIMADO DA META",
    "",
    "",
    atingTotalTxt,
    ...familias.map((f) => atingFam(f)),
  ];

  aoa.push(totalRow, participacaoRow, atingimentoRow);

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);

  const headerRowIdx = 3;
  const dataStart = 4;
  const totalRowIdx = dataStart + rows.length;
  const participacaoRowIdx = totalRowIdx + 1;
  const atingimentoRowIdx = totalRowIdx + 2;

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

  rows.forEach((r, i) => {
    const rowIdx = dataStart + i;

    const razaoRef = XLSXStyle.utils.encode_cell({ r: rowIdx, c: 0 });
    if (ws[razaoRef])
      ws[razaoRef].s = { font: { bold: true }, alignment: { horizontal: "left" }, border };

    const catRef = XLSXStyle.utils.encode_cell({ r: rowIdx, c: 1 });
    if (ws[catRef]) ws[catRef].s = { alignment: { horizontal: "left" }, border };

    const totalMetaRef = XLSXStyle.utils.encode_cell({ r: rowIdx, c: 2 });
    if (ws[totalMetaRef])
      ws[totalMetaRef].s = {
        font: { bold: true },
        fill: { patternType: "solid", fgColor: { rgb: HEX.totalMetaCol } },
        alignment: { horizontal: "right" },
        numFmt: '"R$" #,##0',
        border,
      };

    const totalPctRef = XLSXStyle.utils.encode_cell({ r: rowIdx, c: 3 });
    const totalPctHex = r.total_pct_status ? FAROL_HEX[r.total_pct_status] : null;
    if (ws[totalPctRef])
      ws[totalPctRef].s = {
        font: { bold: true },
        fill: totalPctHex ? { patternType: "solid", fgColor: { rgb: totalPctHex } } : undefined,
        alignment: { horizontal: "center" },
        border,
      };

    familias.forEach((f, j) => {
      const cellRef = XLSXStyle.utils.encode_cell({ r: rowIdx, c: 4 + j });
      const cell = ws[cellRef];
      if (!cell) return;

      const hex = r.metas_cores?.[f] ?? (r.metas_status?.[f] ? FAROL_HEX[r.metas_status[f]] : null);

      const isFaixaText = typeof cell.v === "string";
      cell.s = {
        fill: hex ? { patternType: "solid", fgColor: { rgb: hex.replace(/^#/, "") } } : undefined,
        alignment: { horizontal: isFaixaText ? "center" : "right" },
        numFmt: isFaixaText ? undefined : '"R$" #,##0',
        font: isFaixaText ? { bold: true } : undefined,
        border,
      };
    });
  });

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

  for (let c = 0; c < nCols; c++) {
    const ref = XLSXStyle.utils.encode_cell({ r: participacaoRowIdx, c });
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = {
      font: { bold: c === 0 },
      fill: { patternType: "solid", fgColor: { rgb: HEX.participacaoBg } },
      alignment: { horizontal: c === 0 || c === 1 ? "left" : "center" },
      border,
    };
  }

  for (let c = 0; c < nCols; c++) {
    const ref = XLSXStyle.utils.encode_cell({ r: atingimentoRowIdx, c });
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = {
      font: { bold: c === 0 },
      fill: { patternType: "solid", fgColor: { rgb: HEX.atingimentoBg } },
      alignment: { horizontal: c === 0 || c === 1 ? "left" : "center" },
      border,
    };
  }

  ws["!freeze"] = { xSplit: 2, ySplit: headerRowIdx + 1 } as any;
  (ws as any)["!panes"] = [
    {
      state: "frozen",
      xSplit: 2,
      ySplit: headerRowIdx + 1,
      topLeftCell: "C5",
      activePane: "bottomRight",
    },
  ];

  ws["!cols"] = [
    { wch: 34 },
    { wch: 12 },
    { wch: 16 },
    { wch: 10 },
    ...familias.map(() => ({ wch: 14 })),
  ];
  ws["!rows"] = [{ hpt: 22 }, { hpt: 18 }, { hpt: 10 }, { hpt: 26 }];

  return ws;
}

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
  const ws = buildPerformanceSheet(opts);
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, "Performance");
  XLSXStyle.writeFile(
    wb,
    opts.filename.endsWith(".xlsx") ? opts.filename : `${opts.filename}.xlsx`,
  );
}

export function exportAllPerformanceXlsx(opts: {
  filename: string;
  periodo: string;
  reps: Array<{
    representante: string;
    /** Sobrescreve o período global quando cada rep tem um período diferente. */
    periodo?: string;
    familias: string[];
    rows: ExportRow[];
    totals: { perFamilia: Record<string, number>; grand: number };
  }>;
}) {
  // Caracteres proibidos em nomes de aba do Excel: \ / ? * [ ] :
  const sanitizeSheetName = (s: string) =>
    s
      .replace(/[\\/?*[\]:]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

  const wb = XLSXStyle.utils.book_new();
  const usedNames = new Set<string>();
  for (const rep of opts.reps) {
    const ws = buildPerformanceSheet({ ...rep, periodo: rep.periodo ?? opts.periodo });
    let base = sanitizeSheetName(rep.representante).slice(0, 31) || "Rep";
    let name = base;
    if (usedNames.has(name)) {
      let i = 2;
      while (usedNames.has(`${base.slice(0, 28)} (${i})`)) i++;
      name = `${base.slice(0, 28)} (${i})`;
    }
    usedNames.add(name);
    XLSXStyle.utils.book_append_sheet(wb, ws, name);
  }
  XLSXStyle.writeFile(
    wb,
    opts.filename.endsWith(".xlsx") ? opts.filename : `${opts.filename}.xlsx`,
  );
}
