// Exporta o painel de síntese (8 lentes) para PDF.
import jsPDF from "jspdf";
import { LENTES, LENTE_DEF, TIPO_LABEL, type FonteTipo } from "@/lib/insight-lentes";
import type { SinteseResultado } from "@/lib/sintese-engine";

type Opts = {
  resultado: SinteseResultado;
  tipos: FonteTipo[];
  geradoEm: string;
  versao: number;
  regiao?: string;
  origem?: string | null;
};

export function exportSintesePdf({ resultado, tipos, geradoEm, versao, regiao, origem }: Opts) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  const W = doc.internal.pageSize.getWidth() - M * 2;
  const H = doc.internal.pageSize.getHeight();
  let y = M;

  const br = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };

  const text = (s: string, size: number, style: "normal" | "bold" | "italic", color: [number, number, number], indent = 0) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(s, W - indent) as string[];
    for (const line of lines) {
      br(size + 4);
      doc.text(line, M + indent, y);
      y += size + 4;
    }
  };

  text("Painel de Síntese", 18, "bold", [17, 24, 39]);
  text(
    `${tipos.map(t => TIPO_LABEL[t]).join(" + ")} · v${versao} · gerado em ${new Date(geradoEm).toLocaleString("pt-BR")}` +
      (regiao && regiao !== "todas" ? ` · região ${regiao}` : "") +
      (origem === "importada" ? " · análise importada" : ""),
    9,
    "normal",
    [107, 114, 128],
  );
  y += 6;
  text(
    `${resultado.meta.total_fontes} fontes · ${resultado.meta.convergencias_fortes} convergências fortes · ${resultado.meta.divergencias} divergências · ${resultado.meta.especificos} pontos regionais`,
    9,
    "normal",
    [107, 114, 128],
  );
  y += 10;

  for (const l of LENTES) {
    const r = resultado.lentes?.[l];
    if (!r) continue;
    br(40);
    y += 8;
    text(LENTE_DEF[l].label, 13, "bold", [15, 23, 42]);

    text("Convergência", 10, "bold", [5, 150, 105]);
    if (!r.convergencia?.length) text("—", 9, "italic", [156, 163, 175], 10);
    for (const c of r.convergencia ?? []) {
      text(`• ${c.texto} (${c.peso} de ${c.total})`, 9.5, "normal", [31, 41, 55], 10);
      if (c.fala_representativa) text(`“${c.fala_representativa}”`, 9, "italic", [107, 114, 128], 22);
      if (c.fontes?.length)
        text(c.fontes.map(f => `${f.nome}${f.regiao ? ` · ${f.regiao}` : ""}`).join(" | "), 8, "normal", [156, 163, 175], 22);
    }

    y += 4;
    text("Divergência", 10, "bold", [180, 83, 9]);
    if (!r.divergencia?.length) text("—", 9, "italic", [156, 163, 175], 10);
    for (const d of r.divergencia ?? []) {
      text(`• ${d.tema}`, 9.5, "normal", [31, 41, 55], 10);
      for (const p of d.posicoes ?? []) {
        text(`– ${p.fonte}${p.regiao ? ` (${p.regiao})` : ""}: ${p.posicao}`, 9, "normal", [55, 65, 81], 22);
        if (p.fala) text(`“${p.fala}”`, 9, "italic", [107, 114, 128], 32);
      }
    }

    y += 4;
    text("Específico da região", 10, "bold", [71, 85, 105]);
    if (!r.especifico?.length) text("—", 9, "italic", [156, 163, 175], 10);
    for (const e of r.especifico ?? []) {
      text(`• ${e.texto} — ${e.fonte}${e.regiao ? ` · ${e.regiao}` : ""}`, 9, "normal", [55, 65, 81], 10);
    }

    if (r.acao_convergente) {
      y += 4;
      text(`Ação convergente: ${r.acao_convergente.texto}`, 9.5, "bold", [30, 64, 175], 10);
    }
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Página ${i} de ${total}`, doc.internal.pageSize.getWidth() - M, H - 20, { align: "right" });
  }

  doc.save(`sintese-${tipos.join("-")}-v${versao}.pdf`);
}
