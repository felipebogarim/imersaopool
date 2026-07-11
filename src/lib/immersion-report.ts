import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

type Chapter = { title: string; blocks: { label?: string; text: string }[] };

const NAVY: [number, number, number] = [10, 20, 44];
const NAVY_SOFT: [number, number, number] = [30, 44, 78];
const CYAN: [number, number, number] = [56, 189, 220];
const CYAN_DEEP: [number, number, number] = [14, 116, 144];
const CORAL: [number, number, number] = [244, 114, 94];
const INK: [number, number, number] = [20, 24, 36];
const MUTED: [number, number, number] = [110, 120, 138];
const HAIRLINE: [number, number, number] = [220, 226, 236];
const CREAM: [number, number, number] = [248, 246, 240];
const HIGHLIGHT: [number, number, number] = [235, 248, 251];

function md(s?: string | null): string {
  if (!s) return "";
  return String(s)
    .replace(/\r\n?/g, "\n")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "$1")
    .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "• ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchImmersionData(immersionId: string) {
  const [imm, repInputs, fieldInputs, ai, actions] = await Promise.all([
    supabase.from("immersions").select("*, client:clients(nome_fantasia, grupo, categoria, cidade, estado, nome_comprador, telefone, email), representative:representatives(nome, email)").eq("id", immersionId).single(),
    supabase.from("representative_inputs").select("*").eq("immersion_id", immersionId).order("created_at"),
    supabase.from("field_visit_inputs").select("*").eq("immersion_id", immersionId).order("created_at"),
    supabase.from("ai_compilations").select("*").eq("immersion_id", immersionId).order("created_at"),
    supabase.from("action_plans").select("*").eq("immersion_id", immersionId).order("prioridade"),
  ]);
  return {
    immersion: imm.data,
    repInputs: repInputs.data ?? [],
    fieldInputs: fieldInputs.data ?? [],
    ai: ai.data ?? [],
    actions: actions.data ?? [],
  };
}

function buildChapters(d: Awaited<ReturnType<typeof fetchImmersionData>>): Chapter[] {
  const chapters: Chapter[] = [];
  const i = d.immersion;
  if (!i) return chapters;

  chapters.push({
    title: "1. Identificação",
    blocks: [
      { label: "Título", text: i.titulo },
      { label: "Cliente", text: i.client?.nome_fantasia ?? "—" },
      { label: "Grupo / Categoria", text: [i.client?.grupo, i.client?.categoria].filter(Boolean).join(" / ") || "—" },
      { label: "Localização", text: [i.client?.cidade, i.client?.estado].filter(Boolean).join(", ") || "—" },
      { label: "Comprador", text: i.client?.nome_comprador ?? "—" },
      { label: "Representante", text: i.representative?.nome ?? "—" },
      { label: "Data da visita", text: i.data_visita ? new Date(i.data_visita).toLocaleDateString("pt-BR") : "—" },
      { label: "Status", text: String(i.status) },
      { label: "Observações", text: i.observacoes || "—" },
    ],
  });

  if (d.repInputs.length) {
    const r = d.repInputs[0];
    chapters.push({
      title: "2. Percepções do representante",
      blocks: [
        { label: "Percepção da marca", text: r.percepcao_marca || "—" },
        { label: "Famílias mais compradas", text: r.familias_mais_compradas || "—" },
        { label: "Motivo de compra", text: r.motivo_compra || "—" },
        { label: "Potencial de aumento", text: r.potencial_aumento || "—" },
        { label: "Marcas concorrentes", text: r.marcas_concorrentes || "—" },
        { label: "Oportunidades", text: r.oportunidades || "—" },
        { label: "Ameaças", text: r.ameacas || "—" },
        { label: "Ações para faturamento", text: r.acoes_faturamento || "—" },
        { label: "Cuidados", text: r.cuidados || "—" },
        { label: "Abordagem diferente", text: r.abordagem_diferente || "—" },
        { label: "Perfil do comprador", text: r.perfil_comprador || "—" },
        { label: "Negociação", text: r.negociacao || "—" },
        { label: "Observações livres", text: r.texto_livre || "—" },
      ],
    });
  }

  if (d.fieldInputs.length) {
    chapters.push({
      title: "3. Visita em campo",
      blocks: d.fieldInputs.flatMap((f: any) => [
        { label: `Escopo: ${f.scope}`, text: f.texto || "—" },
        ...(f.observacoes_loja ? [{ label: "Observações da loja", text: f.observacoes_loja }] : []),
        ...(f.observacoes_exposicao ? [{ label: "Exposição", text: f.observacoes_exposicao }] : []),
        ...(f.observacoes_concorrentes ? [{ label: "Concorrentes", text: f.observacoes_concorrentes }] : []),
        ...(f.observacoes_comerciais ? [{ label: "Comercial", text: f.observacoes_comerciais }] : []),
        ...(f.oportunidades ? [{ label: "Oportunidades", text: f.oportunidades }] : []),
      ]),
    });
  }

  if (d.ai.length) {
    chapters.push({
      title: "4. Diagnóstico IA",
      blocks: d.ai.map((a: any) => ({
        label: String(a.tipo),
        text: typeof a.conteudo === "string" ? a.conteudo : JSON.stringify(a.conteudo, null, 2),
      })),
    });
  }

  if (d.actions.length) {
    chapters.push({
      title: "5. Plano de ação",
      blocks: d.actions.map((a: any, idx: number) => ({
        label: `${idx + 1}. [${a.prioridade}] ${a.acao}`,
        text: [
          a.responsavel ? `Responsável: ${a.responsavel}` : null,
          a.prazo ? `Prazo: ${new Date(a.prazo).toLocaleDateString("pt-BR")}` : null,
          `Status: ${a.status}`,
          a.observacoes ? `Obs.: ${a.observacoes}` : null,
        ].filter(Boolean).join(" · "),
      })),
    });
  }

  return chapters;
}

export async function generateImmersionPdf(immersionId: string): Promise<{ blob: Blob; filename: string; title: string }> {
  const data = await fetchImmersionData(immersionId);
  if (!data.immersion) throw new Error("Imersão não encontrada");
  const chapters = buildChapters(data);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxW = pageW - margin * 2;
  let y = margin;

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
  const contentBottom = () => pageH - margin - 44;

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

  const ensureSpace = (needed: number) => {
    if (y + needed > contentBottom()) addContentPage();
  };

  const writeText = (
    text: string,
    size: number,
    style: "normal" | "bold" | "italic" = "normal",
    color: [number, number, number] = INK,
    opts: { width?: number; x?: number; lineHeight?: number } = {},
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    setText(color);
    const width = opts.width ?? maxW;
    const x = opts.x ?? margin;
    const lineH = opts.lineHeight ?? size * 1.35;
    const paragraphs = String(text || "—").split("\n");
    for (const paragraph of paragraphs) {
      const lines = paragraph.trim() ? doc.splitTextToSize(paragraph, width) : [""];
      for (const line of lines) {
        ensureSpace(lineH);
        if (line) doc.text(line, x, y);
        y += lineH;
      }
    }
  };

  const writeBox = (label: string | undefined, value: string) => {
    const text = md(value) || "—";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lineH = 14;
    const textW = maxW - 34;
    const lines = doc.splitTextToSize(text, textW);
    let index = 0;
    let continued = false;

    while (index < lines.length) {
      ensureSpace(58);
      const labelText = label ? `${label}${continued ? " · continuação" : ""}` : continued ? "continuação" : "registro";
      const labelH = 28;
      let availableLines = Math.floor((contentBottom() - y - labelH - 14) / lineH);
      if (availableLines < 1) {
        addContentPage();
        availableLines = Math.floor((contentBottom() - y - labelH - 14) / lineH);
      }

      const chunk = lines.slice(index, index + Math.max(1, availableLines));
      const boxH = Math.max(54, labelH + chunk.length * lineH + 14);
      setFill([255, 255, 255]);
      doc.roundedRect(margin, y, maxW, boxH, 7, 7, "F");
      setDraw(HAIRLINE);
      doc.setLineWidth(0.45);
      doc.roundedRect(margin, y, maxW, boxH, 7, 7, "S");
      setFill(CORAL);
      doc.rect(margin, y + 8, 3, boxH - 16, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(CYAN_DEEP);
      doc.text(labelText.toUpperCase(), margin + 18, y + 20, { charSpace: 1.1 });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      setText(INK);
      let ly = y + 40;
      for (const line of chunk) {
        doc.text(line, margin + 18, ly);
        ly += lineH;
      }

      index += chunk.length;
      y += boxH + 10;
      continued = true;
      if (index < lines.length) addContentPage();
    }
  };

  // Capa
  setFill(NAVY);
  doc.rect(0, 0, pageW, pageH, "F");
  setFill(CYAN_DEEP);
  doc.rect(0, pageH - 260, pageW, 260, "F");
  setFill(CYAN);
  doc.rect(0, pageH - 260, pageW * 0.55, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(CYAN);
  doc.text("POOLFLUX  ·  IMERSÃO COMERCIAL", margin, 90, { charSpace: 2 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(42);
  setText([255, 255, 255]);
  let titleY = 210;
  const titleLines = doc.splitTextToSize(data.immersion.titulo || "Relatório de Imersão", maxW);
  for (const line of titleLines.slice(0, 4)) {
    doc.text(line, margin, titleY);
    titleY += 48;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(18);
  setText(CYAN);
  doc.text(data.immersion.client?.nome_fantasia ?? "Cliente não informado", margin, titleY + 8);

  const metaY = pageH - 210;
  const metaCols = [
    ["STATUS", String(data.immersion.status ?? "—")],
    ["REPRESENTANTE", data.immersion.representative?.nome ?? "—"],
    ["LOCAL", [data.immersion.client?.cidade, data.immersion.client?.estado].filter(Boolean).join(" / ") || "—"],
    ["DATA", data.immersion.data_visita ? new Date(data.immersion.data_visita).toLocaleDateString("pt-BR") : "—"],
  ];
  const colW = maxW / metaCols.length;
  metaCols.forEach(([label, value], i) => {
    const x = margin + colW * i;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText([160, 205, 220]);
    doc.text(label, x, metaY, { charSpace: 1.2 });
    doc.setFontSize(12);
    setText([255, 255, 255]);
    doc.text(doc.splitTextToSize(String(value), colW - 12)[0] ?? "—", x, metaY + 22);
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText([200, 220, 232]);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, pageW - margin, pageH - 60, { align: "right" });

  const filledBlocks = chapters.reduce((acc, c) => acc + c.blocks.filter((b) => md(b.text) && md(b.text) !== "—").length, 0);
  const totalBlocks = chapters.reduce((acc, c) => acc + c.blocks.length, 0);
  const chapterCoverage = chapters.length ? Math.round((chapters.filter((c) => c.blocks.some((b) => md(b.text) && md(b.text) !== "—")).length / chapters.length) * 100) : 0;

  // Panorama
  addContentPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(CYAN_DEEP);
  doc.text("PANORAMA", margin, y, { charSpace: 2 });
  y += 22;
  writeText("Dossiê da imersão.", 28, "bold", NAVY);
  y += 4;
  setDraw(CORAL);
  doc.setLineWidth(3);
  doc.line(margin, y, margin + 48, y);
  y += 26;

  const cardTop = y;
  const cardH = 224;
  setFill([255, 255, 255]);
  doc.roundedRect(margin, cardTop, maxW, cardH, 10, 10, "F");
  setDraw(HAIRLINE);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, cardTop, maxW, cardH, 10, 10, "S");

  const ringCx = margin + 125;
  const ringCy = cardTop + cardH / 2;
  const ringR = 70;
  setDraw(HAIRLINE);
  doc.setLineWidth(10);
  doc.circle(ringCx, ringCy, ringR, "S");
  setDraw(CYAN);
  doc.setLineWidth(10);
  const steps = 88;
  const filledSteps = Math.round((chapterCoverage / 100) * steps);
  for (let i = 0; i < filledSteps; i++) {
    const a1 = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    const a2 = -Math.PI / 2 + ((i + 1) / steps) * Math.PI * 2;
    doc.line(ringCx + Math.cos(a1) * ringR, ringCy + Math.sin(a1) * ringR, ringCx + Math.cos(a2) * ringR, ringCy + Math.sin(a2) * ringR);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  setText(NAVY);
  const pct = `${chapterCoverage}%`;
  doc.text(pct, ringCx - doc.getTextWidth(pct) / 2, ringCy + 6);
  doc.setFontSize(7.5);
  setText(MUTED);
  const cov = "COBERTURA";
  doc.text(cov, ringCx - doc.getTextWidth(cov) / 2, ringCy + 22, { charSpace: 1.2 });

  const tx = margin + 245;
  const tw = maxW - 270;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(CYAN_DEEP);
  doc.text("CAPÍTULOS E SINAIS REGISTRADOS", tx, cardTop + 58, { charSpace: 1.4 });
  doc.setFontSize(20);
  setText(INK);
  const msg = doc.splitTextToSize(`${chapters.length} capítulos organizados com ${filledBlocks} registros preenchidos de ${totalBlocks} campos disponíveis.`, tw);
  let msgY = cardTop + 88;
  for (const line of msg.slice(0, 4)) {
    doc.text(line, tx, msgY);
    msgY += 25;
  }
  y = cardTop + cardH + 18;

  const statTop = y;
  const statH = 170;
  setFill(NAVY);
  doc.roundedRect(margin, statTop, maxW, statH, 10, 10, "F");
  setFill(CORAL);
  doc.roundedRect(margin, statTop, 8, statH, 10, 10, "F");
  doc.rect(margin + 4, statTop, 4, statH, "F");
  const big = String(filledBlocks);
  doc.setFont("helvetica", "bold");
  let bigSize = 96;
  doc.setFontSize(bigSize);
  while (doc.getTextWidth(big) > 150 && bigSize > 52) {
    bigSize -= 8;
    doc.setFontSize(bigSize);
  }
  setText(CYAN);
  doc.text(big, margin + 38, statTop + 112);
  const bigW = doc.getTextWidth(big);
  const stx = margin + 38 + bigW + 34;
  doc.setFontSize(8);
  setText([160, 205, 220]);
  doc.text("REGISTROS ÚTEIS", stx, statTop + 56, { charSpace: 1.5 });
  doc.setFontSize(20);
  setText([255, 255, 255]);
  const statText = doc.splitTextToSize("pontos de evidência para orientar leitura comercial, oportunidades e plano de ação.", maxW - (stx - margin) - 24);
  let sty = statTop + 86;
  for (const line of statText.slice(0, 3)) {
    doc.text(line, stx, sty);
    sty += 24;
  }
  y = statTop + statH + 24;

  // Sumário
  ensureSpace(80);
  writeText("Navegação", 12, "bold", CYAN_DEEP);
  y += 4;
  setDraw(HAIRLINE);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + maxW, y);
  y += 12;
  chapters.forEach((c, idx) => {
    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    setText(CORAL);
    doc.text(String(idx + 1).padStart(2, "0"), margin, y + 4);
    doc.setFontSize(11);
    setText(NAVY);
    doc.text(c.title.replace(/^\d+\.\s*/, ""), margin + 44, y);
    setDraw(HAIRLINE);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 20, margin + maxW, y + 20);
    y += 28;
  });

  // Capítulos
  for (const [idx, c] of chapters.entries()) {
    addContentPage();
    const number = String(idx + 1).padStart(2, "0");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(116);
    setText([236, 240, 247]);
    const wmW = doc.getTextWidth(number);
    doc.text(number, pageW - margin - wmW + 22, 170);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN_DEEP);
    doc.text(`CAPÍTULO ${number}`, margin, y, { charSpace: 2 });
    y += 32;
    writeText(c.title.replace(/^\d+\.\s*/, ""), 25, "bold", NAVY, { width: maxW - 140, lineHeight: 31 });
    y += 6;
    setDraw(CORAL);
    doc.setLineWidth(2);
    doc.line(margin, y, margin + 48, y);
    y += 22;

    for (const b of c.blocks) {
      writeBox(b.label, b.text);
    }
  }

  // Numeração
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (p > 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setText(MUTED);
      doc.text("POOLFLUX  ·  RELATÓRIO DE IMERSÃO", margin, 30, { charSpace: 1.5 });
      setDraw(HAIRLINE);
      doc.setLineWidth(0.4);
      doc.line(margin, 38, pageW - margin, 38);
    }
    setDraw(HAIRLINE);
    doc.line(margin, pageH - 32, pageW - margin, pageH - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(MUTED);
    doc.text("Inteligência comercial · confidencial", margin, pageH - 18);
    doc.setFont("helvetica", "bold");
    setText(NAVY);
    doc.text(`${String(p).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, pageW - margin, pageH - 18, { align: "right" });
  }

  const blob = doc.output("blob");
  const safe = (data.immersion.titulo || "imersao").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    blob,
    filename: `relatorio-${safe}.pdf`,
    title: `Relatório — ${data.immersion.titulo}`,
  };
}

async function shareOrDownload(blob: Blob, filename: string, title: string, fallbackUrl: string) {
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title, text: title }); return; } catch { /* user cancelled */ }
  }
  // Fallback: download + open link
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  window.open(fallbackUrl, "_blank");
}

export async function shareImmersionByEmail(immersionId: string) {
  const { blob, filename, title } = await generateImmersionPdf(immersionId);
  const subject = encodeURIComponent(title);
  const body = encodeURIComponent(`Segue em anexo o relatório da imersão comercial.\n\n(${filename})`);
  await shareOrDownload(blob, filename, title, `mailto:?subject=${subject}&body=${body}`);
}

export async function shareImmersionByWhatsapp(immersionId: string) {
  const { blob, filename, title } = await generateImmersionPdf(immersionId);
  const text = encodeURIComponent(`${title}\nSegue em anexo o relatório (${filename}).`);
  await shareOrDownload(blob, filename, title, `https://wa.me/?text=${text}`);
}
