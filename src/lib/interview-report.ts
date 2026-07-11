import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { CLASSIFICACOES, TIPOS_EMPRESA } from "@/lib/interview-questions";

const CLASSIF = Object.fromEntries(CLASSIFICACOES.map((c) => [c.value, c.label]));
const TIPO = Object.fromEntries(TIPOS_EMPRESA.map((t) => [t.value, t.label]));

// Paleta editorial — navy profundo + cyan elétrico + neutros quentes
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

import { drawCover, loadCoverImage, DEFAULT_TITULO, type CoverFields } from "./interview-cover";

export async function exportInterviewPdf(interviewId: string, coverOverride?: Partial<CoverFields>) {
  const { data: interview } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", interviewId)
    .maybeSingle();
  if (!interview) throw new Error("Entrevista não encontrada");

  const [capsRes, respRes, notesRes, roteiroRes] = await Promise.all([
    interview.roteiro_id
      ? supabase
          .from("capitulos")
          .select("id, ordem, codigo, titulo, campos_matriz, lente_default, pergunta_abertura")
          .eq("roteiro_id", interview.roteiro_id)
          .order("ordem")
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("sessao_capitulos")
      .select("capitulo_id, resposta_texto, leitura_estrategica, sintese")
      .eq("sessao_id", interviewId),
    supabase
      .from("session_notes")
      .select("author_name, content, created_at")
      .eq("entity_type", "interview")
      .eq("entity_id", interviewId)
      .order("created_at"),
    interview.roteiro_id
      ? supabase.from("roteiros").select("nome").eq("id", interview.roteiro_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ]);

  const capitulos = capsRes.data ?? [];
  const respostas = respRes.data ?? [];
  const notes = notesRes.data ?? [];
  const roteiroNome = (roteiroRes as any)?.data?.nome ?? null;

  const respByCap = new Map(respostas.map((r: any) => [r.capitulo_id, r]));

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxW = pageW - margin * 2;
  let y = margin;

  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  // Sanitiza markdown vindo de relatórios (asteriscos, sublinhados, marcadores),
  // evitando que "**bold**" apareça literalmente no PDF.
  const md = (s?: string | null): string => {
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
  };

  const contentBottom = () => pageH - margin - 44;

  const ensure = (n: number) => {
    if (y + n > contentBottom()) {
      addContentPage();
    }
  };

  const write = (
    text: string,
    size = 10,
    style: "normal" | "bold" | "italic" = "normal",
    color: [number, number, number] = INK,
    opts: { width?: number; x?: number; lineHeight?: number } = {},
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    setText(color);
    const w = opts.width ?? maxW;
    const x = opts.x ?? margin;
    const lh = opts.lineHeight ?? size * 1.35;
    const lines = doc.splitTextToSize(text || "—", w);
    for (const l of lines) {
      ensure(lh);
      doc.text(l, x, y);
      y += lh;
    }
  };
  // ————————————————————————— CAPA (modelo "Visão de Mercado") —————————————————————————
  // Paleta específica da capa — replica fiel da referência
  const coverImg = await loadCoverImage();
  const coverFields: CoverFields = {
    data:
      coverOverride?.data ??
      (interview.data_entrevista
        ? new Date(interview.data_entrevista).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })
        : new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })),
    titulo: coverOverride?.titulo ?? DEFAULT_TITULO,
    entrevistado: coverOverride?.entrevistado ?? interview.entrevistado_nome ?? "—",
    modelo: coverOverride?.modelo ?? roteiroNome ?? "—",
  };
  drawCover(doc, coverImg, coverFields);




  // ————————————————————————— PÁGINA DE ABERTURA / SUMÁRIO —————————————————————————
  const addContentPage = () => {
    doc.addPage();
    setFill(CREAM);
    doc.rect(0, 0, pageW, pageH, "F");
    // faixa lateral
    setFill(NAVY);
    doc.rect(0, 0, 6, pageH, "F");
    setFill(CYAN);
    doc.rect(0, 0, 6, 120, "F");
    y = margin + 10;
  };


  const writeCalloutBlock = (label: string, value?: string | null) => {
    const text = md(value);
    if (!text) return;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const lineH = 16;
    const lines = doc.splitTextToSize(text, maxW - 40);
    let index = 0;
    let continued = false;

    while (index < lines.length) {
      ensure(70);
      const headerH = 44;
      let availableLines = Math.floor((contentBottom() - y - headerH - 12) / lineH);
      if (availableLines < 1) {
        addContentPage();
        availableLines = Math.floor((contentBottom() - y - headerH - 12) / lineH);
      }

      const chunk = lines.slice(index, index + Math.max(1, availableLines));
      const blockH = headerH + chunk.length * lineH + 12;

      setFill(HIGHLIGHT);
      doc.roundedRect(margin, y, maxW, blockH, 6, 6, "F");
      setFill(CYAN);
      doc.rect(margin, y, 4, blockH, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(CYAN_DEEP);
      doc.text(continued ? `${label} · CONTINUAÇÃO` : label, margin + 20, y + 22, {
        charSpace: 1.5,
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      setText(INK);
      let ly = y + 44;
      for (const line of chunk) {
        doc.text(line, margin + 20, ly);
        ly += lineH;
      }

      index += chunk.length;
      y += blockH + 20;
      continued = true;
      if (index < lines.length) addContentPage();
    }
  };

  const writeMatrixField = (label: string, value?: string | null) => {
    const text = md(value) || "—";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lineH = 13;
    const lines = doc.splitTextToSize(text, maxW - 24);
    let index = 0;
    let continued = false;

    while (index < lines.length) {
      ensure(52);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const rawLabel = `${label}${continued ? " (continuação)" : ""}`
        .toUpperCase()
        .replace(/_/g, " ");
      const labelLines = doc.splitTextToSize(rawLabel, maxW - 24).slice(0, 2);
      const labelH = 18 + labelLines.length * 11;
      let availableLines = Math.floor((contentBottom() - y - labelH - 12) / lineH);
      if (availableLines < 1) {
        addContentPage();
        availableLines = Math.floor((contentBottom() - y - labelH - 12) / lineH);
      }

      const chunk = lines.slice(index, index + Math.max(1, availableLines));
      const rowH = Math.max(42, labelH + chunk.length * lineH + 12);

      setFill(CORAL);
      doc.rect(margin, y + 4, 3, rowH - 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setText(NAVY);
      let labelY = y + 16;
      for (const line of labelLines) {
        doc.text(line, margin + 12, labelY, { charSpace: 0.8 });
        labelY += 11;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      setText(INK);
      let ly = y + labelH;
      for (const line of chunk) {
        doc.text(line, margin + 12, ly);
        ly += lineH;
      }

      y += rowH + 4;
      setDraw(HAIRLINE);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + maxW, y);
      y += 4;
      index += chunk.length;
      continued = true;
      if (index < lines.length) addContentPage();
    }
  };

  addContentPage();

  // Eyebrow
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(CYAN_DEEP);
  doc.text("SUMÁRIO EXECUTIVO", margin, y, { charSpace: 2 });
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  setText(NAVY);
  write("O que esta entrevista revela.", 28, "bold", NAVY);
  y += 6;

  // Linha decorativa
  setDraw(CORAL);
  doc.setLineWidth(3);
  doc.line(margin, y, margin + 48, y);
  y += 20;

  // Ficha em cartão
  const fichaTop = y;
  setFill([255, 255, 255]);
  const fichaH = 140;
  doc.roundedRect(margin, fichaTop, maxW, fichaH, 8, 8, "F");
  setDraw(HAIRLINE);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, fichaTop, maxW, fichaH, 8, 8, "S");

  const fichaItems: [string, string][] = [
    ["ENTREVISTADO", interview.entrevistado_nome ?? "—"],
    [
      "CLASSIFICAÇÃO",
      `${CLASSIF[interview.entrevistado_classificacao] ?? "—"}${interview.entrevistado_classificacao_outro ? " · " + interview.entrevistado_classificacao_outro : ""}`,
    ],
    ["EMPRESA", interview.empresa_nome ?? "—"],
    [
      "TIPO",
      interview.empresa_tipo ? (TIPO[interview.empresa_tipo] ?? interview.empresa_tipo) : "—",
    ],
    ["LOCAL", [interview.cidade, interview.estado].filter(Boolean).join(" / ") || "—"],
    [
      "DATA",
      interview.data_entrevista
        ? new Date(interview.data_entrevista).toLocaleDateString("pt-BR")
        : "—",
    ],
  ];
  const gridCols = 3;
  const cellW = (maxW - 32) / gridCols;
  fichaItems.forEach((it, idx) => {
    const col = idx % gridCols;
    const row = Math.floor(idx / gridCols);
    const cx = margin + 16 + col * cellW;
    const cy = fichaTop + 24 + row * 56;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText(MUTED);
    doc.text(it[0], cx, cy, { charSpace: 1.2 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setText(INK);
    const v = doc.splitTextToSize(it[1], cellW - 8);
    doc.text(v[0] ?? "—", cx, cy + 18);
    if (v[1]) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(v[1], cx, cy + 32);
    }
  });
  y = fichaTop + fichaH + 28;

  // Sumário de capítulos
  if (capitulos.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN_DEEP);
    write("NAVEGAÇÃO", 9, "bold", CYAN_DEEP);
    y += 4;
    setDraw(HAIRLINE);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + maxW, y);
    y += 12;

    capitulos.forEach((cap: any) => {
      ensure(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      setText(CORAL);
      const numStr = String(cap.ordem).padStart(2, "0");
      doc.text(numStr, margin, y + 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      setText(NAVY);
      doc.text(cap.titulo, margin + 44, y);

      if (cap.lente_default) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setText(MUTED);
        doc.text(`lente · ${cap.lente_default}`, margin + 44, y + 12, { charSpace: 0.5 });
      }

      setDraw(HAIRLINE);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 22, margin + maxW, y + 22);
      y += 30;
    });
  }

  // ————————————————————————— PANORAMA (dashboard visual) —————————————————————————
  const totalCaps = capitulos.length;
  const capsRespondidos = capitulos.filter((c: any) => {
    const r: any = respByCap.get(c.id);
    return !!(
      r?.leitura_estrategica?.trim() ||
      r?.resposta_texto?.trim() ||
      (r?.sintese && Object.values(r.sintese as Record<string, string>).some((v) => v?.trim()))
    );
  }).length;
  const pctRespondidos = totalCaps ? Math.round((capsRespondidos / totalCaps) * 100) : 0;
  let campoTotal = 0;
  let campoFilled = 0;
  for (const c of capitulos as any[]) {
    const campos: string[] = Array.isArray(c.campos_matriz) ? c.campos_matriz : [];
    const r: any = respByCap.get(c.id);
    const s = (r?.sintese ?? {}) as Record<string, string>;
    campoTotal += campos.length;
    for (const k of campos) if (s[k]?.trim()) campoFilled++;
  }

  if (totalCaps) {
    addContentPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN_DEEP);
    doc.text("PANORAMA", margin, y, { charSpace: 2 });
    y += 22;
    write("Sinais em foco.", 28, "bold", NAVY);
    y += 4;
    setDraw(CORAL);
    doc.setLineWidth(3);
    doc.line(margin, y, margin + 48, y);
    y += 28;

    // Card 1 — Cobertura da entrevista (anel + % gigante)
    const cardTop = y;
    const cardH = 240;
    setFill([255, 255, 255]);
    doc.roundedRect(margin, cardTop, maxW, cardH, 10, 10, "F");
    setDraw(HAIRLINE);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, cardTop, maxW, cardH, 10, 10, "S");

    // Anel de progresso (aprox por segmentos de linha)
    const ringCx = margin + 130;
    const ringCy = cardTop + cardH / 2;
    const ringR = 78;
    setDraw(HAIRLINE);
    doc.setLineWidth(10);
    doc.circle(ringCx, ringCy, ringR, "S");
    setDraw(CYAN);
    doc.setLineWidth(10);
    const steps = 96;
    const filledSteps = Math.round((pctRespondidos / 100) * steps);
    for (let i = 0; i < filledSteps; i++) {
      const a1 = -Math.PI / 2 + (i / steps) * Math.PI * 2;
      const a2 = -Math.PI / 2 + ((i + 1) / steps) * Math.PI * 2;
      doc.line(
        ringCx + Math.cos(a1) * ringR,
        ringCy + Math.sin(a1) * ringR,
        ringCx + Math.cos(a2) * ringR,
        ringCy + Math.sin(a2) * ringR,
      );
    }
    // % no centro
    doc.setFont("helvetica", "bold");
    doc.setFontSize(36);
    setText(NAVY);
    const pctStr = `${pctRespondidos}%`;
    const pctW = doc.getTextWidth(pctStr);
    doc.text(pctStr, ringCx - pctW / 2, ringCy + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText(MUTED);
    const subStr = "COBERTURA";
    const subW = doc.getTextWidth(subStr);
    doc.text(subStr, ringCx - subW / 2, ringCy + 22, { charSpace: 1.2 });

    // Texto à direita
    const txtX = margin + 250;
    const txtW = maxW - 270;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(CYAN_DEEP);
    doc.text("DE COBERTURA DOS CAPÍTULOS", txtX, cardTop + 60, { charSpace: 1.5 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    setText(INK);
    const t1 = doc.splitTextToSize(
      `${capsRespondidos} de ${totalCaps} capítulos com leitura estratégica registrada nesta sessão.`,
      txtW,
    );
    let t1y = cardTop + 88;
    for (const l of t1.slice(0, 4)) {
      doc.text(l, txtX, t1y);
      t1y += 26;
    }
    y = cardTop + cardH + 20;

    // Card 2 — Insights capturados (número gigante à esquerda, texto à direita, à la Google)
    if (campoTotal) {
      const c2Top = y;
      const c2H = 200;
      ensure(c2H + 20);
      setFill(NAVY);
      doc.roundedRect(margin, c2Top, maxW, c2H, 10, 10, "F");
      // faixa de destaque
      setFill(CORAL);
      doc.roundedRect(margin, c2Top, 8, c2H, 10, 10, "F");
      doc.rect(margin + 4, c2Top, 4, c2H, "F");

      const bigStr = `${campoFilled}`;
      doc.setFont("helvetica", "bold");
      let bigSize = 120;
      doc.setFontSize(bigSize);
      while (doc.getTextWidth(bigStr) > 170 && bigSize > 56) {
        bigSize -= 8;
        doc.setFontSize(bigSize);
      }
      setText(CYAN);
      doc.text(bigStr, margin + 40, c2Top + c2H / 2 + 40);
      const bigW = doc.getTextWidth(bigStr);

      const tx2 = margin + 40 + bigW + 30;
      const tw2 = maxW - (tx2 - margin) - 20;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText([160, 205, 220]);
      doc.text("DE UM TOTAL DE " + campoTotal, tx2, c2Top + 60, { charSpace: 1.5 });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      setText([255, 255, 255]);
      const t2 = doc.splitTextToSize(
        "campos de síntese objetiva capturados em campo — sinais concretos que sustentam a leitura.",
        tw2,
      );
      let t2y = c2Top + 92;
      for (const l of t2.slice(0, 4)) {
        doc.text(l, tx2, t2y);
        t2y += 26;
      }
      y = c2Top + c2H + 20;
    }
  }

  // ————————————————————————— CAPÍTULOS —————————————————————————
  for (const cap of capitulos) {
    addContentPage();
    const r: any = respByCap.get(cap.id);

    // Watermark do número — desenhado PRIMEIRO, como fundo, sem colidir com o header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(130);
    setText([236, 240, 247]);
    const wmStr = String(cap.ordem).padStart(2, "0");
    const wmW = doc.getTextWidth(wmStr);
    doc.text(wmStr, pageW - margin - wmW + 24, 178);

    // Eyebrow
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN_DEEP);
    doc.text(`CAPÍTULO ${String(cap.ordem).padStart(2, "0")}`, margin, y, { charSpace: 2 });
    y += 34;

    // Título — largura reduzida para não invadir o watermark à direita
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    setText(NAVY);
    const titleW = maxW - 140;
    const tl = doc.splitTextToSize(cap.titulo, titleW);
    for (const l of tl) {
      ensure(32);
      doc.text(l, margin, y);
      y += 32;
    }
    y += 6;

    // Lente badge
    if (cap.lente_default) {
      const badge = `LENTE · ${String(cap.lente_default).toUpperCase()}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const bw = doc.getTextWidth(badge) + 16;
      setFill(NAVY);
      doc.roundedRect(margin, y, bw, 18, 9, 9, "F");
      setText([255, 255, 255]);
      doc.text(badge, margin + 8, y + 12, { charSpace: 1.2 });
      y += 26;
    }

    setDraw(CORAL);
    doc.setLineWidth(2);
    doc.line(margin, y, margin + 48, y);
    y += 22;

    // Pergunta de abertura
    if (cap.pergunta_abertura) {
      write(`"${md(cap.pergunta_abertura)}"`, 13, "italic", NAVY_SOFT);
      y += 10;
    }

    // Leitura estratégica — destaque em bloco cyan
    if (r?.leitura_estrategica?.trim())
      writeCalloutBlock("LEITURA ESTRATÉGICA", r.leitura_estrategica);

    // Evidência / anotações
    if (r?.resposta_texto?.trim()) {
      ensure(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(MUTED);
      write("EVIDÊNCIA · ANOTAÇÕES DE CAMPO", 8, "bold", MUTED);
      y += 2;
      setDraw(HAIRLINE);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + 60, y);
      y += 12;
      write(md(r.resposta_texto), 11, "normal", INK);
      y += 12;
    }

    // Síntese objetiva — grid de campos
    const campos: string[] = Array.isArray(cap.campos_matriz) ? cap.campos_matriz : [];
    const sintese = (r?.sintese ?? {}) as Record<string, string>;
    if (campos.length) {
      ensure(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(MUTED);
      write("SÍNTESE OBJETIVA", 8, "bold", MUTED);
      y += 2;
      setDraw(HAIRLINE);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + 60, y);
      y += 10;

      for (const c of campos) writeMatrixField(c, sintese[c]);
    }
  }

  // ————————————————————————— ANOTAÇÕES —————————————————————————
  if (notes.length) {
    addContentPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN_DEEP);
    doc.text("APÊNDICE", margin, y, { charSpace: 2 });
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    setText(NAVY);
    doc.text("Anotações da sessão", margin, y);
    y += 12;
    setDraw(CORAL);
    doc.setLineWidth(3);
    doc.line(margin, y, margin + 48, y);
    y += 24;

    for (const n of notes) {
      ensure(50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(MUTED);
      doc.text(
        `${new Date(n.created_at).toLocaleString("pt-BR")}  ·  ${n.author_name ?? "—"}`.toUpperCase(),
        margin,
        y,
        { charSpace: 1 },
      );
      y += 14;
      write(md(n.content), 11, "normal", INK);
      y += 12;
      setDraw(HAIRLINE);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + maxW, y);
      y += 12;
    }
  }

  if (interview.observacoes) {
    addContentPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(CYAN_DEEP);
    doc.text("OBSERVAÇÕES", margin, y, { charSpace: 2 });
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    setText(NAVY);
    doc.text("Notas do entrevistador", margin, y);
    y += 12;
    setDraw(CORAL);
    doc.setLineWidth(3);
    doc.line(margin, y, margin + 48, y);
    y += 24;
    write(md(interview.observacoes), 11, "normal", INK);
  }

  // ————————————————————————— HEADER / FOOTER ——————————————————————
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    // header sutil
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText(MUTED);
    doc.text("POOLFLUX  ·  RELATÓRIO DE ENTREVISTA", margin, 30, { charSpace: 1.5 });
    setText(NAVY);
    doc.text((interview.entrevistado_nome ?? "").toUpperCase(), pageW - margin, 30, {
      align: "right",
      charSpace: 1.2,
    });
    setDraw(HAIRLINE);
    doc.setLineWidth(0.4);
    doc.line(margin, 38, pageW - margin, 38);

    // footer
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

  const safe = (interview.entrevistado_nome || "entrevista")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  doc.save(`entrevista-${safe}.pdf`);
}
