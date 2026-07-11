import jsPDF from "jspdf";
import { exportToCsv } from "./export-csv";

const NAVY: [number, number, number] = [10, 20, 44];
const CYAN: [number, number, number] = [56, 189, 220];
const CYAN_DEEP: [number, number, number] = [14, 116, 144];
const CORAL: [number, number, number] = [244, 114, 94];
const INK: [number, number, number] = [20, 24, 36];
const MUTED: [number, number, number] = [110, 120, 138];
const HAIRLINE: [number, number, number] = [220, 226, 236];
const CREAM: [number, number, number] = [248, 246, 240];

function cleanText(value: unknown): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value ?? "—", null, 2);
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "• ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function exportCompilationPdf(detail: any) {
  const c = (detail?.conteudo ?? {}) as any;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxW = pageW - margin * 2;
  let y = margin;

  const setFill = (color: [number, number, number]) =>
    doc.setFillColor(color[0], color[1], color[2]);
  const setText = (color: [number, number, number]) =>
    doc.setTextColor(color[0], color[1], color[2]);
  const setDraw = (color: [number, number, number]) =>
    doc.setDrawColor(color[0], color[1], color[2]);
  const bottom = () => pageH - margin - 44;

  const addContentPage = () => {
    doc.addPage();
    setFill(CREAM);
    doc.rect(0, 0, pageW, pageH, "F");
    setFill(NAVY);
    doc.rect(0, 0, 6, pageH, "F");
    setFill(CYAN);
    doc.rect(0, 0, 6, 120, "F");
    y = margin + 10;
  };

  const ensure = (n: number) => {
    if (y + n > bottom()) addContentPage();
  };

  const write = (
    text: string,
    size = 10,
    style: "normal" | "bold" = "normal",
    color: [number, number, number] = INK,
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    setText(color);
    const lineH = size * 1.35;
    for (const paragraph of cleanText(text || "—").split("\n")) {
      const lines = paragraph.trim() ? doc.splitTextToSize(paragraph, maxW) : [""];
      for (const line of lines) {
        ensure(lineH);
        if (line) doc.text(line, margin, y);
        y += lineH;
      }
    }
  };

  const writePanel = (title: string, body: unknown) => {
    const text = cleanText(body) || "—";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lineH = 14;
    const lines = doc.splitTextToSize(text, maxW - 36);
    let index = 0;
    let continued = false;

    while (index < lines.length) {
      ensure(62);
      const headerH = 34;
      let available = Math.floor((bottom() - y - headerH - 12) / lineH);
      if (available < 1) {
        addContentPage();
        available = Math.floor((bottom() - y - headerH - 12) / lineH);
      }
      const chunk = lines.slice(index, index + Math.max(1, available));
      const panelH = Math.max(58, headerH + chunk.length * lineH + 14);

      setFill([255, 255, 255]);
      doc.roundedRect(margin, y, maxW, panelH, 7, 7, "F");
      setDraw(HAIRLINE);
      doc.setLineWidth(0.45);
      doc.roundedRect(margin, y, maxW, panelH, 7, 7, "S");
      setFill(CORAL);
      doc.rect(margin, y + 8, 3, panelH - 16, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(CYAN_DEEP);
      doc.text(`${title}${continued ? " · CONTINUAÇÃO" : ""}`.toUpperCase(), margin + 18, y + 21, {
        charSpace: 1.1,
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      setText(INK);
      let ly = y + 42;
      for (const line of chunk) {
        doc.text(line, margin + 18, ly);
        ly += lineH;
      }
      index += chunk.length;
      y += panelH + 10;
      continued = true;
      if (index < lines.length) addContentPage();
    }
  };

  setFill(NAVY);
  doc.rect(0, 0, pageW, pageH, "F");
  setFill(CYAN_DEEP);
  doc.rect(0, pageH - 250, pageW, 250, "F");
  setFill(CYAN);
  doc.rect(0, pageH - 250, pageW * 0.55, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(CYAN);
  doc.text("POOLFLUX  ·  COMPILAÇÃO DE INTELIGÊNCIA", margin, 90, { charSpace: 2 });
  doc.setFontSize(44);
  setText([255, 255, 255]);
  doc.text("Compilação IA", margin, 210);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(18);
  setText(CYAN);
  doc.text(`${detail.tipo} · v${detail.versao} · ${detail.escopo_tipo}`, margin, 242);
  doc.setFontSize(9);
  setText([200, 220, 232]);
  doc.text(
    `Gerado em ${new Date(detail.created_at).toLocaleDateString("pt-BR")}`,
    pageW - margin,
    pageH - 60,
    { align: "right" },
  );

  addContentPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(CYAN_DEEP);
  doc.text("PANORAMA", margin, y, { charSpace: 2 });
  y += 22;
  write("Síntese compilada.", 28, "bold", NAVY);
  y += 4;
  setDraw(CORAL);
  doc.setLineWidth(3);
  doc.line(margin, y, margin + 48, y);
  y += 28;

  const perspectives = detail.perspectivas_incluidas?.length ?? 0;
  const counts = [c.insights_chave, c.oportunidades, c.ameacas, c.lacunas, c.recomendacoes].reduce(
    (acc, items) => acc + (Array.isArray(items) ? items.length : 0),
    0,
  );
  const statTop = y;
  const statH = 190;
  setFill(NAVY);
  doc.roundedRect(margin, statTop, maxW, statH, 10, 10, "F");
  setFill(CORAL);
  doc.roundedRect(margin, statTop, 8, statH, 10, 10, "F");
  doc.rect(margin + 4, statTop, 4, statH, "F");
  const big = String(counts);
  doc.setFont("helvetica", "bold");
  let bigSize = 110;
  doc.setFontSize(bigSize);
  while (doc.getTextWidth(big) > 160 && bigSize > 54) {
    bigSize -= 8;
    doc.setFontSize(bigSize);
  }
  setText(CYAN);
  doc.text(big, margin + 42, statTop + 128);
  const bigW = doc.getTextWidth(big);
  const statX = margin + 42 + bigW + 34;
  doc.setFontSize(8);
  setText([160, 205, 220]);
  doc.text("SINAIS CONSOLIDADOS", statX, statTop + 62, { charSpace: 1.5 });
  doc.setFontSize(21);
  setText([255, 255, 255]);
  const statLines = doc.splitTextToSize(
    `${perspectives} perspectivas incluídas nesta leitura comparativa.`,
    maxW - (statX - margin) - 24,
  );
  let statY = statTop + 96;
  for (const line of statLines.slice(0, 3)) {
    doc.text(line, statX, statY);
    statY += 25;
  }
  y = statTop + statH + 24;

  const section = (title: string) => {
    ensure(50);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN_DEEP);
    doc.text(title.toUpperCase(), margin, y, { charSpace: 1.4 });
    y += 12;
    setDraw(CORAL);
    doc.setLineWidth(2);
    doc.line(margin, y, margin + 44, y);
    y += 18;
  };
  const bullets = (title: string, items: unknown) => {
    if (!Array.isArray(items) || items.length === 0) return;
    section(title);
    for (const it of items) writePanel("item", it);
  };

  if (c.resumo_executivo) {
    section("Resumo executivo");
    writePanel("resumo", c.resumo_executivo);
  }
  bullets("Insights-chave", c.insights_chave);
  bullets("Oportunidades", c.oportunidades);
  bullets("Ameaças", c.ameacas);
  bullets("Lacunas", c.lacunas);

  if (Array.isArray(c.recomendacoes) && c.recomendacoes.length) {
    section("Recomendações");
    c.recomendacoes.forEach((r: any, i: number) => {
      writePanel(
        `${i + 1}. ${r.prioridade ?? "recomendação"}`,
        [r.acao, r.justificativa].filter(Boolean).join("\n"),
      );
    });
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (p > 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setText(MUTED);
      doc.text("POOLFLUX  ·  COMPILAÇÃO IA", margin, 30, { charSpace: 1.5 });
      setDraw(HAIRLINE);
      doc.setLineWidth(0.4);
      doc.line(margin, 38, pageW - margin, 38);
    }
    setDraw(HAIRLINE);
    doc.line(margin, pageH - 32, pageW - margin, pageH - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(MUTED);
    doc.text("Inteligência de mercado · confidencial", margin, pageH - 18);
    doc.setFont("helvetica", "bold");
    setText(NAVY);
    doc.text(
      `${String(p).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
      pageW - margin,
      pageH - 18,
      { align: "right" },
    );
  }

  const name = `compilacao-${detail.tipo}-v${detail.versao}.pdf`;
  doc.save(name);
}

export function exportCompilationCsv(detail: any) {
  const c = (detail?.conteudo ?? {}) as any;
  const rows: Record<string, any>[] = [];
  const push = (secao: string, item: any, extra: Record<string, any> = {}) =>
    rows.push({
      secao,
      conteudo: typeof item === "string" ? item : JSON.stringify(item),
      ...extra,
    });

  if (c.resumo_executivo) push("resumo_executivo", c.resumo_executivo);
  (c.insights_chave ?? []).forEach((i: any) => push("insight", i));
  (c.oportunidades ?? []).forEach((i: any) => push("oportunidade", i));
  (c.ameacas ?? []).forEach((i: any) => push("ameaca", i));
  (c.lacunas ?? []).forEach((i: any) => push("lacuna", i));
  (c.recomendacoes ?? []).forEach((r: any) =>
    push("recomendacao", r.acao ?? "", {
      prioridade: r.prioridade ?? "",
      justificativa: r.justificativa ?? "",
    }),
  );

  exportToCsv(`compilacao-${detail.tipo}-v${detail.versao}`, rows);
}

export function exportPerspectivasCsv(rows: any[], filename = "perspectivas-aprovadas") {
  const flat = rows.map((p) => ({
    id: p.id,
    lente: p.lente,
    escopo_tipo: p.escopo_tipo,
    escopo_ref_id: p.escopo_ref_id ?? "",
    origem: p.origem ?? "",
    status: p.status,
    created_at: p.created_at,
    ...(p.conteudo ?? {}),
  }));
  exportToCsv(filename, flat);
}
