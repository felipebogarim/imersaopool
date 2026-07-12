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
  // Linha decorativa superior: y≈69, x de 456 a 889
  // Faixa escura termina em y≈130
  // Painel teal começa em y≈1120
  // Logos newline/poolFlux: y≈1625-1730, à direita
  // Linha decorativa inferior: y≈1755, x de 135 a 1215

  const leftX = 150 * SX; // alinhado à margem visual da referência
  const topLineLeftX = 456 * SX;
  const topLineRightX = 889 * SX;
  const topLineCenterX = (topLineLeftX + topLineRightX) / 2;

  // 1) DATA — centralizada pelo eixo real da linha decorativa superior
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text((f.data || "").toUpperCase(), topLineCenterX, 122 * SY, {
    align: "center",
    charSpace: 3.2,
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

  // 3) ENTREVISTADO — label + badge amarelo alinhado pela BASE com os logos à direita
  const bottomLineY = 1755 * SY;
  const modelY = 1834 * SY; // "Modelo do documento" abaixo da linha
  const logosBaseY = 1730 * SY; // base dos logos newline/poolFlux na referência
  const badgeH = 24;
  const badgeY = logosBaseY - badgeH; // base do badge alinhada com base dos logos
  const labelY = badgeY - 8; // label ENTREVISTADO acima do badge

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
  doc.text(badgeName, leftX + 4, badgeY + badgeH - 8);

  // 4) MODELO DO DOCUMENTO — abaixo da linha inferior
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(220, 232, 235);
  const modelLabel = "Modelo do documento:";
  doc.text(modelLabel, leftX, modelY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(f.modelo || "—", 430 * SX, modelY);
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

export type IntervieweePageFields = {
  photoDataUrl?: string | null;
  name: string;
};

/**
 * Página de apresentação do entrevistado — mantém a identidade da capa
 * (mesmo gradiente teal + logos + linha inferior) sem a faixa superior,
 * data, título ou "modelo do documento". Traz uma moldura de foto no topo
 * e o nome do entrevistado em destaque na base.
 */
export function drawIntervieweePage(
  doc: jsPDF,
  coverImgDataUrl: string,
  f: IntervieweePageFields,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Fundo: reutiliza a arte da capa e sobrepõe blocos escuros para esconder
  // faixa superior, data, título e "modelo do documento".
  doc.addImage(coverImgDataUrl, "PNG", 0, 0, pageW, pageH);

  const SX = pageW / 1349;
  const SY = pageH / 1920;
  const DARK: [number, number, number] = [18, 42, 52];

  // Máscara: cobre topo inteiro (faixa preta + linha decorativa + data)
  doc.setFillColor(DARK[0], DARK[1], DARK[2]);
  doc.rect(0, 0, pageW, 135 * SY, "F");
  // Máscara: cobre painel do título (1120→1600 aprox), preservando badge/logos.
  doc.rect(0, 1120 * SY, pageW, (1600 - 1120) * SY, "F");
  // Máscara: cobre "modelo do documento" abaixo da linha inferior.
  doc.rect(0, (1755 + 4) * SY, pageW, pageH - (1755 + 4) * SY, "F");

  // Moldura da foto — grande cartão arredondado ocupando o topo/centro
  const leftX = 150 * SX;
  const frameX = leftX - 6;
  const frameY = 90 * SY;
  const frameW = pageW - frameX - 150 * SX;
  const frameH = 1000 * SY;
  const radius = 24;

  if (f.photoDataUrl) {
    // Foto com cantos arredondados via clip
    const anyDoc = doc as any;
    doc.saveGraphicsState?.();
    try {
      anyDoc.roundedRect(frameX, frameY, frameW, frameH, radius, radius);
      anyDoc.clip();
      anyDoc.discardPath?.();

      // Cobrir o frame preservando proporção (cover)
      // Sem saber a razão da imagem, deixamos jsPDF ajustar largura=frameW
      // e centralizamos verticalmente (aproximação — jsPDF não faz cover nativo).
      doc.addImage(f.photoDataUrl, "JPEG", frameX, frameY, frameW, frameH, undefined, "FAST");
    } finally {
      doc.restoreGraphicsState?.();
    }
  } else {
    // Placeholder claro
    doc.setFillColor(238, 240, 245);
    (doc as any).roundedRect(frameX, frameY, frameW, frameH, radius, radius, "F");
  }

  // Borda sutil
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  (doc as any).roundedRect(frameX, frameY, frameW, frameH, radius, radius, "S");

  // Label "ENTREVISTADO"
  const logosBaseY = 1730 * SY;
  const labelY = 1640 * SY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("ENTREVISTADO", leftX, labelY, { charSpace: 3 });

  // Nome grande — quebra em até 2 linhas
  const name = (f.name || "—").toUpperCase();
  const words = name.split(/\s+/);
  let lines: string[];
  if (words.length <= 1) lines = [name];
  else {
    // divide priorizando linhas equilibradas
    const mid = Math.ceil(words.length / 2);
    lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(48);
  doc.setTextColor(255, 255, 255);
  // Ajusta base para alinhar com base dos logos
  const lineH = 54;
  let ny = logosBaseY - (lines.length - 1) * lineH;
  for (const l of lines) {
    doc.text(l, leftX, ny);
    ny += lineH;
  }
}

export async function renderIntervieweePreviewBlobUrl(
  f: IntervieweePageFields,
): Promise<string> {
  const img = await loadCoverImage();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawIntervieweePage(doc, img, f);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}

