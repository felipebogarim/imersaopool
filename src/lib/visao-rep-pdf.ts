// Exporta o relatório completo da Visão Rep (raio-x + paralelo + performance) em PDF.
import jsPDF from "jspdf";
import { LENTE_DEF, type Lente } from "@/lib/insight-lentes";
import { fmtPct, fmtPp, type ParaleloRep, type PerfResumo, type RaioXLente } from "@/lib/visao-rep";

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
  const W = doc.internal.pageSize.getWidth() - M * 2;
  const H = doc.internal.pageSize.getHeight();
  let y = M;

  const br = (h: number) => {
    if (y + h > H - M - 24) {
      doc.addPage();
      y = M;
    }
  };

  const text = (
    s: string,
    size: number,
    style: "normal" | "bold" | "italic",
    color: [number, number, number],
    indent = 0,
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(s, W - indent) as string[]) {
      br(size + 4);
      doc.text(line, M + indent, y);
      y += size + 4;
    }
  };

  const secao = (titulo: string) => {
    br(34);
    y += 10;
    doc.setDrawColor(203, 213, 225);
    doc.line(M, y - 8, M + W, y - 8);
    text(titulo, 13, "bold", [15, 23, 42]);
    y += 2;
  };

  // Capa / cabeçalho
  text("Visão Rep — Raio-x estratégico", 18, "bold", [17, 24, 39]);
  text(
    `${repNome}${regiao ? ` · ${regiao}` : ""} · gerado em ${new Date().toLocaleString("pt-BR")}`,
    9,
    "normal",
    [107, 114, 128],
  );
  y += 8;

  secao("Leitura gerencial");
  text(leitura, 10, "normal", [31, 41, 55]);

  // Performance
  secao("Performance da carteira");
  if (!perf) {
    text("Nenhuma planilha de performance ativa para este representante.", 9.5, "italic", [107, 114, 128]);
  } else {
    if (perf.estimado) {
      text(
        "Planilha sem atingimento consolidado: percentuais abaixo são índice estimado a partir do farol das células.",
        8.5,
        "italic",
        [107, 114, 128],
      );
    }
    text(
      `${perf.estimado ? "Índice de farol" : "Atingimento geral"} (${perf.periodoLabel}): ${fmtPct(perf.geralPct)} · ` +
        `média do grupo ${fmtPct(perf.mediaGrupoPct)} · diferença ${fmtPp(perf.diffPp)} · ` +
        `${perf.posicao ? `posição ${perf.posicao}º de ${perf.totalReps}` : "sem posição no ranking"} · ${perf.clientes} clientes`,
      9.5,
      "normal",
      [31, 41, 55],
    );
    y += 4;
    text(perf.estimado ? "Famílias por índice de farol" : "Famílias por atingimento", 10, "bold", [15, 23, 42]);
    if (!perf.familias.length) text("Sem dados por família nesta planilha.", 9, "italic", [156, 163, 175], 10);
    for (const f of perf.familias) text(`• ${f.familia}: ${fmtPct(f.pct)}`, 9.5, "normal", [55, 65, 81], 10);
    y += 4;
    text("Distribuição do farol (células)", 10, "bold", [15, 23, 42]);
    text(perf.farol.map(f => `${f.label} ${fmtPct(f.pct)}`).join(" · ") || "—", 9.5, "normal", [55, 65, 81], 10);
    if (perf.destaques.length) {
      text(`Destaques: ${perf.destaques.map(f => `${f.familia} (${fmtPct(f.pct)})`).join(" · ")}`, 9.5, "normal", [5, 150, 105], 10);
    }
    if (perf.criticas.length) {
      text(`Pontos críticos: ${perf.criticas.map(f => `${f.familia} (${fmtPct(f.pct)})`).join(" · ")}`, 9.5, "normal", [180, 83, 9], 10);
    }
  }

  // Raio-x das 8 perspectivas
  secao("Raio-x da entrevista · 8 perspectivas");
  text(intro, 9.5, "normal", [107, 114, 128]);
  y += 4;
  for (const l of raiox) {
    br(40);
    y += 6;
    text(`${l.label} — ${l.sinais} sinais · intensidade ${l.intensidade}%`, 11, "bold", [15, 23, 42]);
    if (l.vazia) {
      text("Sem registro nesta perspectiva.", 9, "italic", [156, 163, 175], 10);
      continue;
    }
    for (const cap of l.capitulos) {
      br(28);
      text(cap.titulo, 9.5, "bold", [30, 64, 175], 10);
      for (const item of cap.itens) {
        text(cap.tipo === "citacao" ? `“${item}”` : cap.tipo === "campo" ? `• ${item}` : item,
          9.5,
          cap.tipo === "citacao" ? "italic" : "normal",
          cap.tipo === "citacao" ? [107, 114, 128] : [55, 65, 81],
          20);
      }
      y += 2;
    }
  }

  // Paralelo com a síntese
  secao("Paralelo com a Síntese por tipo");
  if (!paralelo) {
    text("Nenhuma síntese de entrevistas disponível para comparação.", 9.5, "italic", [107, 114, 128]);
  } else {
    text(
      `Alinhamento ao grupo: ${paralelo.indiceAlinhamento == null ? "—" : fmtPct(paralelo.indiceAlinhamento)} · ` +
        `${paralelo.alinhamentos} pontos sustentados · ${paralelo.lacunas} pontos cegos · ` +
        `${paralelo.divergencias} divergências · ${paralelo.unicos} leituras exclusivas · base de ${paralelo.totalFontes} entrevistas`,
      9.5,
      "normal",
      [31, 41, 55],
    );
    y += 4;
    for (const l of paralelo.lentes) {
      const total = l.alinhado.length + l.foraDaCurva.length + l.divergencias.length + l.unicos.length;
      if (!total) continue;
      br(30);
      y += 4;
      text(LENTE_DEF[l.lente as Lente].label, 10.5, "bold", [15, 23, 42]);
      for (const i of l.alinhado) text(`• Confirma o grupo: ${i.texto} (${i.peso}/${i.total} fontes)`, 9, "normal", [5, 150, 105], 10);
      for (const i of l.foraDaCurva) text(`• Ponto cego: ${i.texto} (${i.peso}/${i.total} fontes)`, 9, "normal", [107, 114, 128], 10);
      for (const d of l.divergencias) text(`• Diverge em ${d.tema}: ${d.posicaoRep}`, 9, "normal", [180, 83, 9], 10);
      for (const u of l.unicos) text(`• Leitura exclusiva: ${u.texto}`, 9, "normal", [71, 85, 105], 10);
    }
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Visão Rep · ${repNome}`, M, H - 20);
    doc.text(`Página ${i} de ${total}`, doc.internal.pageSize.getWidth() - M, H - 20, { align: "right" });
  }

  const slug = repNome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  doc.save(`visao-rep-${slug || "relatorio"}.pdf`);
}
