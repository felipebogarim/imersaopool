// Renderer PDF do Relatório Executivo — A4, mesma linguagem visual do sistema.
import jsPDF from "jspdf";
import {
  AREA_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  formatVisitDate,
  toFinalData,
  type ExecutiveReportData,
} from "./types";

type RGB = [number, number, number];
type Style = "normal" | "bold" | "italic";

const C = {
  background: [225, 233, 239] as RGB,
  card: [255, 255, 255] as RGB,
  muted: [215, 223, 229] as RGB,
  border: [181, 191, 198] as RGB,
  foreground: [14, 28, 40] as RGB,
  mutedFg: [71, 84, 96] as RGB,
  primary: [0, 141, 173] as RGB,
  primaryDeep: [6, 40, 56] as RGB,
};

export function exportExecutiveReportPdf(input: ExecutiveReportData) {
  const data = toFinalData(input);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 44;
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const W = PW - M * 2;
  const BOTTOM = PH - M - 18;
  let y = M;

  const paintBg = () => {
    doc.setFillColor(...C.background);
    doc.rect(0, 0, PW, PH, "F");
  };
  const newPage = () => {
    doc.addPage();
    paintBg();
    y = M;
  };
  const need = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  const wrap = (s: string, size: number, style: Style, width: number) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    return doc.splitTextToSize(s || "", width) as string[];
  };
  const text = (
    s: string,
    opts: { size?: number; style?: Style; color?: RGB; x?: number; width?: number; gap?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    const style = opts.style ?? "normal";
    const color = opts.color ?? C.foreground;
    const x = opts.x ?? M;
    const width = opts.width ?? W;
    for (const line of wrap(s, size, style, width)) {
      need(size + 4);
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.text(line, x, y + size);
      y += size + 3;
    }
    y += opts.gap ?? 4;
  };
  const chapter = (num: string, title: string) => {
    need(46);
    doc.setFillColor(...C.primaryDeep);
    doc.roundedRect(M, y, W, 30, 5, 5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`CAPÍTULO ${num}`, M + 12, y + 12);
    doc.setFontSize(12);
    doc.text(title.toUpperCase(), M + 12, y + 24);
    y += 42;
  };
  const cardStart = () => {
    doc.setFillColor(...C.card);
    doc.setDrawColor(...C.border);
    return y;
  };

  paintBg();

  // Capa / cabeçalho
  doc.setFillColor(...C.primaryDeep);
  doc.roundedRect(M, y, W, 96, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("RELATÓRIO EXECUTIVO DE IMERSÃO", M + 16, y + 24);
  doc.setFontSize(18);
  const nameLines = doc.splitTextToSize(data.client.display_name || data.report_title, W - 32) as string[];
  let ny = y + 48;
  for (const l of nameLines.slice(0, 2)) {
    doc.text(l, M + 16, ny);
    ny += 20;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${formatVisitDate(data.client.visit_date)}${data.client.location ? " · " + data.client.location : ""}`,
    M + 16,
    y + 84,
  );
  y += 112;

  // Capítulo 01 — Briefing
  chapter("01", "Briefing executivo");
  const info: [string, string][] = [
    ["Cliente", data.client.display_name || "—"],
    ["Data", formatVisitDate(data.client.visit_date)],
    ["Local", data.client.location || "—"],
    ["Representante", data.client.representative || "—"],
    ["Consultor", data.client.consultant || "—"],
    ["Categoria", data.client.category || "—"],
    ["Atingimento", data.client.attainment || "—"],
  ];
  for (const [k, v] of info) {
    need(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.mutedFg);
    doc.text(k.toUpperCase(), M, y + 9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.foreground);
    const lines = wrap(v, 10, "normal", W - 130);
    doc.setFontSize(10);
    doc.text(lines[0] ?? "—", M + 130, y + 9);
    y += 16 + Math.max(0, (lines.length - 1)) * 12;
  }
  if (data.brands_observed.length) {
    y += 6;
    text("MARCAS OBSERVADAS", { size: 8, style: "bold", color: C.mutedFg, gap: 1 });
    text(data.brands_observed.join(" · "), { size: 10 });
  }
  y += 8;

  // Capítulo 02 — Leitura executiva
  if (data.executive_reading) {
    chapter("02", "Leitura executiva");
    text(data.executive_reading, { size: 11, gap: 10 });
  }

  // Capítulo 03 — Do diagnóstico à ação
  chapter("03", "Do diagnóstico à ação");
  data.decision_blocks.forEach((b, i) => {
    need(70);
    cardStart();
    const startY = y;
    y += 12;
    text(`${String(i + 1).padStart(2, "0")} · ${b.title}`, {
      size: 12,
      style: "bold",
      x: M + 14,
      width: W - 28,
      color: C.primaryDeep,
      gap: 6,
    });
    if (b.cause) {
      text("CAUSA", { size: 8, style: "bold", color: C.mutedFg, x: M + 14, width: W - 28, gap: 1 });
      text(b.cause, { size: 10, x: M + 14, width: W - 28, gap: 6 });
    }
    if (b.impact) {
      text("O QUE ISSO GERA", { size: 8, style: "bold", color: C.mutedFg, x: M + 14, width: W - 28, gap: 1 });
      text(b.impact, { size: 10, x: M + 14, width: W - 28, gap: 6 });
    }
    if (b.evidence?.quote) {
      text("EVIDÊNCIA ESSENCIAL", { size: 8, style: "bold", color: C.mutedFg, x: M + 14, width: W - 28, gap: 1 });
      text(`“${b.evidence.quote}”`, { size: 10, style: "italic", x: M + 20, width: W - 34, gap: 2 });
      const who = [b.evidence.author, b.evidence.role].filter(Boolean).join(" · ");
      if (who) text(who, { size: 8, color: C.mutedFg, x: M + 20, width: W - 34, gap: 6 });
    }
    const acts = data.actions.filter((a) => b.action_ids.includes(a.id));
    if (acts.length) {
      text("AÇÕES", { size: 8, style: "bold", color: C.mutedFg, x: M + 14, width: W - 28, gap: 1 });
      for (const a of acts) {
        text(`• ${a.title} — ${AREA_LABEL[a.area]} · ${PRIORITY_LABEL[a.priority]}`, {
          size: 10,
          x: M + 14,
          width: W - 28,
          gap: 1,
        });
        if (a.description) text(a.description, { size: 9, color: C.mutedFg, x: M + 24, width: W - 40, gap: 3 });
      }
    }
    y += 8;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.6);
    if (y > startY) doc.roundedRect(M, startY, W, Math.min(y - startY, BOTTOM - startY), 5, 5, "S");
    y += 12;
  });

  // Capítulo 04 — Não prioridade
  if (data.do_not_prioritize.length) {
    chapter("04", "Onde não concentrar energia agora");
    for (const n of data.do_not_prioritize) {
      need(40);
      text(n.title, { size: 11, style: "bold", color: C.primaryDeep, gap: 3 });
      if (n.cause) {
        text("CAUSA", { size: 8, style: "bold", color: C.mutedFg, gap: 1 });
        text(n.cause, { size: 10, gap: 4 });
      }
      if (n.decision) {
        text("DECISÃO RECOMENDADA", { size: 8, style: "bold", color: C.mutedFg, gap: 1 });
        text(n.decision, { size: 10, gap: 8 });
      }
    }
  }

  // Capítulo 05 — Plano de ação
  chapter("05", "Plano de ação");
  data.actions.forEach((a, i) => {
    need(38);
    doc.setFillColor(...(i % 2 === 0 ? C.card : C.muted));
    const rowLines = wrap(a.title, 10, "bold", W - 200);
    const descLines = a.description ? wrap(a.description, 9, "normal", W - 200) : [];
    const h = 18 + rowLines.length * 12 + descLines.length * 11;
    doc.rect(M, y, W, h, "F");
    doc.setTextColor(...C.mutedFg);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(PRIORITY_LABEL[a.priority].toUpperCase(), M + 10, y + 16);
    doc.text(AREA_LABEL[a.area].toUpperCase(), M + 70, y + 16);
    doc.text(STATUS_LABEL[a.status].toUpperCase(), W + M - 70, y + 16);
    doc.setTextColor(...C.foreground);
    doc.setFontSize(10);
    let ry = y + 16;
    for (const l of rowLines) {
      doc.text(l, M + 170, ry);
      ry += 12;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.mutedFg);
    for (const l of descLines) {
      doc.text(l, M + 170, ry);
      ry += 11;
    }
    y += h + 4;
  });

  // Rodapé
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.mutedFg);
    doc.text("PoolFlux · Relatório Executivo de Imersão", M, PH - 24);
    doc.text(`${p}/${pages}`, PW - M - 20, PH - 24);
  }

  const safe = (data.client.display_name || "relatorio").replace(/[^\w-]+/g, "_").slice(0, 50);
  doc.save(`Relatorio_Executivo_${safe}.pdf`);
}
