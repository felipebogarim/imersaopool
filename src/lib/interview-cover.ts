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
function loadImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Falha ao ler dimensões da imagem"));
    img.src = dataUrl;
  });
}

/**
 * Página de apresentação do entrevistado — mantém a identidade da capa
 * (mesmo gradiente teal + logos + linha inferior) sem a faixa superior,
 * data, título ou "modelo do documento". Foto ajustada dentro do box
 * (contain, sem cortar rostos) e nome à esquerda dos logos.
 */
export async function drawIntervieweePage(
  doc: jsPDF,
  coverImgDataUrl: string,
  f: IntervieweePageFields,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Fundo: reutiliza a arte da capa e mascara elementos indesejados.
  doc.addImage(coverImgDataUrl, "PNG", 0, 0, pageW, pageH);

  const SX = pageW / 1349;
  const SY = pageH / 1920;
  const DARK: [number, number, number] = [18, 42, 52];

  // Máscara topo (faixa preta + linha + data)
  doc.setFillColor(DARK[0], DARK[1], DARK[2]);
  doc.rect(0, 0, pageW, 135 * SY, "F");
  // Máscara painel do título
  doc.rect(0, 1120 * SY, pageW, (1600 - 1120) * SY, "F");
  // Máscara abaixo da linha inferior ("modelo do documento")
  doc.rect(0, (1755 + 4) * SY, pageW, pageH - (1755 + 4) * SY, "F");

  // ————— Moldura da foto —————
  const leftX = 150 * SX;
  const frameX = leftX - 6;
  const frameY = 150 * SY;
  const frameW = pageW - frameX - 150 * SX;
  const frameH = 1350 * SY - frameY; // até y≈1350, deixando faixa inferior livre
  const radius = 28;
  const anyDoc = doc as any;

  // Fundo do box (para letterbox invisível) + clip arredondado
  doc.saveGraphicsState?.();
  anyDoc.roundedRect(frameX, frameY, frameW, frameH, radius, radius);
  anyDoc.clip();
  anyDoc.discardPath?.();

  // Preenche o box com dark antes da foto
  doc.setFillColor(DARK[0], DARK[1], DARK[2]);
  doc.rect(frameX, frameY, frameW, frameH, "F");

  if (f.photoDataUrl) {
    try {
      const { w: iw, h: ih } = await loadImageSize(f.photoDataUrl);
      // contain: cabe inteira dentro do box, sem cortar rostos
      const scale = Math.min(frameW / iw, frameH / ih);
      const drawW = iw * scale;
      const drawH = ih * scale;
      const dx = frameX + (frameW - drawW) / 2;
      const dy = frameY + (frameH - drawH) / 2;
      const fmt = f.photoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(f.photoDataUrl, fmt, dx, dy, drawW, drawH, undefined, "FAST");
    } catch {
      // se falhar, mantém o fundo escuro
    }
  }

  doc.restoreGraphicsState?.();

  // Borda sutil
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  anyDoc.roundedRect(frameX, frameY, frameW, frameH, radius, radius, "S");

  // ————— Bloco inferior: label + nome (à esquerda dos logos) —————
  // Logos ocupam aprox x 800→1210 na referência. Reservamos até x=760*SX.
  const nameMaxX = 760 * SX;
  const nameMaxW = nameMaxX - leftX;
  const bottomLineY = 1755 * SY;
  const logosBaseY = 1730 * SY;

  // Nome — quebra por palavra respeitando largura, auto-fit de fonte
  const name = (f.name || "—").toUpperCase();
  const words = name.split(/\s+/).filter(Boolean);

  const wrapByWidth = (fontSize: number): string[] => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const tryLine = cur ? `${cur} ${w}` : w;
      if (doc.getTextWidth(tryLine) <= nameMaxW) cur = tryLine;
      else {
        if (cur) out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
    return out;
  };

  let fontSize = 46;
  let lines = wrapByWidth(fontSize);
  while (
    (lines.length > 2 || lines.some((l) => doc.getTextWidth(l) > nameMaxW)) &&
    fontSize > 22
  ) {
    fontSize -= 2;
    lines = wrapByWidth(fontSize);
  }
  const lineH = fontSize * 1.08;

  // Label "ENTREVISTADO" — posicionado ACIMA da primeira linha do nome,
  // com folga garantida contra a base dos logos.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);

  // Base do bloco de nome alinhada com base dos logos.
  // Última linha desenha em y = nameBaseY; primeira em nameBaseY - (n-1)*lineH.
  const nameBaseY = logosBaseY;
  const firstLineY = nameBaseY - (lines.length - 1) * lineH;
  const labelY = Math.max(bottomLineY + 8, firstLineY - lineH * 0.7);

  doc.text("ENTREVISTADO", leftX, labelY, { charSpace: 3 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(255, 255, 255);
  let ny = firstLineY;
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
  await drawIntervieweePage(doc, img, f);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}


