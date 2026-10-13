import { supabase } from "@/integrations/supabase/client";

export interface ChartItem {
  familia: string;
  atingimento: number;
  fill: string;
  farol?: string;
}

/**
 * Desenha o gráfico de Resultado por Família com estilo de card em alta resolução
 * (1200x630), ideal para pré-visualizações de OpenGraph e WhatsApp.
 */
export function drawFamiliasChartCanvas(
  canvas: HTMLCanvasElement,
  items: ChartItem[],
  options?: {
    clientName?: string;
    width?: number;
    height?: number;
  }
) {
  const width = options?.width || 1200;
  const height = options?.height || 630;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 1. Fundo geral suave
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  // 2. Card do gráfico (com cantos arredondados e borda limpa)
  const pad = 24;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;
  const cardX = pad;
  const cardY = pad;
  const radius = 20;

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

  // 3. Cabeçalho do Card
  const headerH = 70;
  ctx.beginPath();
  ctx.moveTo(cardX, cardY + headerH);
  ctx.lineTo(cardX + cardW, cardY + headerH);
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Ícone de barras no cabeçalho
  const iconX = cardX + 32;
  const iconY = cardY + 24;
  ctx.fillStyle = "#64748b";
  ctx.fillRect(iconX, iconY + 12, 4, 12);
  ctx.fillRect(iconX + 6, iconY + 4, 4, 20);
  ctx.fillRect(iconX + 12, iconY + 8, 4, 16);

  // Título
  ctx.fillStyle = "#334155";
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("RESULTADO POR FAMÍLIA", iconX + 26, cardY + 42);

  // Subtítulo do cliente no topo direito
  if (options?.clientName) {
    ctx.fillStyle = "#64748b";
    ctx.font = "500 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(options.clientName, cardX + cardW - 32, cardY + 42);
    ctx.textAlign = "left";
  }

  // 4. Área de plotagem do gráfico
  const plotX = cardX + 90;
  const plotY = cardY + headerH + 30;
  const plotW = cardW - 130;
  const plotH = cardH - headerH - 150;

  const maxVal = Math.max(120, ...items.map((i) => i.atingimento || 0));
  const domainMax = Math.max(120, Math.ceil(maxVal / 30) * 30);
  const yTicks = [0, 30, 60, 90, 120];
  if (domainMax > 120) {
    for (let t = 150; t <= domainMax; t += 30) {
      yTicks.push(t);
    }
  }

  const getY = (val: number) => {
    return plotY + plotH - (val / domainMax) * plotH;
  };

  // Grade e Ticks do Eixo Y
  ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (const tick of yTicks) {
    const yPos = getY(tick);
    ctx.fillText(`${tick}%`, plotX - 16, yPos);

    ctx.beginPath();
    if (typeof ctx.setLineDash === "function") {
      ctx.setLineDash(tick === 100 ? [6, 6] : [3, 4]);
    }
    ctx.moveTo(plotX, yPos);
    ctx.lineTo(plotX + plotW, yPos);
    ctx.strokeStyle = tick === 100 ? "#94a3b8" : "#f1f5f9";
    ctx.lineWidth = tick === 100 ? 1.5 : 1;
    ctx.stroke();
    if (typeof ctx.setLineDash === "function") {
      ctx.setLineDash([]);
    }
  }

  // Linha base (Eixo X)
  const baseY = getY(0);
  ctx.beginPath();
  ctx.moveTo(plotX, baseY);
  ctx.lineTo(plotX + plotW, baseY);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (!items.length) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sem dados de Performance disponíveis", plotX + plotW / 2, plotY + plotH / 2);
    return;
  }

  // 5. Barras com cores e porcentagens
  const barCount = items.length;
  const slotW = plotW / barCount;
  const barW = Math.min(84, slotW * 0.65);

  items.forEach((item, idx) => {
    const cx = plotX + idx * slotW + slotW / 2;
    const bx = cx - barW / 2;
    const val = Math.max(0, item.atingimento);
    const by = getY(val);
    const bHeight = Math.max(2, baseY - by);

    ctx.save();
    ctx.beginPath();
    const r = Math.min(6, bHeight / 2);
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(bx, by, barW, bHeight, [r, r, 0, 0]);
    } else {
      ctx.rect(bx, by, barW, bHeight);
    }
    ctx.fillStyle = item.fill.startsWith("#") ? item.fill : `#${item.fill}`;
    ctx.fill();
    ctx.restore();

    // Rótulo da porcentagem acima da barra
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#334155";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const pctText = `${val.toFixed(1).replace(".", ",")}%`;
    ctx.fillText(pctText, cx, by - 6);

    // Rótulo do Eixo X com rotação
    ctx.save();
    ctx.translate(cx, baseY + 18);
    ctx.rotate((-25 * Math.PI) / 180);
    ctx.fillStyle = "#475569";
    ctx.font = "600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(item.familia, 0, 0);
    ctx.restore();
  });
}

/**
 * Converte o gráfico em Blob PNG pronto para envio e armazenamento.
 */
export async function generateFamiliasChartBlob(
  items: ChartItem[],
  options?: { clientName?: string; width?: number; height?: number }
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  drawFamiliasChartCanvas(canvas, items, options);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/**
 * Faz upload do print do gráfico para o bucket público `product-images` no Supabase,
 * garantindo que o WhatsApp e outras redes possam carregar como imagem de OpenGraph.
 */
export async function uploadChartImageToStorage(
  reportId: string,
  blob: Blob
): Promise<string | null> {
  try {
    const path = `og-charts/${reportId}.png`;
    const { error: upErr } = await supabase.storage
      .from("product-images")
      .upload(path, blob, { contentType: "image/png", upsert: true });

    if (upErr) {
      console.warn("Falha ao salvar print do gráfico no storage:", upErr);
      return null;
    }

    const { data: pubData } = supabase.storage
      .from("product-images")
      .getPublicUrl(path);

    return pubData?.publicUrl ?? null;
  } catch (err) {
    console.warn("Erro ao fazer upload do print do gráfico:", err);
    return null;
  }
}

/**
 * Retorna a URL pública de OpenGraph para o gráfico de um relatório executivo.
 */
export function getReportOgImageUrl(reportId?: string | null): string {
  if (!reportId) return "https://poolflux.app/og-charts/default.png";
  if (reportId === "0ab3e2a1-f172-43a5-a633-9c347c09f06f") {
    return "https://poolflux.app/og-charts/0ab3e2a1-f172-43a5-a633-9c347c09f06f.png";
  }
  return `https://poolflux.app/og-charts/${reportId}.png`;
}
