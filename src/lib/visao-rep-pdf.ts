// Exporta o relatório completo da Visão Rep (raio-x + paralelo + performance) em PDF.
// Padrão visual PoolFlux: fundo azul-claro, cartões, acento ciano e tipografia da interface.
import jsPDF from "jspdf";
import { LENTE_DEF, type Lente } from "@/lib/insight-lentes";
import { fmtPct, fmtPp, type ParaleloRep, type PerfResumo, type RaioXLente } from "@/lib/visao-rep";

type RGB = [number, number, number];

/** Tokens do design system convertidos de OKLCH (src/styles.css) para RGB. */
const C = {
  background: [225, 233, 239] as RGB,
  card: [240, 246, 250] as RGB,
  muted: [215, 223, 229] as RGB,
  border: [181, 191, 198] as RGB,
  foreground: [14, 28, 40] as RGB,
  mutedFg: [71, 84, 96] as RGB,
  primary: [0, 141, 173] as RGB,
  primaryDeep: [6, 40, 56] as RGB,
  success: [0, 148, 77] as RGB,
  warning: [215, 141, 0] as RGB,
  compare: [230, 140, 44] as RGB,
  white: [255, 255, 255] as RGB,
};

type Opts = {
  repNome: string;
  regiao?: string | null;
  leitura: string;
  intro: string;
  raiox: RaioXLente[];
  paralelo: ParaleloRep | null;
  perf: PerfResumo | null;
};

export function exportVisaoRepPdf({ repNome, regiao, leitura, intro, raiox, paralelo, perf }: Opts) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  const PW = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const W = PW - M * 2;
  const BOTTOM = H - M - 22;
  let y = M;

  const paintBg = () => {
    doc.setFillColor(...C.background);
    doc.rect(0, 0, PW, H, "F");
  };

  const newPage = () => {
    doc.addPage();
    paintBg();
    y = M;
  };

  const br = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };

  /** Mede quantas linhas o texto ocupa numa largura. */
  const lines = (s: string, size: number, style: "normal" | "bold" | "italic", width: number) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    return doc.splitTextToSize(s, width) as string[];
  };

  const text = (
    s: string,
    size: number,
    style: "normal" | "bold" | "italic",
    color: RGB,
    indent = 0,
    width = W - indent,
  ) => {
    doc.setTextColor(...color);
    for (const line of lines(s, size, style, width)) {
      br(size + 4);
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.text(line, M + indent, y);
      y += size + 4;
    }
  };

  /** Cartão arredondado no padrão .surface. */
  const card = (h: number, opts: { accent?: RGB; fill?: RGB; x?: number; w?: number } = {}) => {
    const x = opts.x ?? M;
    const w = opts.w ?? W;
    doc.setFillColor(...(opts.fill ?? C.card));
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, y, w, h, 8, 8, "FD");
    if (opts.accent) {
      doc.setFillColor(...opts.accent);
      doc.roundedRect(x, y, 3.5, h, 2, 2, "F");
    }
  };

  const secao = (titulo: string) => {
    br(46);
    y += 14;
    doc.setFillColor(...C.primaryDeep);
    doc.roundedRect(M, y - 12, W, 24, 6, 6, "F");
    doc.setFillColor(...C.primary);
    doc.roundedRect(M, y - 12, 4, 24, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.white);
    doc.text(titulo.toUpperCase(), M + 14, y + 4);
    y += 26;
  };

  /** Chip/pílula com rótulo curto. */
  const chips = (items: { label: string; color: RGB }[], indent = 0) => {
    let x = M + indent;
    const h = 15;
    br(h + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    for (const it of items) {
      const w = doc.getTextWidth(it.label) + 14;
      if (x + w > M + W) {
        y += h + 5;
        br(h + 6);
        x = M + indent;
      }
      doc.setFillColor(...it.color);
      doc.roundedRect(x, y - h + 4, w, h, 7, 7, "F");
      doc.setTextColor(...C.white);
      doc.text(it.label, x + 7, y + 3.5);
      x += w + 6;
    }
    y += h + 4;
  };

  /** Bloco em cartão: recebe as linhas já formatadas e desenha tudo dentro de um card. */
  const blocoCard = (
    titulo: string | null,
    corpo: { s: string; size: number; style: "normal" | "bold" | "italic"; color: RGB }[],
    accent: RGB = C.primary,
  ) => {
    const pad = 10;
    const inner = W - pad * 2 - 4;
    const tLines = titulo ? lines(titulo, 9.5, "bold", inner) : [];
    const parts = corpo.map(c => ({ ...c, ls: lines(c.s, c.size, c.style, inner) }));
    const h =
      pad * 2 +
      tLines.length * 13 +
      (titulo ? 4 : 0) +
      parts.reduce((acc, p) => acc + p.ls.length * (p.size + 4), 0);

    if (h > BOTTOM - M) {
      // Conteúdo maior que uma página: cai no fluxo simples, sem cartão.
      if (titulo) text(titulo, 9.5, "bold", C.primaryDeep, 14);
      for (const p of parts) text(p.s, p.size, p.style, p.color, 14);
      y += 6;
      return;
    }
    br(h + 8);
    card(h, { accent });


    let cy = y + pad + 8;
    const draw = (s: string, size: number, style: "normal" | "bold" | "italic", color: RGB, lh: number) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.text(s, M + pad + 4, cy);
      cy += lh;
    };
    for (const l of tLines) draw(l, 9.5, "bold", C.primaryDeep, 13);
    if (titulo) cy += 3;
    for (const p of parts) for (const l of p.ls) draw(l, p.size, p.style, p.color, p.size + 4);

    y += h + 8;
  };

  // ---------- Capa ----------
  paintBg();
  doc.setFillColor(...C.primaryDeep);
  doc.roundedRect(M, y, W, 74, 10, 10, "F");
  doc.setFillColor(...C.primary);
  doc.roundedRect(M, y, 5, 74, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.primary);
  doc.text("POOLFLUX · ANÁLISES", M + 18, y + 22);
  doc.setFontSize(19);
  doc.setTextColor(...C.white);
  doc.text("Visão Rep — Raio-x estratégico", M + 18, y + 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(196, 214, 224);
  doc.text(
    `${repNome}${regiao ? ` · ${regiao}` : ""} · gerado em ${new Date().toLocaleString("pt-BR")}`,
    M + 18,
    y + 62,
  );
  y += 74 + 6;

  secao("Leitura gerencial");
  blocoCard(null, [{ s: leitura, size: 10, style: "normal", color: C.foreground }]);

  // ---------- Performance ----------
  secao("Performance da carteira");
  if (!perf) {
    blocoCard(null, [
      { s: "Nenhuma planilha de performance ativa para este representante.", size: 9.5, style: "italic", color: C.mutedFg },
    ], C.border);
  } else {
    const corpo: { s: string; size: number; style: "normal" | "bold" | "italic"; color: RGB }[] = [];
    if (perf.estimado) {
      corpo.push({
        s: "Planilha sem atingimento consolidado: percentuais abaixo são índice estimado a partir do farol das células.",
        size: 8.5,
        style: "italic",
        color: C.warning,
      });
    }
    corpo.push({
      s:
        `${perf.estimado ? "Índice de farol" : "Atingimento geral"} (${perf.periodoLabel}): ${fmtPct(perf.geralPct)} · ` +
        `média do grupo ${fmtPct(perf.mediaGrupoPct)} · diferença ${fmtPp(perf.diffPp)} · ` +
        `${perf.posicao ? `posição ${perf.posicao}º de ${perf.totalReps}` : "sem posição no ranking"} · ${perf.clientes} clientes`,
      size: 9.5,
      style: "normal",
      color: C.foreground,
    });
    blocoCard(null, corpo);

    text(perf.estimado ? "Famílias por índice de farol" : "Famílias por atingimento", 10, "bold", C.primaryDeep);
    y += 2;
    if (!perf.familias.length) {
      text("Sem dados por família nesta planilha.", 9, "italic", C.mutedFg, 10);
    } else {
      // Barras horizontais no padrão dos gráficos da tela.
      const maxPct = Math.max(100, ...perf.familias.map(f => f.pct ?? 0));
      for (const f of perf.familias) {
        br(20);
        const labelW = 150;
        const barW = W - labelW - 60;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.foreground);
        doc.text(doc.splitTextToSize(f.familia, labelW - 8)[0], M, y + 8);
        doc.setFillColor(...C.muted);
        doc.roundedRect(M + labelW, y, barW, 9, 4.5, 4.5, "F");
        const pct = Math.max(0, Math.min(maxPct, f.pct ?? 0));
        const w = (pct / maxPct) * barW;
        if (w > 1) {
          doc.setFillColor(...(pct >= 90 ? C.success : pct >= 70 ? C.primary : C.compare));
          doc.roundedRect(M + labelW, y, w, 9, 4.5, 4.5, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.mutedFg);
        doc.text(fmtPct(f.pct), M + labelW + barW + 8, y + 8);
        y += 16;
      }
    }
    y += 6;
    text("Distribuição do farol (células)", 10, "bold", C.primaryDeep);
    y += 2;
    if (perf.farol.length) {
      chips(perf.farol.map(f => ({ label: `${f.label} ${fmtPct(f.pct)}`, color: C.primary })));
    } else {
      text("—", 9.5, "normal", C.mutedFg, 10);
    }
    if (perf.destaques.length) {
      chips(perf.destaques.map(f => ({ label: `↑ ${f.familia} ${fmtPct(f.pct)}`, color: C.success })));
    }
    if (perf.criticas.length) {
      chips(perf.criticas.map(f => ({ label: `↓ ${f.familia} ${fmtPct(f.pct)}`, color: C.compare })));
    }
  }

  // ---------- Raio-x ----------
  secao("Raio-x da entrevista · 8 perspectivas");
  text(intro, 9.5, "normal", C.mutedFg);
  y += 6;
  for (const l of raiox) {
    br(52);
    y += 6;
    // Cabeçalho da lente
    doc.setFillColor(...C.muted);
    doc.roundedRect(M, y - 10, W, 22, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...C.primaryDeep);
    doc.text(l.label, M + 10, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.mutedFg);
    doc.text(`${l.sinais} sinais · intensidade ${l.intensidade}%`, M + W - 10, y + 4, { align: "right" });
    y += 24;

    if (l.vazia) {
      blocoCard(null, [{ s: "Sem registro nesta perspectiva.", size: 9, style: "italic", color: C.mutedFg }], C.border);
      continue;
    }
    l.capitulos.forEach((cap, i) => {
      const corpo = cap.itens.map(item => ({
        s: cap.tipo === "citacao" ? `“${item}”` : cap.tipo === "campo" ? `• ${item}` : item,
        size: 9.5,
        style: (cap.tipo === "citacao" ? "italic" : "normal") as "italic" | "normal",
        color: cap.tipo === "citacao" ? C.mutedFg : C.foreground,
      }));
      blocoCard(`${i + 1}. ${cap.titulo}`, corpo, cap.tipo === "citacao" ? C.compare : C.primary);
    });
  }

  // ---------- Paralelo ----------
  secao("Paralelo com a Síntese por tipo");
  if (!paralelo) {
    blocoCard(null, [
      { s: "Nenhuma síntese de entrevistas disponível para comparação.", size: 9.5, style: "italic", color: C.mutedFg },
    ], C.border);
  } else {
    blocoCard(null, [
      {
        s:
          `Alinhamento ao grupo: ${paralelo.indiceAlinhamento == null ? "—" : fmtPct(paralelo.indiceAlinhamento)} · ` +
          `${paralelo.alinhamentos} pontos sustentados · ${paralelo.lacunas} pontos cegos · ` +
          `${paralelo.divergencias} divergências · ${paralelo.unicos} leituras exclusivas · base de ${paralelo.totalFontes} entrevistas`,
        size: 9.5,
        style: "normal",
        color: C.foreground,
      },
    ]);
    for (const l of paralelo.lentes) {
      const total = l.alinhado.length + l.foraDaCurva.length + l.divergencias.length + l.unicos.length;
      if (!total) continue;
      const corpo: { s: string; size: number; style: "normal" | "bold" | "italic"; color: RGB }[] = [
        ...l.alinhado.map(i => ({ s: `• Confirma o grupo: ${i.texto} (${i.peso}/${i.total} fontes)`, size: 9, style: "normal" as const, color: C.success })),
        ...l.foraDaCurva.map(i => ({ s: `• Ponto cego: ${i.texto} (${i.peso}/${i.total} fontes)`, size: 9, style: "normal" as const, color: C.mutedFg })),
        ...l.divergencias.map(d => ({ s: `• Diverge em ${d.tema}: ${d.posicaoRep}`, size: 9, style: "normal" as const, color: C.compare })),
        ...l.unicos.map(u => ({ s: `• Leitura exclusiva: ${u.texto}`, size: 9, style: "normal" as const, color: C.foreground })),
      ];
      blocoCard(LENTE_DEF[l.lente as Lente].label, corpo);
    }
  }

  // ---------- Rodapé ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.7);
    doc.line(M, H - 32, PW - M, H - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.mutedFg);
    doc.text(`PoolFlux · Visão Rep · ${repNome}`, M, H - 20);
    doc.text(`Página ${i} de ${total}`, PW - M, H - 20, { align: "right" });
  }

  const slug = repNome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  doc.save(`visao-rep-${slug || "relatorio"}.pdf`);
}
