import jsPDF from "jspdf";
import JSZip from "jszip";

export interface VisaoImersao2ExportItem {
  id: string;
  client_name: string;
  visit_date?: string | null;
  source_filename?: string | null;
  content_markdown?: string | null;
  structured_data?: any;
  meta: {
    representante: string;
    regiao: string;
    categoria: string;
  };
}

function esc(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(s: string): string {
  return (s || "relatorio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function formatDate(d?: string | null): string {
  if (!d) return "—";
  const clean = d.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, day] = clean.split("-");
    return `${day}/${m}/${y}`;
  }
  return clean;
}

function resolveReportFileName(r: VisaoImersao2ExportItem, ext: "md" | "pdf"): string {
  if (r.source_filename) {
    const base = r.source_filename.replace(/\.[^.]+$/, "");
    return `${base}.${ext}`;
  }
  const name = slugify(r.client_name);
  const date = r.visit_date ? r.visit_date.slice(0, 10) : "sem-data";
  return `Relatorio_${name}_${date}.${ext}`;
}

/**
 * Exporta relatórios como arquivos Markdown (.md).
 * Se for 1 relatório, baixa o arquivo .md diretamente.
 * Se forem múltiplos relatórios, empacota todos em um arquivo .zip.
 */
export async function exportVisaoImersao2Markdown(reports: VisaoImersao2ExportItem[]): Promise<void> {
  if (!reports.length) return;

  const today = new Date().toISOString().slice(0, 10);

  if (reports.length === 1) {
    const r = reports[0];
    const fileName = resolveReportFileName(r, "md");
    const content = r.content_markdown || `# ${r.client_name}\n\nSem conteúdo gravado.`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const r of reports) {
    let name = resolveReportFileName(r, "md");
    if (usedNames.has(name)) {
      let counter = 2;
      const base = name.replace(/\.md$/, "");
      while (usedNames.has(`${base}_${counter}.md`)) counter++;
      name = `${base}_${counter}.md`;
    }
    usedNames.add(name);

    const content = r.content_markdown || `# ${r.client_name}\n\nSem conteúdo gravado.`;
    zip.file(name, content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `visao-imersao-2-markdown-${today}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Converte markdown simples para blocos legíveis por jsPDF.
 */
function cleanMarkdownLines(md: string): Array<{ type: "h1" | "h2" | "h3" | "bullet" | "quote" | "p"; text: string }> {
  const lines = (md || "").split(/\r?\n/);
  const blocks: Array<{ type: "h1" | "h2" | "h3" | "bullet" | "quote" | "p"; text: string }> = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "h1", text: trimmed.slice(2).trim() });
    } else if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.slice(3).trim() });
    } else if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.slice(4).trim() });
    } else if (/^[-*+]\s+/.test(trimmed)) {
      blocks.push({ type: "bullet", text: trimmed.replace(/^[-*+]\s+/, "").trim() });
    } else if (trimmed.startsWith(">")) {
      blocks.push({ type: "quote", text: trimmed.replace(/^>\s*/, "").trim() });
    } else {
      // Limpa tags ou marcadores em excesso
      blocks.push({ type: "p", text: trimmed });
    }
  }

  return blocks;
}

/**
 * Renderiza um ou mais relatórios Visão Imersão 2 em um documento PDF consolidado via jsPDF.
 */
export async function exportVisaoImersao2Pdf(reports: VisaoImersao2ExportItem[]): Promise<void> {
  if (!reports.length) return;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 40;
  const W = PW - M * 2;
  const BOTTOM = PH - M - 20;

  let y = M;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > BOTTOM) {
      doc.addPage();
      y = M;
      return true;
    }
    return false;
  };

  reports.forEach((r, reportIndex) => {
    if (reportIndex > 0) {
      doc.addPage();
      y = M;
    }

    // Top Header Bar
    doc.setFillColor(6, 40, 56); // #062838
    doc.rect(M, y, W, 40, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 141, 173); // #008DAD
    doc.text("POOLFLUX", M + 14, y + 24);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.text(" | VISÃO IMERSÃO 2 · DIAGNÓSTICO COMERCIAL", M + 70, y + 24);

    y += 52;

    // Client Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(14, 28, 40);
    const titleLines = doc.splitTextToSize(r.client_name || "Cliente sem identificação", W);
    doc.text(titleLines, M, y);
    y += titleLines.length * 18 + 4;

    // Metadata Card
    const metaBoxY = y;
    doc.setFillColor(241, 245, 249); // #F1F5F9
    doc.setDrawColor(203, 213, 225); // #CBD5E1
    doc.roundedRect(M, metaBoxY, W, 34, 4, 4, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 84, 96);

    const dateStr = `Data: ${formatDate(r.visit_date)}`;
    const repStr = `Rep: ${r.meta.representante || "—"}`;
    const regStr = `Região: ${r.meta.regiao || "—"}`;
    const catStr = `Categoria: ${r.meta.categoria || "—"}`;

    const colWidth = W / 4;
    doc.text(dateStr, M + 10, metaBoxY + 21);
    doc.text(repStr, M + colWidth + 5, metaBoxY + 21);
    doc.text(regStr, M + colWidth * 2 + 5, metaBoxY + 21);
    doc.text(catStr, M + colWidth * 3 + 5, metaBoxY + 21);

    y = metaBoxY + 46;

    // Content Parsing
    const blocks = cleanMarkdownLines(r.content_markdown || "");

    for (const b of blocks) {
      if (b.type === "h1") {
        checkPageBreak(36);
        y += 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(6, 40, 56);
        const lns = doc.splitTextToSize(b.text, W);
        doc.text(lns, M, y);
        y += lns.length * 15 + 4;
      } else if (b.type === "h2") {
        checkPageBreak(30);
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(0, 141, 173);
        const lns = doc.splitTextToSize(b.text, W);
        doc.text(lns, M, y);
        y += lns.length * 14 + 3;
      } else if (b.type === "h3") {
        checkPageBreak(24);
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        const lns = doc.splitTextToSize(b.text, W);
        doc.text(lns, M, y);
        y += lns.length * 13 + 3;
      } else if (b.type === "bullet") {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        const bulletIndent = 14;
        const lns = doc.splitTextToSize(b.text, W - bulletIndent);
        checkPageBreak(lns.length * 12 + 4);
        doc.text("•", M + 2, y);
        doc.text(lns, M + bulletIndent, y);
        y += lns.length * 12 + 4;
      } else if (b.type === "quote") {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 84, 96);
        const quoteIndent = 12;
        const lns = doc.splitTextToSize(b.text, W - quoteIndent);
        const blockHeight = lns.length * 12 + 4;
        checkPageBreak(blockHeight);
        doc.setFillColor(0, 141, 173);
        doc.rect(M, y - 9, 2.5, blockHeight, "F");
        doc.text(lns, M + quoteIndent, y);
        y += blockHeight + 4;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        const lns = doc.splitTextToSize(b.text, W);
        checkPageBreak(lns.length * 12 + 4);
        doc.text(lns, M, y);
        y += lns.length * 12 + 5;
      }
    }
  });

  // Page Numbers in Footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(M, PH - 26, PW - M, PH - 26);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("PoolFlux · Visão Imersão 2", M, PH - 14);
    doc.text(`Página ${i} de ${totalPages}`, PW - M - 60, PH - 14);
  }

  const today = new Date().toISOString().slice(0, 10);
  const filename =
    reports.length === 1
      ? resolveReportFileName(reports[0], "pdf")
      : `visao-imersao-2-relatorios-consolidados-${today}.pdf`;

  doc.save(filename);
}

/**
 * Converte markdown básico em HTML estilizado para impressão.
 */
function markdownToHtml(md: string): string {
  if (!md) return "<p><em>Sem conteúdo gravado.</em></p>";

  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (t.startsWith("# ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1>${esc(t.slice(2))}</h1>`);
    } else if (t.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${esc(t.slice(3))}</h2>`);
    } else if (t.startsWith("### ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${esc(t.slice(4))}</h3>`);
    } else if (/^[-*+]\s+/.test(t)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      const item = t.replace(/^[-*+]\s+/, "");
      out.push(`<li>${esc(item)}</li>`);
    } else if (t.startsWith(">")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<blockquote>${esc(t.replace(/^>\s*/, ""))}</blockquote>`);
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${esc(t)}</p>`);
    }
  }

  if (inList) out.push("</ul>");
  return out.join("\n");
}

/**
 * Abre janela de impressão para salvar PDF nativamente com alta fidelidade.
 */
export function openVisaoImersao2PrintView(reports: VisaoImersao2ExportItem[]): void {
  if (!reports.length) return;

  const sections = reports
    .map((r) => {
      const date = formatDate(r.visit_date);
      const rep = r.meta.representante || "—";
      const reg = r.meta.regiao || "—";
      const cat = r.meta.categoria || "—";
      const htmlBody = markdownToHtml(r.content_markdown || "");

      return `
      <section class="report-section">
        <div class="report-header">
          <div class="brand">PoolFlux · Visão Imersão 2</div>
          <h1 class="client-title">${esc(r.client_name)}</h1>
          <div class="meta-pills">
            <div><strong>Data:</strong> ${esc(date)}</div>
            <div><strong>Representante:</strong> ${esc(rep)}</div>
            <div><strong>Região:</strong> ${esc(reg)}</div>
            <div><strong>Categoria:</strong> ${esc(cat)}</div>
          </div>
        </div>
        <div class="report-body">
          ${htmlBody}
        </div>
      </section>
      `;
    })
    .join("\n");

  const fullHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Visão Imersão 2 — Exportação (${reports.length} relatórios)</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 20mm 15mm;
    }
    @media print {
      .no-print { display: none !important; }
      .report-section { page-break-after: always; break-after: page; }
      body { padding: 0 !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      background: #F8FAFC;
      margin: 0;
      padding: 24px;
      line-height: 1.5;
    }
    .toolbar {
      position: sticky;
      top: 0;
      background: #062838;
      color: #FFFFFF;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 8px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
    }
    .toolbar button {
      background: #008DAD;
      color: #FFFFFF;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
    }
    .toolbar button:hover { background: #007791; }
    .report-section {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 32px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .report-header {
      border-bottom: 2px solid #E2E8F0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #008DAD;
      margin-bottom: 6px;
    }
    .client-title {
      font-size: 20px;
      font-weight: 700;
      color: #062838;
      margin: 0 0 12px 0;
    }
    .meta-pills {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px;
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 13px;
      color: #475569;
    }
    .meta-pills strong { color: #0F172A; }
    .report-body h1 {
      font-size: 15px;
      font-weight: 700;
      color: #062838;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 4px;
      margin-top: 24px;
    }
    .report-body h2 {
      font-size: 13.5px;
      font-weight: 600;
      color: #008DAD;
      margin-top: 18px;
    }
    .report-body h3 {
      font-size: 12.5px;
      font-weight: 600;
      color: #1E293B;
      margin-top: 14px;
    }
    .report-body p {
      font-size: 13px;
      color: #334155;
      line-height: 1.6;
      margin: 8px 0;
    }
    .report-body ul {
      font-size: 13px;
      color: #334155;
      padding-left: 20px;
      margin: 8px 0;
    }
    .report-body li { margin-bottom: 4px; }
    .report-body blockquote {
      border-left: 3px solid #008DAD;
      padding-left: 14px;
      margin: 12px 0;
      font-style: italic;
      color: #475569;
      background: #F8FAFC;
      padding-top: 4px;
      padding-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <span><strong>Visão Imersão 2</strong> • ${reports.length} relatório(s) pronto(s) para impressão</span>
    <button onclick="window.print()">Salvar como PDF / Imprimir</button>
  </div>
  ${sections}
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(fullHtml);
    w.document.close();
  }
}
