import jsPDF from "jspdf";
import autoTable, { type RowInput, type CellDef } from "jspdf-autotable";
import { KCard, KList, PRIORITY_LABEL } from "./kanban-types";

type RGB = [number, number, number];

const C = {
  background: [225, 233, 239] as RGB,
  card: [240, 246, 250] as RGB,
  border: [181, 191, 198] as RGB,
  foreground: [14, 28, 40] as RGB,
  mutedFg: [71, 84, 96] as RGB,
  primary: [0, 141, 173] as RGB,
  primaryDeep: [6, 40, 56] as RGB,
  white: [255, 255, 255] as RGB,
  success: [0, 148, 77] as RGB,
  warning: [215, 141, 0] as RGB,
  danger: [215, 30, 30] as RGB,
};

export interface MemberSummary {
  name: string;
  email?: string;
  totalActions: number;
  pendingActions: number;
  completedActions: number;
  attainment: number; // 0-100
}

export async function exportMemberActionsPdf(
  member: { name: string; email?: string },
  boardName: string,
  cards: KCard[],
  lists: KList[]
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  const PW = doc.internal.pageSize.getWidth();
  const W = PW - M * 2;
  const activeCards = cards.filter(c => !c.completed_at && !c.archived_at);
  const completedCardsCount = cards.filter(c => !!c.completed_at).length;
  const totalCards = cards.length;
  const attainment = totalCards > 0 ? (completedCardsCount / totalCards) * 100 : 0;

  // Background
  doc.setFillColor(...C.background);
  doc.rect(0, 0, PW, doc.internal.pageSize.getHeight(), "F");

  let y = M;

  // Header
  doc.setFillColor(...C.primaryDeep);
  doc.roundedRect(M, y, W, 70, 10, 10, "F");
  doc.setFillColor(...C.primary);
  doc.roundedRect(M, y, 5, 70, 3, 3, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.primary);
  doc.text("POOLFLUX · GESTÃO DE TAREFAS", M + 18, y + 22);
  
  doc.setFontSize(16);
  doc.setTextColor(...C.white);
  doc.text(`Farol de Evolução: ${member.name}`, M + 18, y + 42);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(196, 214, 224);
  doc.text(`Board: ${boardName} · Gerado em ${new Date().toLocaleDateString("pt-BR")}`, M + 18, y + 58);
  
  y += 85;

  // Evolution Stats (Evolution Lighthouse)
  const cardW = (W - 20) / 3;
  
  // Total
  doc.setFillColor(...C.card);
  doc.roundedRect(M, y, cardW, 50, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.primaryDeep);
  doc.text(String(totalCards), M + 12, y + 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.mutedFg);
  doc.text("TOTAL DE AÇÕES", M + 12, y + 40);

  // Completed
  doc.setFillColor(...C.card);
  doc.roundedRect(M + cardW + 10, y, cardW, 50, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.success);
  doc.text(String(completedCardsCount), M + cardW + 22, y + 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.mutedFg);
  doc.text("CONCLUÍDAS", M + cardW + 22, y + 40);

  // Attainment
  doc.setFillColor(...C.card);
  doc.roundedRect(M + (cardW + 10) * 2, y, cardW, 50, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.primary);
  doc.text(`${attainment.toFixed(1)}%`, M + (cardW + 10) * 2 + 12, y + 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.mutedFg);
  doc.text("ATINGIMENTO", M + (cardW + 10) * 2 + 12, y + 40);

  y += 70;

  // Actions Table (Only Pending)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.primaryDeep);
  doc.text("AÇÕES EM ABERTO", M, y);
  y += 15;

  const tableHead = [["Lista", "Ação", "Prioridade", "Prazo"]];
  const tableBody: RowInput[] = activeCards.map(c => {
    const list = lists.find(l => l.id === c.list_id);
    return [
      list?.name || "-",
      c.title,
      PRIORITY_LABEL[c.priority] || "-",
      c.due_date ? new Date(c.due_date).toLocaleDateString("pt-BR") : "-"
    ];
  });

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 6,
      font: "helvetica",
    },
    headStyles: {
      fillColor: C.primaryDeep,
      textColor: C.white,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 248, 250],
    },
    margin: { left: M, right: M },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 30;
  
  // Footer / Disclaimer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...C.mutedFg);
  doc.text("Este documento contém informações estratégicas da PoolFlux. Não compartilhe com terceiros não autorizados.", M, finalY);

  doc.save(`Farol-Evolucao-${member.name.replace(/\s+/g, "-")}.pdf`);
}

export function shareOnWhatsApp(memberPhone: string, memberName: string, boardName: string) {
  const text = encodeURIComponent(
    `Olá ${memberName},\n\nSegue o Farol de Evolução das ações vinculadas a você no board *${boardName}*.\n\nFavor baixar o PDF em anexo para conferir os detalhes.`
  );
  window.open(`https://wa.me/${memberPhone.replace(/\D/g, "")}?text=${text}`, "_blank");
}

export function shareViaEmail(memberEmail: string, memberName: string, boardName: string) {
  const subject = encodeURIComponent(`Farol de Evolução: ${boardName}`);
  const body = encodeURIComponent(
    `Olá ${memberName},\n\nSegue em anexo o relatório de evolução das ações sob sua responsabilidade no board ${boardName}.\n\nAtenciosamente,\nEquipe PoolFlux`
  );
  window.open(`mailto:${memberEmail}?subject=${subject}&body=${body}`, "_blank");
}
