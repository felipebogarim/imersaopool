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

  // Imagem de capa (1349x1920) preenchendo a página inteira
  doc.addImage(imgDataUrl, "PNG", 0, 0, pageW, pageH);

  const COVER_DARK: [number, number, number] = [18, 42, 52];
  const COVER_YELLOW: [number, number, number] = [244, 208, 96];

  // Âncoras medidas na imagem base (1349x1920) e convertidas para pt A4.
  const SX = pageW / 1349;
  const SY = pageH / 1920;
  // Linha decorativa superior: y≈65, x de 438 a 912 (ends at ~x=402pt)
  // Faixa escura termina em y≈130
  // Painel teal começa em y≈1120
  // Logos newline/poolFlux: y≈1625-1730, à direita
  // Linha decorativa inferior: y≈1755, x de 135 a 1215

  const leftX = 135 * SX; // alinhado ao início da linha inferior
  const rightLineEndX = 912 * SX; // fim da linha superior

  // 1) DATA — alinhada ao fim direito da linha superior, centrada verticalmente na faixa escura
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text((f.data || "").toUpperCase(), rightLineEndX, 95 * SY, {
    align: "right",
    charSpace: 2.4,
  });

  // 2) TÍTULO — sobre o painel teal, duas linhas
  const title = (f.titulo || DEFAULT_TITULO).trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(48);
  doc.setTextColor(255, 255, 255);
  const words = title.split(/\s+/);
  const titleLines: string[] =
    words.length >= 2
      ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")]
      : [title];
  let ty = 1230 * SY;
  for (const line of titleLines) {
    doc.text(line, leftX, ty);
    ty += 56;
  }

  // 3) ENTREVISTADO — label + badge amarelo (acima da linha inferior, à esquerda dos logos)
  const bottomLineY = 1755 * SY;
  const modelY = bottomLineY - 12; // "Modelo do documento" logo acima da linha
  const badgeH = 24;
  const badgeGap = 14; // espaço entre badge e o texto Modelo
  const badgeY = modelY - 14 - badgeH - badgeGap; // topo do badge
  const labelY = badgeY - 6; // label ENTREVISTADO acima do badge

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("ENTREVISTADO", leftX, labelY, { charSpace: 3 });

  const badgeName = (f.entrevistado || "—").toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  const badgeTextW = doc.getTextWidth(badgeName);
  doc.setFillColor(COVER_YELLOW[0], COVER_YELLOW[1], COVER_YELLOW[2]);
  doc.rect(leftX - 6, badgeY, badgeTextW + 20, badgeH, "F");
  doc.setTextColor(COVER_DARK[0], COVER_DARK[1], COVER_DARK[2]);
  doc.text(badgeName, leftX + 4, badgeY + 16);

  // 4) MODELO DO DOCUMENTO — logo acima da linha inferior
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(220, 232, 235);
  const modelLabel = "Modelo do documento:";
  doc.text(modelLabel, leftX, modelY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(f.modelo || "—", leftX + doc.getTextWidth(modelLabel) + 14, modelY);
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
