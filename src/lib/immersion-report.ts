import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

type Chapter = { title: string; blocks: { label?: string; text: string }[] };

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
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
  };
  const writeText = (text: string, size: number, style: "normal" | "bold" = "normal", color: [number, number, number] = [30, 30, 30]) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      ensureSpace(size * 1.3);
      doc.text(line, margin, y);
      y += size * 1.3;
    }
  };

  // Capa
  doc.setFillColor(10, 20, 34);
  doc.rect(0, 0, pageW, 140, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Relatório de Imersão Comercial", margin, 70);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(data.immersion.titulo, margin, 95);
  doc.text(data.immersion.client?.nome_fantasia ?? "", margin, 112);
  y = 170;
  writeText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 9, "normal", [120, 120, 120]);
  y += 12;

  // Sumário
  writeText("Sumário", 14, "bold", [10, 20, 34]);
  y += 4;
  chapters.forEach((c) => writeText(`• ${c.title}`, 10));
  y += 12;

  // Capítulos
  for (const c of chapters) {
    ensureSpace(60);
    doc.setDrawColor(10, 20, 34);
    doc.setLineWidth(2);
    doc.line(margin, y, margin + 40, y);
    y += 14;
    writeText(c.title, 16, "bold", [10, 20, 34]);
    y += 4;
    for (const b of c.blocks) {
      if (b.label) writeText(b.label, 10, "bold", [60, 60, 60]);
      writeText(b.text, 10);
      y += 6;
    }
    y += 10;
  }

  // Numeração
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Página ${p} de ${total}`, pageW - margin, pageH - 20, { align: "right" });
    doc.text("PoolFlux · Imersões Comerciais", margin, pageH - 20);
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
