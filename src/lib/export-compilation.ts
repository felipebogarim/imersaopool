import jsPDF from "jspdf";
import { exportToCsv } from "./export-csv";

export function exportCompilationPdf(detail: any) {
  const c = (detail?.conteudo ?? {}) as any;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensure = (n: number) => { if (y + n > pageH - margin) { doc.addPage(); y = margin; } };
  const write = (text: string, size = 10, style: "normal" | "bold" = "normal", color: [number, number, number] = [30, 30, 30]) => {
    doc.setFont("helvetica", style); doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text || "—", maxW);
    for (const l of lines) { ensure(size * 1.3); doc.text(l, margin, y); y += size * 1.3; }
  };

  doc.setFillColor(10, 20, 34); doc.rect(0, 0, pageW, 110, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("Compilação IA", margin, 60);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(`${detail.tipo} · v${detail.versao} · ${detail.escopo_tipo}`, margin, 82);
  y = 140;
  write(`Gerado em ${new Date(detail.created_at).toLocaleString("pt-BR")} · ${detail.perspectivas_incluidas?.length ?? 0} perspectivas`, 9, "normal", [120, 120, 120]);
  y += 10;

  const section = (title: string) => {
    ensure(40); y += 6;
    doc.setDrawColor(10, 20, 34); doc.setLineWidth(2); doc.line(margin, y, margin + 40, y); y += 14;
    write(title, 14, "bold", [10, 20, 34]); y += 2;
  };
  const bullets = (title: string, items: unknown) => {
    if (!Array.isArray(items) || items.length === 0) return;
    section(title);
    for (const it of items) write(`• ${typeof it === "string" ? it : JSON.stringify(it)}`, 10);
  };

  if (c.resumo_executivo) { section("Resumo executivo"); write(String(c.resumo_executivo), 10); }
  bullets("Insights-chave", c.insights_chave);
  bullets("Oportunidades", c.oportunidades);
  bullets("Ameaças", c.ameacas);
  bullets("Lacunas", c.lacunas);

  if (Array.isArray(c.recomendacoes) && c.recomendacoes.length) {
    section("Recomendações");
    c.recomendacoes.forEach((r: any, i: number) => {
      write(`${i + 1}. ${r.acao ?? ""}${r.prioridade ? ` [${r.prioridade}]` : ""}`, 11, "bold");
      if (r.justificativa) write(r.justificativa, 10, "normal", [80, 80, 80]);
      y += 4;
    });
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.setTextColor(140, 140, 140);
    doc.text(`Página ${p} de ${total}`, pageW - margin, pageH - 20, { align: "right" });
    doc.text("PoolFlux · Compilação IA", margin, pageH - 20);
  }

  const name = `compilacao-${detail.tipo}-v${detail.versao}.pdf`;
  doc.save(name);
}

export function exportCompilationCsv(detail: any) {
  const c = (detail?.conteudo ?? {}) as any;
  const rows: Record<string, any>[] = [];
  const push = (secao: string, item: any, extra: Record<string, any> = {}) =>
    rows.push({ secao, conteudo: typeof item === "string" ? item : JSON.stringify(item), ...extra });

  if (c.resumo_executivo) push("resumo_executivo", c.resumo_executivo);
  (c.insights_chave ?? []).forEach((i: any) => push("insight", i));
  (c.oportunidades ?? []).forEach((i: any) => push("oportunidade", i));
  (c.ameacas ?? []).forEach((i: any) => push("ameaca", i));
  (c.lacunas ?? []).forEach((i: any) => push("lacuna", i));
  (c.recomendacoes ?? []).forEach((r: any) =>
    push("recomendacao", r.acao ?? "", { prioridade: r.prioridade ?? "", justificativa: r.justificativa ?? "" }),
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
