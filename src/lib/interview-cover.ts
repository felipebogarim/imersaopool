import jsPDF from "jspdf";
import coverAsset from "@/assets/cover-visao-mercado.png.asset.json";
import poolfluxLogoAsset from "@/assets/poolflux-logo.png.asset.json";

export type CoverTemplate = "visao" | "dark";

export type CoverFields = {
  data: string;
  titulo: string;
  entrevistado: string;
  modelo: string;
  template?: CoverTemplate;
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

let cachedLogoDataUrl: string | null = null;
export async function loadPoolfluxLogo(): Promise<string> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  const res = await fetch(poolfluxLogoAsset.url);
  if (!res.ok) throw new Error("Falha ao carregar logo");
  const blob = await res.blob();
  cachedLogoDataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  return cachedLogoDataUrl;
}

export function drawCover(doc: jsPDF, imgDataUrl: string, f: CoverFields) {
  if (f.template === "dark") return drawCoverDark(doc, f);

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
  if (f.template === "dark") return renderCoverDarkPreviewBlobUrl(f);
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
  _coverImgDataUrl: string,
  f: IntervieweePageFields & { template?: CoverTemplate },
) {
  if (f.template === "dark") return drawIntervieweePageDark(doc, f);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const anyDoc = doc as any;

  const DARK: [number, number, number] = [26, 53, 66];

  // Fundo sólido navy/teal escuro
  doc.setFillColor(DARK[0], DARK[1], DARK[2]);
  doc.rect(0, 0, pageW, pageH, "F");

  const SX = pageW / 1349;
  const SY = pageH / 1920;

  // ————— Moldura da foto (centro-esquerda, tamanho moderado) —————
  const frameX = 155 * SX;
  const frameY = 755 * SY;
  const frameW = 480 * SX;
  const frameH = 680 * SY;
  const radius = 18;

  doc.saveGraphicsState?.();
  anyDoc.roundedRect(frameX, frameY, frameW, frameH, radius, radius);
  anyDoc.clip();
  anyDoc.discardPath?.();
  doc.setFillColor(35, 62, 75);
  doc.rect(frameX, frameY, frameW, frameH, "F");

  if (f.photoDataUrl) {
    try {
      const { w: iw, h: ih } = await loadImageSize(f.photoDataUrl);
      const scale = Math.min(frameW / iw, frameH / ih);
      const drawW = iw * scale;
      const drawH = ih * scale;
      const dx = frameX + (frameW - drawW) / 2;
      const dy = frameY + (frameH - drawH) / 2;
      const fmt = f.photoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(f.photoDataUrl, fmt, dx, dy, drawW, drawH, undefined, "FAST");
    } catch {
      /* mantém fundo */
    }
  }
  doc.restoreGraphicsState?.();

  // ————— Bloco inferior: ENTREVISTADO + Nome + linha —————
  const leftX = 100 * SX;
  const rightX = pageW - 100 * SX;
  const bottomLineY = 1830 * SY;

  const name = (f.name || "—").toUpperCase();
  const nameMaxW = rightX - leftX;

  // Auto-fit: tenta cabe em uma linha; se não, quebra em 2
  const measure = (fs: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fs);
    return doc.getTextWidth(name);
  };
  let fontSize = 50; // reduzido ~30% (antes 72)
  while (fontSize > 22 && measure(fontSize) > nameMaxW) fontSize -= 2;

  let lines: string[] = [name];
  if (measure(fontSize) > nameMaxW) {
    const words = name.split(/\s+/).filter(Boolean);
    const mid = Math.ceil(words.length / 2);
    lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }
  const lineH = fontSize * 1.05;
  const nameBaseY = bottomLineY - 22;
  const firstLineY = nameBaseY - (lines.length - 1) * lineH;

  // Label ENTREVISTADO
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("ENTREVISTADO", leftX, firstLineY - fontSize * 0.85, { charSpace: 4 });

  // Nome
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(255, 255, 255);
  let ny = firstLineY;
  for (const l of lines) {
    doc.text(l, leftX, ny);
    ny += lineH;
  }

  // Linha inferior
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.line(leftX, bottomLineY, rightX, bottomLineY);
}



export async function renderIntervieweePreviewBlobUrl(
  f: IntervieweePageFields & { template?: CoverTemplate },
): Promise<string> {
  const img = await loadCoverImage();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await drawIntervieweePage(doc, img, f);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE "DARK" — capa e página de apresentação em fundo preto minimalista
// ═══════════════════════════════════════════════════════════════════════

const DARK_BG: [number, number, number] = [17, 17, 19];

async function drawLogoBottomRight(doc: jsPDF, pageW: number, y: number) {
  try {
    const logo = await loadPoolfluxLogo();
    const { w: iw, h: ih } = await loadImageSize(logo);
    const targetH = 34;
    const scale = targetH / ih;
    const drawW = iw * scale;
    doc.addImage(logo, "PNG", pageW - 60 - drawW, y - targetH, drawW, targetH, undefined, "FAST");
  } catch {
    /* opcional */
  }
}

export async function drawCoverDark(doc: jsPDF, f: CoverFields) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Fundo preto
  doc.setFillColor(DARK_BG[0], DARK_BG[1], DARK_BG[2]);
  doc.rect(0, 0, pageW, pageH, "F");

  const margin = 60;

  // Linha decorativa superior (centro, curta)
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  const topLineW = 140;
  doc.line((pageW - topLineW) / 2, 50, (pageW + topLineW) / 2, 50);

  // Data — pequena, acima da linha
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 205);
  doc.text((f.data || "").toUpperCase(), pageW / 2, 40, { align: "center", charSpace: 3 });

  // Título principal — centralizado, upper-middle
  const title = (f.titulo || DEFAULT_TITULO).trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(42);
  doc.setTextColor(255, 255, 255);
  const words = title.split(/\s+/);
  const titleLines: string[] =
    words.length >= 3
      ? [
          words.slice(0, Math.ceil(words.length / 2)).join(" "),
          words.slice(Math.ceil(words.length / 2)).join(" "),
        ]
      : [title];
  let ty = pageH * 0.42;
  for (const line of titleLines) {
    doc.text(line, pageW / 2, ty, { align: "center" });
    ty += 50;
  }

  // Modelo do documento — subtítulo abaixo do título
  if (f.modelo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(170, 175, 185);
    doc.text(f.modelo.toUpperCase(), pageW / 2, ty + 8, { align: "center", charSpace: 2 });
  }

  // Linha decorativa inferior
  const bottomLineY = pageH - 80;
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.line(margin, bottomLineY, pageW - margin, bottomLineY);

  // Bloco inferior: ENTREVISTADO à esquerda, logo à direita
  const blockBaseY = bottomLineY - 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(170, 175, 185);
  doc.text("ENTREVISTADO", margin, blockBaseY - 16, { charSpace: 3 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text((f.entrevistado || "—").toUpperCase(), margin, blockBaseY);

  await drawLogoBottomRight(doc, pageW, blockBaseY + 4);
}

export async function drawIntervieweePageDark(
  doc: jsPDF,
  f: IntervieweePageFields,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const anyDoc = doc as any;

  // Fundo preto
  doc.setFillColor(DARK_BG[0], DARK_BG[1], DARK_BG[2]);
  doc.rect(0, 0, pageW, pageH, "F");

  const leftX = 60;
  const bottomMargin = 80;
  const lineY = pageH - bottomMargin;

  // Moldura da foto
  const frameW = 200;
  const frameH = 250;
  const frameX = leftX;
  const textBlockH = 130;
  const frameY = lineY - textBlockH - frameH - 10;
  const radius = 18;

  doc.saveGraphicsState?.();
  anyDoc.roundedRect(frameX, frameY, frameW, frameH, radius, radius);
  anyDoc.clip();
  anyDoc.discardPath?.();

  doc.setFillColor(35, 35, 38);
  doc.rect(frameX, frameY, frameW, frameH, "F");

  if (f.photoDataUrl) {
    try {
      const { w: iw, h: ih } = await loadImageSize(f.photoDataUrl);
      const scale = Math.min(frameW / iw, frameH / ih);
      const drawW = iw * scale;
      const drawH = ih * scale;
      const dx = frameX + (frameW - drawW) / 2;
      const dy = frameY + (frameH - drawH) / 2;
      const fmt = f.photoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(f.photoDataUrl, fmt, dx, dy, drawW, drawH, undefined, "FAST");
    } catch {
      /* mantém fundo */
    }
  }
  doc.restoreGraphicsState?.();

  // Nome com auto-fit
  const nameMaxW = pageW - leftX - 60;
  const name = (f.name || "—").toUpperCase();
  const words = name.split(/\s+/).filter(Boolean);
  const wrapByWidth = (fs: number): string[] => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fs);
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
  let fontSize = 44;
  let lines = wrapByWidth(fontSize);
  while (
    (lines.length > 2 || lines.some((l) => doc.getTextWidth(l) > nameMaxW)) &&
    fontSize > 22
  ) {
    fontSize -= 2;
    lines = wrapByWidth(fontSize);
  }
  const lineH = fontSize * 1.08;

  // linha decorativa inferior
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.line(leftX, lineY, pageW - 60, lineY);

  const nameBaseY = lineY - 18;
  const firstLineY = nameBaseY - (lines.length - 1) * lineH;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 205);
  doc.text("ENTREVISTADO", leftX, firstLineY - lineH * 0.75, { charSpace: 3 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(255, 255, 255);
  let ny = firstLineY;
  for (const l of lines) {
    doc.text(l, leftX, ny);
    ny += lineH;
  }
}

export async function renderCoverDarkPreviewBlobUrl(f: CoverFields): Promise<string> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await drawCoverDark(doc, { ...f, template: "dark" });
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}



