import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { CLASSIFICACOES, TIPOS_EMPRESA } from "@/lib/interview-questions";

const CLASSIF = Object.fromEntries(CLASSIFICACOES.map((c) => [c.value, c.label]));
const TIPO = Object.fromEntries(TIPOS_EMPRESA.map((t) => [t.value, t.label]));

export async function exportInterviewPdf(interviewId: string) {
  const { data: interview } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", interviewId)
    .maybeSingle();
  if (!interview) throw new Error("Entrevista não encontrada");

  const [capsRes, respRes, notesRes] = await Promise.all([
    interview.roteiro_id
      ? supabase
          .from("capitulos")
          .select("id, ordem, codigo, titulo, campos_matriz")
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
  ]);

  const capitulos = capsRes.data ?? [];
  const respostas = respRes.data ?? [];
  const notes = notesRes.data ?? [];
  const respByCap = new Map(respostas.map((r: any) => [r.capitulo_id, r]));

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensure = (n: number) => {
    if (y + n > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const write = (
    text: string,
    size = 10,
    style: "normal" | "bold" = "normal",
    color: [number, number, number] = [30, 30, 30],
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text || "—", maxW);
    for (const l of lines) {
      ensure(size * 1.3);
      doc.text(l, margin, y);
      y += size * 1.3;
    }
  };

  // Capa
  doc.setFillColor(10, 20, 34);
  doc.rect(0, 0, pageW, 130, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Relatório de Entrevista", margin, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(interview.entrevistado_nome ?? "—", margin, 88);
  if (interview.empresa_nome) doc.text(interview.empresa_nome, margin, 106);
  y = 160;

  write(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 9, "normal", [120, 120, 120]);
  y += 8;

  // Ficha
  write("Ficha", 14, "bold", [10, 20, 34]);
  const ficha: [string, string][] = [
    ["Entrevistador", `${interview.entrevistador_nome ?? "—"}${interview.entrevistador_cargo ? " — " + interview.entrevistador_cargo : ""}`],
    ["Data", interview.data_entrevista ? new Date(interview.data_entrevista).toLocaleDateString("pt-BR") : "—"],
    ["Classificação", `${CLASSIF[interview.entrevistado_classificacao] ?? interview.entrevistado_classificacao ?? "—"}${interview.entrevistado_classificacao_outro ? " — " + interview.entrevistado_classificacao_outro : ""}`],
    ["Tipo da empresa", interview.empresa_tipo ? `${TIPO[interview.empresa_tipo] ?? interview.empresa_tipo}${interview.empresa_tipo_outro ? " — " + interview.empresa_tipo_outro : ""}` : "—"],
    ["Local", [interview.cidade, interview.estado].filter(Boolean).join("/") || "—"],
  ];
  for (const [k, v] of ficha) {
    write(k, 10, "bold", [80, 80, 80]);
    write(v, 10);
    y += 2;
  }
  y += 8;

  // Capítulos
  for (const cap of capitulos) {
    ensure(60);
    doc.setDrawColor(10, 20, 34);
    doc.setLineWidth(2);
    doc.line(margin, y, margin + 40, y);
    y += 14;
    write(`${cap.ordem}. ${cap.titulo}`, 14, "bold", [10, 20, 34]);
    const r: any = respByCap.get(cap.id);
    if (r?.leitura_estrategica?.trim()) {
      write("Leitura estratégica", 10, "bold", [80, 80, 80]);
      write(String(r.leitura_estrategica), 10);
      y += 4;
    }
    if (r?.resposta_texto?.trim()) {
      write("Evidência / anotações", 10, "bold", [80, 80, 80]);
      write(String(r.resposta_texto), 10);
      y += 4;
    }
    const campos: string[] = Array.isArray(cap.campos_matriz) ? cap.campos_matriz : [];
    const sintese = (r?.sintese ?? {}) as Record<string, string>;
    if (campos.length) {
      write("Síntese objetiva", 10, "bold", [80, 80, 80]);
      for (const c of campos) {
        write(`• ${c}: ${sintese[c]?.trim() || "—"}`, 10);
      }
    }
    y += 10;
  }

  // Anotações
  if (notes.length) {
    ensure(60);
    doc.setDrawColor(10, 20, 34);
    doc.setLineWidth(2);
    doc.line(margin, y, margin + 40, y);
    y += 14;
    write("Anotações da sessão", 14, "bold", [10, 20, 34]);
    for (const n of notes) {
      write(
        `${new Date(n.created_at).toLocaleString("pt-BR")} — ${n.author_name ?? "—"}`,
        9,
        "bold",
        [100, 100, 100],
      );
      write(n.content ?? "", 10);
      y += 6;
    }
  }

  if (interview.observacoes) {
    ensure(60);
    write("Observações", 14, "bold", [10, 20, 34]);
    write(interview.observacoes, 10);
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Página ${p} de ${total}`, pageW - margin, pageH - 20, { align: "right" });
    doc.text("PoolFlux · Entrevista", margin, pageH - 20);
  }

  const safe = (interview.entrevistado_nome || "entrevista")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  doc.save(`entrevista-${safe}.pdf`);
}
