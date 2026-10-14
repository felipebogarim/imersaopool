import { supabase } from "@/integrations/supabase/client";
import type { RepStructure } from "./types";
import { MODELO_ATUACAO_LABEL, MODELO_ESCRITORIO_LABEL } from "./types";
import { buildBrazilMapSvg, svgToPngDataUrl } from "./pdf";

/** Retorna a URL pública do OpenGraph para a estrutura do representante */
export function getEstruturaOgImageUrl(repId?: string | null): string {
  if (!repId) return "https://poolflux.app/og-charts/default.png";
  return `https://poolflux.app/api/og-estrutura/${repId}.png`;
}

/** Renderiza a primeira página do PDF gerado para um Blob PNG via pdfjs-dist */
export async function renderPdfBlobToImage(
  pdfBlob: Blob,
  maxDim = 1200
): Promise<{ dataUrl: string; blob: Blob } | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  try {
    const pdfjs: any = await import("pdfjs-dist");
    try {
      const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    } catch {
      // fallback without worker
    }

    const buf = await pdfBlob.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const page = await doc.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxDim / Math.max(unscaledViewport.width, unscaledViewport.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL("image/png");
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) {
      return { dataUrl, blob };
    }
  } catch (err) {
    console.warn("[renderPdfBlobToImage] Falha ao renderizar PDF via pdfjs:", err);
  }

  return null;
}

/** Desenha o card visual OpenGraph 1200x630 da Estrutura Comercial */
export async function drawStructureOgCanvas(
  canvas: HTMLCanvasElement,
  structure: RepStructure,
  options?: { width?: number; height?: number }
): Promise<void> {
  const width = options?.width || 1200;
  const height = options?.height || 630;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 1. Fundo geral slate-100
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, 0, width, height);

  // 2. Card principal centralizado branco com borda suave
  const pad = 24;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;
  const cardX = pad;
  const cardY = pad;
  const radius = 16;

  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  } else {
    ctx.rect(cardX, cardY, cardW, cardH);
  }
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#e2e8f0";
  ctx.stroke();
  ctx.restore();

  // 3. Cabeçalho Executivo
  const headerH = 88;
  ctx.beginPath();
  ctx.moveTo(cardX, cardY + headerH);
  ctx.lineTo(cardX + cardW, cardY + headerH);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Badge no cabeçalho
  ctx.save();
  ctx.fillStyle = "#e0f2fe";
  ctx.strokeStyle = "#7dd3fc";
  ctx.lineWidth = 1;
  const badgeX = cardX + 32;
  const badgeY = cardY + 18;
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(badgeX, badgeY, 195, 22, 6);
  } else {
    ctx.rect(badgeX, badgeY, 195, 22);
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#0369a1";
  ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("DOCUMENTO EXECUTIVO EM PDF", badgeX + 12, badgeY + 15);
  ctx.restore();

  // Título e Subtítulo
  const nome = structure.nome_representante || "Representante";
  const empresa = structure.empresa_representacao || "Representação Comercial";
  const base =
    structure.cidade_base && structure.estado_base
      ? `${structure.cidade_base}/${structure.estado_base}`
      : "Base Operacional";
  const regiao = structure.regiao_principal || "Brasil";

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`ESTRUTURA COMERCIAL & OPERACIONAL — ${nome.toUpperCase()}`, cardX + 32, cardY + 68);

  ctx.fillStyle = "#64748b";
  ctx.font = "500 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${empresa}  ·  Base: ${base}  ·  Região: ${regiao}`, cardX + cardW - 32, cardY + 68);
  ctx.textAlign = "left";

  // 4. Coluna Esquerda: Mapa do Brasil com Dias por Mês em Campo
  const colLeftW = 460;
  const contentY = cardY + headerH + 20;
  const contentH = cardH - headerH - 40;

  // Renderiza o mapa SVG para imagem e desenha
  try {
    const svg = buildBrazilMapSvg(
      structure.estados_atendidos || [],
      structure.detalhes_municipais || {},
      structure.dias_campo_por_estado || {}
    );
    const mapPng = await svgToPngDataUrl(svg, 460);
    if (mapPng) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, cardX + 32, contentY + 10, colLeftW, contentH - 20);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = mapPng;
      });
    }
  } catch (err) {
    console.warn("[drawStructureOgCanvas] Falha ao plotar mapa:", err);
  }

  // Linha divisória vertical
  ctx.beginPath();
  ctx.moveTo(cardX + 32 + colLeftW + 24, contentY);
  ctx.lineTo(cardX + 32 + colLeftW + 24, contentY + contentH);
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 5. Coluna Direita: Indicadores e Organograma
  const colRightX = cardX + 32 + colLeftW + 48;
  const colRightW = cardW - (colRightX - cardX) - 32;

  // Grid de 3 Cards de Indicadores
  const cardItemW = (colRightW - 16) / 2;
  const cardItemH = 68;

  // Card 1: Território & Atuação
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#e2e8f0";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(colRightX, contentY, cardItemW, cardItemH, 8);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(colRightX, contentY, cardItemW, cardItemH);
  }
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("TERRITÓRIO & ATUAÇÃO", colRightX + 16, contentY + 22);
  ctx.fillStyle = "#0e7490";
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const totalUfs = (structure.estados_atendidos || []).length;
  const atuacao = MODELO_ATUACAO_LABEL[structure.modelo_atuacao] || "Equipe";
  ctx.fillText(`${totalUfs} UFs  ·  ${atuacao}`, colRightX + 16, contentY + 48);

  // Card 2: Estrutura & Escritório
  const card2X = colRightX + cardItemW + 16;
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#e2e8f0";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(card2X, contentY, cardItemW, cardItemH, 8);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(card2X, contentY, cardItemW, cardItemH);
  }
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("MODELO DE ESCRITÓRIO", card2X + 16, contentY + 22);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const escritorio = MODELO_ESCRITORIO_LABEL[structure.modelo_escritorio] || "Escritório Físico";
  ctx.fillText(escritorio, card2X + 16, contentY + 48);

  // Bloco Organograma Visual
  const organoY = contentY + cardItemH + 20;
  const organoH = contentH - cardItemH - 70;

  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(colRightX, organoY, colRightW, organoH, 10);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(colRightX, organoY, colRightW, organoH);
  }

  // Header do Organograma
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("ORGANOGRAMA DA OPERAÇÃO COMERCIAL", colRightX + 18, organoY + 24);

  // Nível 1: Representante Titular
  const tier1W = colRightW - 36;
  const tier1H = 36;
  const tier1X = colRightX + 18;
  const tier1Y = organoY + 36;
  ctx.fillStyle = "#e0f2fe";
  ctx.strokeStyle = "#0284c7";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(tier1X, tier1Y, tier1W, tier1H, 6);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "#0369a1";
  ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`Nível 1 · Representante Titular: ${nome}`, tier1X + 14, tier1Y + 22);

  // Nível 2: Prepostos
  const prepostos = (structure.equipe || []).filter((e) => e.nivel === "preposto");
  const tier2Y = tier1Y + tier1H + 14;
  const tier2H = 34;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#e2e8f0";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(tier1X, tier2Y, tier1W, tier2H, 6);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const prepText =
    prepostos.length > 0
      ? `Nível 2 · Prepostos de Campo (${prepostos.length}): ${prepostos.map((p) => p.nome).slice(0, 3).join(", ")}`
      : "Nível 2 · Prepostos de Campo: Nenhum cadastrado";
  ctx.fillText(prepText, tier1X + 14, tier2Y + 21);

  // Nível 3: Assistentes
  const assistentes = (structure.equipe || []).filter((e) => e.nivel === "operacao" || e.nivel === "apoio");
  const tier3Y = tier2Y + tier2H + 12;
  const tier3H = 34;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#e2e8f0";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(tier1X, tier3Y, tier1W, tier3H, 6);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "#475569";
  ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const assisText =
    assistentes.length > 0
      ? `Nível 3 · Assistentes & Backoffice (${assistentes.length}): ${assistentes.map((a) => a.nome).slice(0, 3).join(", ")}`
      : "Nível 3 · Assistentes Comerciais: Operação individual";
  ctx.fillText(assisText, tier1X + 14, tier3Y + 21);

  // Rodapé da Coluna Direita
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("PoolFlux · Imersão Comercial Newline · Documento de Alta Resolução", colRightX, contentY + contentH - 8);
}

/** Gera a miniatura do PDF (preferindo renderização direta do PDF via pdfjs ou fallback em canvas) */
export async function generateStructureThumbnail(
  structure: RepStructure,
  pdfBlob?: Blob
): Promise<{ dataUrl: string; blob: Blob }> {
  // 1. Tentar renderizar a página do PDF gerado (mais fiel possível)
  if (pdfBlob) {
    const rendered = await renderPdfBlobToImage(pdfBlob, 1200);
    if (rendered) {
      return rendered;
    }
  }

  // 2. Fallback de alta resolução em Canvas puro 1200x630
  const canvas = document.createElement("canvas");
  await drawStructureOgCanvas(canvas, structure, { width: 1200, height: 630 });

  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), "image/png");
  });

  return { dataUrl, blob };
}

/** Faz upload da imagem de destaque (OpenGraph) para persistência e compartilhamento via WhatsApp */
export async function uploadEstruturaImageToStorage(
  repId: string,
  blob: Blob
): Promise<string> {
  const resultUrl = `https://poolflux.app/api/og-estrutura/${repId}.png`;

  // 1. POST para a rota de API do servidor
  try {
    await fetch(`/api/og-estrutura/${repId}`, {
      method: "POST",
      body: blob,
      headers: { "Content-Type": "image/png" },
    });
  } catch (err) {
    console.warn("[uploadEstruturaImageToStorage] Falha no POST /api/og-estrutura:", err);
  }

  // 2. Upload direto para o bucket Supabase product-images
  try {
    const path = `og-estrutura/${repId}.png`;
    await supabase.storage
      .from("product-images")
      .upload(path, blob, { contentType: "image/png", upsert: true });
  } catch (err) {
    console.warn("[uploadEstruturaImageToStorage] Erro no upload do bucket Supabase:", err);
  }

  return resultUrl;
}
