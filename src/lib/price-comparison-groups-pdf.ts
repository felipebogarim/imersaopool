// Relatório estruturado de um comparativo específico (item 22) — capa, resumo
// executivo, produtos analisados, comparação técnica e de preços, simulações,
// observações e conclusão. Mesmo padrão jsPDF/autoTable usado no resto do app
// (ver performance-pdf.ts) — nunca captura a tela, gera o documento do zero.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PRICE_NOT_COMPARABLE_LABEL, formatBRL } from "./price-comparativos-core";
import { analyzeAttribute, simulatePrice, top6For } from "./price-comparison-groups-attributes";
import {
  ITEM_CLASSIFICATION_LABEL,
  ITEM_STATUS_LABEL,
  type ComparisonGroup,
  type ComparisonGroupItem,
} from "./price-comparison-groups";

const INK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [107, 114, 128];
const LINE: [number, number, number] = [226, 232, 240];

type StoredPriceMeta = {
  original_price: number | null;
  original_unit: string | null;
  comparable_unit: string | null;
};

function formatStoredPrice(
  price: number | null,
  adjustment: number | null,
  meta?: StoredPriceMeta,
): string {
  const originalPrice = meta?.original_price ?? null;
  const comparable = simulatePrice(price, adjustment) ?? price;
  const displayed =
    comparable == null && originalPrice != null
      ? PRICE_NOT_COMPARABLE_LABEL
      : formatBRL(comparable);
  return originalPrice != null && originalPrice !== price
    ? `${displayed}\nOriginal (${meta?.original_unit ?? "unidade"}): ${formatBRL(originalPrice)}`
    : displayed;
}

export function exportComparisonGroupPdf(group: ComparisonGroup, items: ComparisonGroupItem[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 60;

  // Capa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text("Relatório Comparativo de Preços", margin, y);
  y += 28;
  doc.setFontSize(15);
  doc.text(group.name, margin, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const meta = [
    `Família / Categoria: ${group.familia}${group.categoria ? ` / ${group.categoria}` : ""}`,
    `Marca base: ${group.base_brand}`,
    `Tabela base: ${group.base_price_table ?? "não informada"}`,
    `Data: ${new Date(group.updated_at).toLocaleDateString("pt-BR")}`,
    `Itens analisados: ${items.length}`,
  ];
  for (const line of meta) {
    doc.text(line, margin, y);
    y += 14;
  }
  y += 10;
  doc.setDrawColor(...LINE);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  // Resumo executivo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("Resumo executivo", margin, y);
  y += 16;

  const countByStatus = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.status] = (acc[it.status] ?? 0) + 1;
    return acc;
  }, {});
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const resumo = (Object.keys(ITEM_STATUS_LABEL) as (keyof typeof ITEM_STATUS_LABEL)[])
    .map((s) => `${ITEM_STATUS_LABEL[s]}: ${countByStatus[s] ?? 0}`)
    .join("   ·   ");
  doc.text(resumo, margin, y);
  y += 22;

  // Produtos analisados / comparação de preços
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("Produtos analisados e comparação de preços", margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: INK, textColor: 255 },
    head: [
      [
        "Base",
        "Preço base",
        "Concorrente A",
        "Preço A",
        "Concorrente B",
        "Preço B",
        "Status",
        "Classificação",
      ],
    ],
    body: items.map((it) => [
      `${it.base_brand} ${it.base_code}`,
      formatStoredPrice(
        it.base_price,
        it.base_adjustment_percent,
        it.specs_snapshot?.price_meta?.base,
      ),
      `${it.competitor_a_brand} ${it.competitor_a_code}`,
      formatStoredPrice(
        it.competitor_a_price,
        it.competitor_a_adjustment_percent,
        it.specs_snapshot?.price_meta?.competitor_a,
      ),
      it.two_competitors ? `${it.competitor_b_brand ?? ""} ${it.competitor_b_code ?? ""}` : "—",
      it.two_competitors
        ? formatStoredPrice(
            it.competitor_b_price,
            it.competitor_b_adjustment_percent,
            it.specs_snapshot?.price_meta?.competitor_b,
          )
        : "—",
      ITEM_STATUS_LABEL[it.status],
      it.classification ? ITEM_CLASSIFICATION_LABEL[it.classification] : "—",
    ]),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 20;

  // Comparação técnica (até 6 atributos por família)
  const attrs = top6For(group.familia);
  for (const it of items) {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(
      `${it.base_brand} ${it.base_code} × ${it.competitor_a_brand} ${it.competitor_a_code}`,
      margin,
      y,
    );
    y += 8;

    const baseSpecs = it.specs_snapshot?.base ?? {};
    const compSpecs = it.specs_snapshot?.competitor_a ?? {};
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [55, 65, 81], textColor: 255 },
      head: [["Característica", "Base", "Concorrente", "Análise"]],
      body: attrs.map((a) => {
        const bv = baseSpecs[a.key];
        const cv = compSpecs[a.key];
        const analysis = analyzeAttribute(a, bv, cv);
        return [
          a.label,
          `${bv?.value_numeric ?? bv?.value_text ?? bv?.normalized_value ?? "—"}${a.unidade && bv?.value_numeric != null ? ` ${a.unidade}` : ""}`,
          `${cv?.value_numeric ?? cv?.value_text ?? cv?.normalized_value ?? "—"}${a.unidade && cv?.value_numeric != null ? ` ${a.unidade}` : ""}`,
          analysis.text,
        ];
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 16;

    if (it.notes) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`Observações: ${it.notes}`, margin, y, { maxWidth: pageW - margin * 2 });
      y += 16;
    }
  }

  // Conclusão
  if (y > 680) {
    doc.addPage();
    y = 50;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("Conclusão do estudo", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const conclusao = group.notes?.trim()
    ? group.notes
    : "Nenhuma observação adicional registrada para este estudo.";
  doc.text(conclusao, margin, y, { maxWidth: pageW - margin * 2 });

  doc.save(`${group.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-comparativo.pdf`);
}
