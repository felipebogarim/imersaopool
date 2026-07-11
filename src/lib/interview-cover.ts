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

  // Imagem de capa preenchendo a página inteira
  doc.addImage(imgDataUrl, "PNG", 0, 0, pageW, pageH);

  const COVER_DARK: [number, number, number] = [18, 42, 52];
  const COVER_YELLOW: [number, number, number] = [244, 208, 96];

  // 1) DATA — canto superior direito, dentro da faixa escura (~y=62)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text((f.data || "").toUpperCase(), pageW - margin, 62, {
    align: "right",
    charSpace: 2.4,
  });

  // 2) TÍTULO — grande, duas linhas, sobre o painel teal
  const title = (f.titulo || DEFAULT_TITULO).trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(52);
  doc.setTextColor(255, 255, 255);
  const words = title.split(/\s+/);
  let titleLines: string[];
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    titleLines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  } else {
    titleLines = [title];
  }
  let ty = 555;
  for (const line of titleLines) {
    doc.text(line, margin, ty);
    ty += 58;
  }

  // 3) ENTREVISTADO — label + badge amarelo (posição fixa perto do rodapé)
  const labelY = 705;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("ENTREVISTADO", margin, labelY, { charSpace: 3 });

  const badgeName = (f.entrevistado || "—").toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const badgeTextW = doc.getTextWidth(badgeName);
  const badgeH = 26;
  const badgeY = labelY + 12;
  doc.setFillColor(COVER_YELLOW[0], COVER_YELLOW[1], COVER_YELLOW[2]);
  doc.rect(margin - 4, badgeY, badgeTextW + 20, badgeH, "F");
  doc.setTextColor(COVER_DARK[0], COVER_DARK[1], COVER_DARK[2]);
  doc.text(badgeName, margin + 6, badgeY + 17);

  // 4) MODELO DO DOCUMENTO — rodapé
  const modelY = 788;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(220, 232, 235);
  const modelLabel = "Modelo do documento:";
  doc.text(modelLabel, margin, modelY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(f.modelo || "—", margin + doc.getTextWidth(modelLabel) + 14, modelY);
}

export async function renderCoverPreviewBlobUrl(f: CoverFields): Promise<string> {
  const img = await loadCoverImage();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawCover(doc, img, f);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}

// Backwards-compat alias
export const renderCoverPreviewDataUrl = renderCoverPreviewBlobUrl;
