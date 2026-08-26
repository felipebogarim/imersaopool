// Exporta a matriz de performance para PDF no mesmo padrão visual da matriz
// do painel (mesma ordem de colunas, mesmas linhas de rodapé Total /
// Participação / Atingimento e mesma paleta do farol).
import jsPDF from "jspdf";
import autoTable, { type RowInput, type CellDef } from "jspdf-autotable";
import { FAROL_HEX, FAROL_FAIXA_TEXT, type FarolStatus } from "./performance-farol";

type PdfRow = {
  razao_social: string;
  categoria: string | null;
  metas: Record<string, number>;
  metas_status?: Record<string, FarolStatus>;
  total_meta: number | null;
  total_pct_status?: FarolStatus | null;
};

const HEX = {
  headerBg: [31, 41, 55] as [number, number, number],
  headerFg: [255, 255, 255] as [number, number, number],
  totalBg: [229, 231, 235] as [number, number, number],
  participacaoBg: [224, 242, 254] as [number, number, number],
  atingimentoBg: [254, 243, 199] as [number, number, number],
  totalMetaCol: [243, 244, 246] as [number, number, number],
};

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace(/^#/, "").padStart(6, "0").slice(-6);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const fmtBRL = (n: number | null | undefined) =>
  n == null || Number.isNaN(n)
    ? ""
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtPct = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "";
  const v = Math.abs(n) <= 1.5 ? n * 100 : n;
  return `${v.toFixed(1).replace(".", ",")}%`;
};

export function exportPerformancePdf(opts: {
  filename: string;
  representante: string;
  periodo: string;
  familias: string[];
  rows: PdfRow[];
  totals: { perFamilia: Record<string, number>; grand: number };
  participacao?: { __total__: number | null } & Record<string, number | null>;
  atingimento?: { __total__: number | null } & Record<string, number | null>;
}) {
  const { filename, representante, periodo, familias, rows, totals } = opts;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Performance — ${representante}`, 32, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Período: ${periodo}`, 32, 50);
  doc.setTextColor(0);

  const head = [["Razão social", "Categoria", "Total meta", "Total %", ...familias]];

  const body: RowInput[] = rows.map((r) => {
    const totalMeta =
      r.total_meta ??
      familias.reduce((s, f) => s + (Number(r.metas?.[f]) || 0), 0);
    const totalPctHex = r.total_pct_status ? hexToRgb(FAROL_HEX[r.total_pct_status]) : null;

    const cells: CellDef[] = [
      { content: r.razao_social, styles: { fontStyle: "bold", halign: "left" } },
      { content: r.categoria ?? "", styles: { halign: "left" } },
      {
        content: fmtBRL(totalMeta),
        styles: { fontStyle: "bold", halign: "right", fillColor: HEX.totalMetaCol },
      },
      {
        content: FAROL_FAIXA_TEXT[r.total_pct_status ?? "sem_compra"],
        styles: {
          halign: "center",
          fontStyle: "bold",
          ...(totalPctHex ? { fillColor: totalPctHex } : {}),
        },
      },
      ...familias.map<CellDef>((f) => {
        const st = r.metas_status?.[f] ?? "sem_compra";
        const bg = hexToRgb(FAROL_HEX[st]);
        return {
          content: FAROL_FAIXA_TEXT[st],
          styles: {
            halign: "center",
            fontStyle: "bold",
            ...(bg ? { fillColor: bg } : {}),
          },
        };
      }),

    ];
    return cells;
  });

  // Rodapé
  const totalRowCells: CellDef[] = [
    { content: "TOTAL GERAL DA META", styles: { halign: "left", fontStyle: "bold", fillColor: HEX.totalBg } },
    { content: "", styles: { fillColor: HEX.totalBg } },
    { content: fmtBRL(totals.grand), styles: { halign: "right", fontStyle: "bold", fillColor: HEX.totalBg } },
    { content: "", styles: { fillColor: HEX.totalBg } },
    ...familias.map<CellDef>((f) => ({
      content: fmtBRL(totals.perFamilia[f] || 0),
      styles: { halign: "right", fontStyle: "bold", fillColor: HEX.totalBg },
    })),
  ];

  const participacaoCells: CellDef[] = [
    { content: "PARTICIPAÇÃO ESTIMADA NA VENDA", styles: { halign: "left", fontStyle: "bold", fillColor: HEX.participacaoBg } },
    { content: "", styles: { fillColor: HEX.participacaoBg } },
    { content: "", styles: { fillColor: HEX.participacaoBg } },
    { content: fmtPct(opts.participacao?.__total__ ?? null), styles: { halign: "center", fillColor: HEX.participacaoBg } },
    ...familias.map<CellDef>((f) => ({
      content: fmtPct((opts.participacao?.[f] as number | null | undefined) ?? null),
      styles: { halign: "center", fillColor: HEX.participacaoBg },
    })),
  ];

  const atingimentoCells: CellDef[] = [
    { content: "ATINGIMENTO ESTIMADO DA META", styles: { halign: "left", fontStyle: "bold", fillColor: HEX.atingimentoBg } },
    { content: "", styles: { fillColor: HEX.atingimentoBg } },
    { content: "", styles: { fillColor: HEX.atingimentoBg } },
    { content: fmtPct(opts.atingimento?.__total__ ?? null), styles: { halign: "center", fillColor: HEX.atingimentoBg } },
    ...familias.map<CellDef>((f) => ({
      content: fmtPct((opts.atingimento?.[f] as number | null | undefined) ?? null),
      styles: { halign: "center", fillColor: HEX.atingimentoBg },
    })),
  ];


  body.push(totalRowCells, participacaoCells, atingimentoCells);

  autoTable(doc, {
    startY: 62,
    head,
    body,
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 3,
      lineColor: [209, 213, 219],
      lineWidth: 0.4,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: HEX.headerBg,
      textColor: HEX.headerFg,
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 130, halign: "left" },
      1: { cellWidth: 55, halign: "left" },
      2: { cellWidth: 62, halign: "right" },
      3: { cellWidth: 46, halign: "center" },
    },
    margin: { left: 24, right: 24 },
    tableWidth: pageW - 48,
    theme: "grid",
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
