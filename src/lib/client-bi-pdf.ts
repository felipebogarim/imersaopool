// Relatório visual (PDF) do BI do cliente — mesmo padrão de cores do painel.
import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import {
  FAROL_HEX,
  FAROL_LABEL,
  FAROL_ORDER,
  statusFromPercent,
  type FarolStatus,
} from "./performance-farol";
import type { ClientBIData } from "./client-bi-parser";

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace(/^#/, "").padStart(6, "0").slice(-6);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const INK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [107, 114, 128];
const LINE: [number, number, number] = [226, 232, 240];

const toPct = (n: number | null | undefined): number | null => {
  if (n == null || Number.isNaN(n)) return null;
  return Math.abs(n) <= 1.5 ? n * 100 : n;
};

const fmtPct = (n: number | null | undefined) => {
  const v = toPct(n);
  return v == null ? "—" : `${v.toFixed(1).replace(".", ",")}%`;
};

const farolKeyFromLabel = (grupo: string | null | undefined): FarolStatus | null => {
  if (!grupo) return null;
  const g = String(grupo).trim().toLowerCase();
  return (FAROL_ORDER.find(k => FAROL_LABEL[k].toLowerCase() === g) as FarolStatus) ?? null;
};

export type ClientBIPdfInput = {
  razaoSocial: string;
  representante: string | null;
  categoria: string | null;
  data: ClientBIData;
};

export function exportClientBIPdf(input: ClientBIPdfInput) {
  const { razaoSocial, representante, data: d } = input;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = 44;

  // Cabeçalho
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 78, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text(razaoSocial, M, 36);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `BI do cliente · Representante: ${representante ?? "—"} · Categoria: ${
      input.categoria ?? d.categoria ?? "—"
    } · Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    M,
    56,
  );
  y = 104;

  // KPIs
  const kpis: { label: string; value: string; sub?: string; status?: FarolStatus | null }[] = [
    { label: "Atingimento geral", value: fmtPct(d.geral), status: statusFromPercent(toPct(d.geral)) },
    { label: "Categoria do cliente", value: input.categoria ?? d.categoria ?? "—" },
    {
      label: "Melhor família",
      value: fmtPct(d.melhor_familia?.atingimento),
      sub: d.melhor_familia?.label ?? "—",
    },
    {
      label: "Pior família",
      value: fmtPct(d.pior_familia?.atingimento),
      sub: d.pior_familia?.label ?? "—",
    },
  ];
  const cardW = (W - M * 2 - 12 * 3) / 4;
  kpis.forEach((k, i) => {
    const x = M + i * (cardW + 12);
    doc.setDrawColor(...LINE);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(x, y, cardW, 66, 6, 6, "FD");
    if (k.status) {
      const [r, g, b] = hexToRgb(FAROL_HEX[k.status]);
      doc.setFillColor(r, g, b);
      doc.roundedRect(x, y, cardW, 6, 3, 3, "F");
    }
    doc.setTextColor(...MUTED).setFont("helvetica", "normal").setFontSize(8);
    doc.text(k.label.toUpperCase(), x + 12, y + 24);
    doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(18);
    doc.text(k.value, x + 12, y + 46);
    if (k.sub) {
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
      doc.text(doc.splitTextToSize(k.sub, cardW - 24)[0] ?? "", x + 12, y + 58);
    }
  });
  y += 88;

  // Gráfico de barras — atingimento por família
  const fams = (d.familias ?? [])
    .map(f => ({
      familia: f.familia,
      pct: toPct(f.atingimento),
      status: toPct(f.atingimento) == null
        ? null
        : statusFromPercent(toPct(f.atingimento)),
    }))
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));

  if (fams.length) {
    doc.setTextColor(...MUTED).setFont("helvetica", "bold").setFontSize(9);
    doc.text("ATINGIMENTO POR FAMÍLIA", M, y);
    y += 12;

    const chartH = 150;
    const chartW = W - M * 2;
    const maxPct = Math.max(100, ...fams.map(f => f.pct ?? 0));
    doc.setDrawColor(...LINE);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, y, chartW, chartH, 6, 6, "FD");

    const base = y + chartH - 26;
    const plotH = chartH - 46;
    // linha de referência 100%
    const ref = base - (100 / maxPct) * plotH;
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([3, 3], 0);
    doc.line(M + 8, ref, M + chartW - 8, ref);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(7).setTextColor(...MUTED);
    doc.text("100%", M + chartW - 32, ref - 3);

    const slot = (chartW - 24) / fams.length;
    const barW = Math.min(48, slot * 0.6);
    fams.forEach((f, i) => {
      const cx = M + 12 + slot * i + slot / 2;
      const h = f.pct == null ? 0 : Math.max(2, (f.pct / maxPct) * plotH);
      const [r, g, b] = f.status ? hexToRgb(FAROL_HEX[f.status]) : [229, 231, 235];
      doc.setFillColor(r, g, b);
      doc.roundedRect(cx - barW / 2, base - h, barW, h, 2, 2, "F");
      doc.setFontSize(7).setTextColor(...INK).setFont("helvetica", "bold");
      doc.text(fmtPct(f.pct), cx, base - h - 4, { align: "center" });
      doc.setFont("helvetica", "normal").setTextColor(...MUTED);
      const lbl = doc.splitTextToSize(f.familia, slot - 4) as string[];
      doc.text(lbl.slice(0, 2), cx, base + 10, { align: "center" });
    });
    y += chartH + 22;
  }

  // Tabela de famílias com farol
  const body: RowInput[] = fams.map(f => [
    f.familia,
    fmtPct(f.pct),
    f.status ? FAROL_LABEL[f.status] : "—",
  ]);
  autoTable(doc, {
    startY: y,
    head: [["Família", "Atingimento", "Farol"]],
    body,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 5, lineColor: LINE, lineWidth: 0.5 },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "center" } },
    didParseCell: hook => {
      if (hook.section !== "body" || hook.column.index !== 2) return;
      const st = fams[hook.row.index]?.status;
      if (!st) return;
      const [r, g, b] = hexToRgb(FAROL_HEX[st]);
      hook.cell.styles.fillColor = [r, g, b];
      hook.cell.styles.textColor = INK;
      hook.cell.styles.fontStyle = "bold";
    },
  });
  y = (doc as any).lastAutoTable.finalY + 24;

  // Distribuição do farol
  const dist = (d.distribuicao_farol ?? []).map(x => ({
    grupo: x.grupo,
    quantidade: x.quantidade,
    status: farolKeyFromLabel(x.grupo),
  }));
  if (dist.length) {
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = 48;
    }
    doc.setTextColor(...MUTED).setFont("helvetica", "bold").setFontSize(9);
    doc.text("DISTRIBUIÇÃO DOS GRUPOS DO FAROL", M, y);
    y += 12;
    const w = (W - M * 2 - 10 * (dist.length - 1)) / dist.length;
    dist.forEach((g, i) => {
      const x = M + i * (w + 10);
      const [r, gg, b] = hexToRgb(FAROL_HEX[g.status ?? "sem_compra"]);
      doc.setFillColor(r, gg, b);
      doc.setDrawColor(...LINE);
      doc.roundedRect(x, y, w, 56, 6, 6, "FD");
      doc.setTextColor(...INK).setFont("helvetica", "normal").setFontSize(7.5);
      doc.text(doc.splitTextToSize(String(g.grupo), w - 16)[0] ?? "", x + 10, y + 20);
      doc.setFont("helvetica", "bold").setFontSize(18);
      doc.text(String(g.quantidade), x + 10, y + 44);
    });
    y += 76;
  }

  const file = `bi-cliente-${razaoSocial.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.pdf`;
  doc.save(file);
}
