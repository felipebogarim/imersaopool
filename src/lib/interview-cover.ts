import jsPDF from "jspdf";
import coverAsset from "@/assets/cover-visao-mercado.png.asset.json";

export type CoverFields = {
  data: string;
  titulo: string;
  entrevistado: string;
  modelo: string;
};

export const DEFAULT_TITULO = "Visão de Mercado";

let cachedDataUrl: string | null = null;

export async function loadCoverImage(): Promise<string> {
  if (cachedDataUrl) return cachedDataUrl;
  const res = await fetch(coverAsset.url);
  if (!res.ok) throw new Error("Falha ao carregar imagem de capa");
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  cachedDataUrl = dataUrl;
  return dataUrl;
}

export function drawCover(doc: jsPDF, imgDataUrl: string, f: CoverFields) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;

  // Imagem de capa preenchendo a página inteira (100% como foi enviada)
  doc.addImage(imgDataUrl, "PNG", 0, 0, pageW, pageH);

  const COVER_DARK: [number, number, number] = [18, 42, 52];
  const COVER_YELLOW: [number, number, number] = [255, 214, 92];

  // 1) DATA — canto superior direito na faixa escura
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text((f.data || "").toUpperCase(), pageW - margin, 55, {
    align: "right",
    charSpace: 2,
  });

  // 2) TÍTULO — grande sobre o painel teal inferior
  const botTop = pageH * 0.6;
  const title = (f.titulo || DEFAULT_TITULO).trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(48);
  doc.setTextColor(255, 255, 255);
  const words = title.split(/\s+/);
  const mid = Math.ceil(words.length / 2);
  const titleLines =
    words.length > 2
      ? [words.slice(0, mid).join(" "), words.slice(mid).join(" ")]
      : [title];
  let ty = botTop + 60;
  for (const line of titleLines) {
    doc.text(line, margin, ty);
    ty += 54;
  }

  // 3) ENTREVISTADO — label + badge amarelo
  const labelY = ty + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("ENTREVISTADO", margin, labelY, { charSpace: 2 });

  const badgeName = (f.entrevistado || "—").toUpperCase();
  doc.setFontSize(12);
  const badgeTextW = doc.getTextWidth(badgeName);
  const badgeY = labelY + 8;
  doc.setFillColor(COVER_YELLOW[0], COVER_YELLOW[1], COVER_YELLOW[2]);
  doc.rect(margin - 3, badgeY, badgeTextW + 16, 22, "F");
  doc.setTextColor(COVER_DARK[0], COVER_DARK[1], COVER_DARK[2]);
  doc.text(badgeName, margin + 5, badgeY + 15);

  // 4) MODELO DO DOCUMENTO — rodapé acima dos logos
  const modelY = pageH - 90;
  doc.setDrawColor(255, 255, 255);
  (doc as any).setGState(new (doc as any).GState({ opacity: 0.4 }));
  doc.setLineWidth(0.5);
  doc.line(margin, modelY - 18, pageW - margin, modelY - 18);
  (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(225, 235, 238);
  const modelLabel = "Modelo do documento:  ";
  doc.text(modelLabel, margin, modelY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(f.modelo || "—", margin + doc.getTextWidth(modelLabel), modelY);
}

export async function renderCoverPreviewDataUrl(f: CoverFields): Promise<string> {
  const img = await loadCoverImage();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawCover(doc, img, f);
  return doc.output("datauristring");
}
