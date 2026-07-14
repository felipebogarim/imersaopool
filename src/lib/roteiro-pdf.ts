import jsPDF from "jspdf";

type Cap = {
  ordem: number;
  codigo: string;
  titulo: string;
  lente_default?: string | null;
  pergunta_abertura?: string | null;
  pontos_escuta?: string[] | null;
  orientacao?: string | null;
  hipotese?: string | null;
  campos_matriz?: string[] | null;
};

type Roteiro = {
  nome: string;
  descricao?: string | null;
  perfil_alvo?: string | null;
  versao?: number | null;
  ativo?: boolean | null;
  capitulos: Cap[];
};

export function exportRoteiroPdf(r: Roteiro) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, size: number, style: "normal" | "bold" | "italic" = "normal", indent = 0) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxW - indent);
    for (const line of lines) {
      ensure(size + 4);
      doc.text(line, margin + indent, y);
      y += size + 4;
    }
  };

  // Header
  writeWrapped(r.nome, 20, "bold");
  const meta: string[] = [];
  if (r.versao != null) meta.push(`v${r.versao}`);
  if (r.ativo === false) meta.push("inativo");
  if (r.perfil_alvo) meta.push(`Perfil-alvo: ${r.perfil_alvo}`);
  if (meta.length) {
    doc.setTextColor(120);
    writeWrapped(meta.join("  •  "), 10);
    doc.setTextColor(0);
  }
  if (r.descricao) {
    y += 4;
    writeWrapped(r.descricao, 11);
  }
  y += 12;

  // Capítulos
  const caps = [...r.capitulos].sort((a, b) => a.ordem - b.ordem);
  for (const c of caps) {
    ensure(60);
    y += 6;
    doc.setDrawColor(200);
    doc.line(margin, y, pageW - margin, y);
    y += 14;

    writeWrapped(`#${c.ordem}  ${c.titulo}`, 14, "bold");
    const sub: string[] = [];
    if (c.codigo) sub.push(c.codigo);
    if (c.lente_default) sub.push(c.lente_default);
    if (sub.length) {
      doc.setTextColor(120);
      writeWrapped(sub.join("  •  "), 9);
      doc.setTextColor(0);
    }
    y += 4;

    if (c.pergunta_abertura) {
      writeWrapped(`"${c.pergunta_abertura}"`, 11, "italic");
      y += 4;
    }
    if (Array.isArray(c.pontos_escuta) && c.pontos_escuta.length) {
      writeWrapped("Fique atento a:", 10, "bold");
      for (const p of c.pontos_escuta) writeWrapped(`• ${p}`, 10, "normal", 12);
      y += 4;
    }
    if (c.orientacao) {
      writeWrapped("Objetivo:", 10, "bold");
      writeWrapped(c.orientacao, 10, "normal", 12);
    }
    if (c.hipotese) {
      writeWrapped("Hipótese:", 10, "bold");
      writeWrapped(c.hipotese, 10, "italic", 12);
    }
    if (Array.isArray(c.campos_matriz) && c.campos_matriz.length) {
      writeWrapped("Campos de fechamento:", 10, "bold");
      writeWrapped(c.campos_matriz.join(", "), 10, "normal", 12);
    }
  }

  const safe = r.nome.replace(/[^\w\-]+/g, "_").slice(0, 60) || "roteiro";
  doc.save(`${safe}.pdf`);
}
