import type {
  RepStructure,
  MembroEquipe,
  TreinamentoItem,
  ClienteFrequenciaItem,
  RepresentadaItem,
} from "./types";
import {
  MODELO_ATUACAO_LABEL,
  MODELO_ESCRITORIO_LABEL,
  MODELO_NEGOCIO_LABEL,
  VINCULO_LABEL,
  MODALIDADE_LABEL,
} from "./types";
import { findBrandLogo } from "./brand-library";
import { buildBrazilMapSvg, svgToPngDataUrl, logoToPngDataUrl } from "./pdf";

// Utility: desenha retângulo arredondado no canvas 2D com segurança contra raios ou tamanhos inválidos
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | number[]
) {
  if (w <= 0 || h <= 0) return;
  const rawRadius = typeof r === "number" ? r : r[0] || 0;
  const radius = Math.max(0, Math.min(rawRadius, w / 2, h / 2));

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Trunca texto com reticências se exceder a largura máxima com segurança para undefined/null
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string | null | undefined,
  maxWidth: number
): string {
  const safeText = String(text || "").trim();
  if (!safeText || maxWidth <= 0) return "";
  try {
    if (ctx.measureText(safeText).width <= maxWidth) return safeText;
    let truncated = safeText;
    while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return `${truncated}…`;
  } catch {
    return safeText;
  }
}

// Converte Data URL base64 diretamente para Blob em memória sem depender de canvas.toBlob assíncrono
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return new Blob([], { type: "image/png" });
  }
}

// Carrega imagem HTML a partir de Data URL / URL com proteção crossOrigin e timeout
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof document === "undefined" || !src) {
      resolve(null);
      return;
    }
    try {
      const img = new Image();
      if (!src.startsWith("data:") && !src.startsWith("blob:")) {
        img.crossOrigin = "anonymous";
      }
      const timer = setTimeout(() => resolve(null), 3500);
      img.onload = () => {
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}

/** Formata data YYYY-MM-DD para objeto visual { mes, dia, sem } */
function parseDateParts(dateStr?: string): { mes: string; dia: string; sem: string } {
  if (!dateStr) return { mes: "DATA", dia: "--", sem: "---" };
  const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const diasSem = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  try {
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return {
        mes: meses[month] || "MES",
        dia: String(day).padStart(2, "0"),
        sem: diasSem[d.getDay()] || "---",
      };
    }
  } catch {
    // noop
  }
  return { mes: "AGD", dia: "01", sem: "Seg" };
}

export interface InfographicResult {
  dataUrl: string;
  blob: Blob;
  filename: string;
  width: number;
  height: number;
}

/**
 * Gera uma imagem infográfico vertical de alta resolução (2x retina) da Estrutura Comercial
 * no formato e estilo visual do dashboard executivo da Imersão PoolFlux / Newline.
 */
export async function generateRepInfographicImage(
  structure: RepStructure,
  options?: { scale?: number; skipImages?: boolean }
): Promise<InfographicResult> {
  const nomeRep = structure.nome_representante || "Representante";
  const empresaRep = structure.empresa_representacao || "Representação Comercial";
  const slug = nomeRep
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `infografico-estrutura-${slug || "comercial"}.png`;

  // Fallback para Node / ambiente de teste sem canvas DOM
  if (typeof window === "undefined" || typeof document === "undefined") {
    const dummyBlob = new Blob(["mock-png-data"], { type: "image/png" });
    return {
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      blob: dummyBlob,
      filename,
      width: 860,
      height: 1600,
    };
  }

  const baseW = 860;
  const scale = options?.scale || 2; // 2x para retina / mobile ultra-nítido
  const pad = 24;
  const cardW = baseW - pad * 2; // 812px

  // Preparação de dados
  const marcas = structure.marcas_representadas || [];
  const ufs = structure.estados_atendidos || [];
  const treinamentos = (structure.treinamentos || []).slice(0, 3);
  const clientesFreq = (structure.frequencia_visitas || []).slice(0, 5);
  const equipe = structure.equipe || [];

  // Iniciais do representante para avatares nos cards (definido no escopo da função)
  const repInitials = (nomeRep || "RP")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  // Pré-renderização paralela dos logos das marcas
  const brandLogosMap: Record<string, string> = {};
  if (!options?.skipImages) {
    await Promise.all(
      marcas.map(async (m) => {
        const resolved = findBrandLogo(m.nome, marcas);
        if (resolved) {
          try {
            const pngUrl = await logoToPngDataUrl(resolved, 160, 60);
            if (pngUrl) brandLogosMap[m.id || m.nome] = pngUrl;
          } catch {
            // fallback
          }
        }
      })
    );
  }

  // Pré-renderização do mapa do Brasil SVG para PNG
  let mapPngUrl = "";
  if (!options?.skipImages) {
    try {
      const mapSvg = buildBrazilMapSvg(
        structure.estados_atendidos || [],
        structure.detalhes_municipais || {},
        structure.dias_campo_por_estado || {}
      );
      const safeDataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(mapSvg);
      mapPngUrl = (await svgToPngDataUrl(mapSvg, 700)) || safeDataUri;
    } catch (err) {
      console.warn("[generateRepInfographicImage] Falha ao renderizar mapa SVG:", err);
    }
  }

  // Medidas dinâmicas de altura
  const headerCardH = marcas.length > 5 ? 240 : 185;
  const mapCardH = 510;
  const twoColsH = 340;
  const organoCardH = 430;
  const footerH = 40;
  const gap = 18;

  const totalLogicalH =
    pad +
    headerCardH +
    gap +
    mapCardH +
    gap +
    twoColsH +
    gap +
    organoCardH +
    gap +
    footerH +
    pad;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(baseW * scale);
  canvas.height = Math.round(totalLogicalH * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não foi possível criar contexto 2D para o infográfico.");
  }

  ctx.scale(scale, scale);

  // 1. Fundo Global do Infográfico (slate suave moderno)
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, 0, baseW, totalLogicalH);

  let curY = pad;

  // =========================================================================
  // CARD 1: CABEÇALHO DO REPRESENTANTE & FAIXA DE MARCAS REPRESENTADAS
  // =========================================================================
  {
    const cardX = pad;
    const cardY = curY;
    const cardH = headerCardH;

    // Fundo branco do card com sombra suave
    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.04)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Avatar com iniciais
    const avatarX = cardX + 22;
    const avatarY = cardY + 20;
    const avatarR = 24;
    ctx.beginPath();
    ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
    ctx.fillStyle = "#e0f2fe";
    ctx.fill();
    ctx.strokeStyle = "#bae6fd";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#0284c7";
    ctx.font = "bold 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(repInitials, avatarX + avatarR, avatarY + avatarR + 6);
    ctx.textAlign = "left";

    // Nome do Representante + Badge de Atuação
    const textStartX = avatarX + avatarR * 2 + 16;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const nomeTruncado = fitText(ctx, nomeRep.toUpperCase(), 440);
    ctx.fillText(nomeTruncado, textStartX, avatarY + 22);

    const nomeWidth = ctx.measureText(nomeTruncado).width;
    const badgeX = textStartX + nomeWidth + 12;
    const badgeY = avatarY + 6;
    const atuacaoLabel = MODELO_ATUACAO_LABEL[structure.modelo_atuacao] || "Equipe";
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const badgeTextW = ctx.measureText(atuacaoLabel).width;

    drawRoundRect(ctx, badgeX, badgeY, badgeTextW + 18, 22, 6);
    ctx.fillStyle = "#e0f2fe";
    ctx.fill();
    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#0369a1";
    ctx.fillText(atuacaoLabel, badgeX + 9, badgeY + 15);

    // Subtítulo: Empresa • Base • Região
    ctx.fillStyle = "#64748b";
    ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const baseInfo =
      structure.cidade_base && structure.estado_base
        ? `${structure.cidade_base}/${structure.estado_base}`
        : "Base operacional";
    const regiaoInfo = structure.regiao_principal || "Brasil";
    const subtitle = `${empresaRep}  •  Base: ${baseInfo}  •  Região: ${regiaoInfo}`;
    ctx.fillText(fitText(ctx, subtitle, cardW - (textStartX - cardX) - 24), textStartX, avatarY + 42);

    // Divisor horizontal
    const dividerY = cardY + 78;
    ctx.beginPath();
    ctx.moveTo(cardX + 18, dividerY);
    ctx.lineTo(cardX + cardW - 18, dividerY);
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rótulo da seção de Marcas
    const marcasHeaderY = dividerY + 16;
    ctx.fillStyle = "#475569";
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("MARCAS E EMPRESAS REPRESENTADAS", cardX + 22, marcasHeaderY);

    // Badge com contagem de marcas
    const totalMarcas = marcas.length;
    const countLabel = `${totalMarcas} marcas`;
    const countBadgeW = ctx.measureText(countLabel).width + 16;
    const countBadgeX = cardX + 22 + ctx.measureText("MARCAS E EMPRESAS REPRESENTADAS").width + 10;
    drawRoundRect(ctx, countBadgeX, marcasHeaderY - 12, countBadgeW, 18, 4);
    ctx.fillStyle = "#e0f2fe";
    ctx.fill();
    ctx.fillStyle = "#0284c7";
    ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(countLabel, countBadgeX + 8, marcasHeaderY + 1);

    // Cards das Marcas com Logos Oficiais
    const brandsRowY = marcasHeaderY + 12;
    const brandsPerRow = Math.min(marcas.length || 1, 5);
    const brandCardW = (cardW - 44 - (brandsPerRow - 1) * 12) / brandsPerRow;
    const brandCardH = 58;

    for (let i = 0; i < Math.min(marcas.length, 5); i++) {
      const marca = marcas[i];
      const bx = cardX + 22 + i * (brandCardW + 12);
      const by = brandsRowY;

      drawRoundRect(ctx, bx, by, brandCardW, brandCardH, 8);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.stroke();

      const logoPng = brandLogosMap[marca?.id || marca?.nome || ""];
      let loadedLogo: HTMLImageElement | null = null;
      if (logoPng) {
        loadedLogo = await loadImage(logoPng);
      }

      const natW = loadedLogo?.naturalWidth || loadedLogo?.width || 0;
      const natH = loadedLogo?.naturalHeight || loadedLogo?.height || 0;
      let logoDrawn = false;

      if (loadedLogo && natW > 0 && natH > 0) {
        try {
          const padX = 12;
          const padY = 8;
          const maxW = Math.max(10, brandCardW - padX * 2);
          const maxH = Math.max(10, brandCardH - padY * 2);
          const aspect = natW / natH;
          let dw = maxW;
          let dh = dw / (aspect || 1);
          if (dh > maxH) {
            dh = maxH;
            dw = dh * aspect;
          }
          dw = Math.max(1, dw);
          dh = Math.max(1, dh);
          const dx = bx + (brandCardW - dw) / 2;
          const dy = by + (brandCardH - dh) / 2;
          ctx.drawImage(loadedLogo, dx, dy, dw, dh);
          logoDrawn = true;
        } catch {
          logoDrawn = false;
        }
      }

      if (!logoDrawn) {
        // Fallback tipográfico elegante
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(fitText(ctx, marca?.nome || "Marca", brandCardW - 16), bx + brandCardW / 2, by + 34);
        ctx.textAlign = "left";
      }
    }

    curY += cardH + gap;
  }

  // =========================================================================
  // CARD 2: MAPA DE ATUAÇÃO TERRITORIAL (DIAS POR MÊS EM CAMPO)
  // =========================================================================
  {
    const cardX = pad;
    const cardY = curY;
    const cardH = mapCardH;

    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.04)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Ícone de Pin + Título
    ctx.fillStyle = "#0284c7";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("📍 MAPA DE ATUAÇÃO TERRITORIAL", cardX + 22, cardY + 28);

    ctx.fillStyle = "#64748b";
    ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`${ufs.length} estados atendidos pelo representante`, cardX + 22, cardY + 48);

    // Legenda no canto direito
    const legX = cardX + cardW - 220;
    const legY = cardY + 26;

    // Dot Atendido
    ctx.beginPath();
    ctx.arc(legX, legY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#0284c7";
    ctx.fill();
    ctx.fillStyle = "#0369a1";
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`Atendido (${ufs.length})`, legX + 10, legY + 4);

    // Dot Não Atendido
    const leg2X = legX + 100;
    ctx.beginPath();
    ctx.arc(leg2X, legY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#cbd5e1";
    ctx.fill();
    ctx.fillStyle = "#64748b";
    ctx.font = "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Não atendido", leg2X + 10, legY + 4);

    // Caixa interna do Mapa com borda suave
    const mapBoxX = cardX + 22;
    const mapBoxY = cardY + 62;
    const mapBoxW = cardW - 44;
    const mapBoxH = cardH - 110;

    drawRoundRect(ctx, mapBoxX, mapBoxY, mapBoxW, mapBoxH, 12);
    ctx.fillStyle = "#f8fafc";
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Desenha o Mapa SVG renderizado
    if (mapPngUrl && !options?.skipImages) {
      const mapImg = await loadImage(mapPngUrl);
      const natW = mapImg?.naturalWidth || mapImg?.width || 0;
      const natH = mapImg?.naturalHeight || mapImg?.height || 0;
      if (mapImg && natW > 0 && natH > 0) {
        try {
          const aspect = natW / natH;
          let dw = mapBoxW - 20;
          let dh = dw / aspect;
          if (dh > mapBoxH - 16) {
            dh = mapBoxH - 16;
            dw = dh * aspect;
          }
          const dx = mapBoxX + (mapBoxW - dw) / 2;
          const dy = mapBoxY + (mapBoxH - dh) / 2;
          ctx.drawImage(mapImg, dx, dy, dw, dh);
        } catch (err) {
          console.warn("[infographic] Erro ao desenhar mapa:", err);
        }
      }
    } else {
      // Fallback vetorial limpo caso skipImages esteja ativo
      const centerX = mapBoxX + mapBoxW / 2;
      const centerY = mapBoxY + mapBoxH / 2;
      ctx.fillStyle = "#0284c7";
      ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("COBERTURA REGIONAL & ATUAÇÃO EM CAMPO", centerX, centerY - 20);

      ctx.fillStyle = "#64748b";
      ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${ufs.length} estados atendidos com rotina periódica de visitas`, centerX, centerY + 6);
      ctx.textAlign = "left";
    }

    // Barra inferior: UFs Atendidas com pílulas
    const barY = cardY + cardH - 32;
    ctx.fillStyle = "#475569";
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("UFs Atendidas:", cardX + 22, barY + 12);

    let ufPillX = cardX + 22 + ctx.measureText("UFs Atendidas:").width + 12;
    const diasMap = structure.dias_campo_por_estado || {};

    for (const uf of ufs) {
      const dias = diasMap[uf] || 0;
      const ufLabel = dias > 0 ? `${uf} (${dias}d)` : uf;
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const pillW = ctx.measureText(ufLabel).width + 18;

      drawRoundRect(ctx, ufPillX, barY, pillW, 22, 11);
      ctx.fillStyle = "#0284c7";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(ufLabel, ufPillX + 9, barY + 15);

      ufPillX += pillW + 8;
      if (ufPillX > cardX + cardW - 60) break;
    }

    curY += cardH + gap;
  }

  // =========================================================================
  // CARD 3: DUAS COLUNAS LADO A LADO (TREINAMENTOS + FREQUÊNCIA TOP 10)
  // =========================================================================
  {
    const colW = (cardW - 16) / 2;
    const colH = twoColsH;

    // --- COLUNA ESQUERDA: CALENDÁRIO DE TREINAMENTOS ---
    {
      const cx = pad;
      const cy = curY;

      ctx.save();
      ctx.shadowColor = "rgba(15, 23, 42, 0.04)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      drawRoundRect(ctx, cx, cy, colW, colH, 16);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Cabeçalho
      ctx.fillStyle = "#0284c7";
      ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("📅 CALENDÁRIO DE TREINAMENTOS", cx + 18, cy + 26);

      ctx.fillStyle = "#64748b";
      ctx.font = "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("3 próximas datas agendadas pelo rep", cx + 18, cy + 44);

      // Badge total sessões
      const sessLabel = `${treinamentos.length} Sessões`;
      ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const sessBadgeW = ctx.measureText(sessLabel).width + 14;
      const sessBadgeX = cx + colW - sessBadgeW - 18;
      drawRoundRect(ctx, sessBadgeX, cy + 14, sessBadgeW, 20, 6);
      ctx.fillStyle = "#f1f5f9";
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = "#475569";
      ctx.fillText(sessLabel, sessBadgeX + 7, cy + 28);

      // Lista de Treinamentos
      let itemY = cy + 62;
      const itemH = 68;
      const itemW = colW - 36;

      if (treinamentos.length === 0) {
        drawRoundRect(ctx, cx + 18, itemY, itemW, 90, 10);
        ctx.fillStyle = "#f8fafc";
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#94a3b8";
        ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Nenhum treinamento agendado no período.", cx + colW / 2, itemY + 50);
        ctx.textAlign = "left";
      } else {
        for (const tr of treinamentos) {
          drawRoundRect(ctx, cx + 18, itemY, itemW, itemH, 10);
          ctx.fillStyle = "#f8fafc";
          ctx.fill();
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 1;
          ctx.stroke();

          // Bloco da Data (Mês / Dia / Sem)
          const dateParts = parseDateParts(tr.data);
          const dateBoxX = cx + 26;
          const dateBoxY = itemY + 10;
          const dateBoxW = 46;
          const dateBoxH = 48;

          drawRoundRect(ctx, dateBoxX, dateBoxY, dateBoxW, dateBoxH, 8);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.textAlign = "center";
          ctx.fillStyle = "#0284c7";
          ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText(dateParts.mes, dateBoxX + dateBoxW / 2, dateBoxY + 13);

          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText(dateParts.dia, dateBoxX + dateBoxW / 2, dateBoxY + 31);

          ctx.fillStyle = "#64748b";
          ctx.font = "500 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.fillText(dateParts.sem, dateBoxX + dateBoxW / 2, dateBoxY + 43);
          ctx.textAlign = "left";

          // Pílula do Tipo de Treinamento
          const infoX = dateBoxX + dateBoxW + 12;
          const tipoText = tr.tipo || "Treinamento Técnico";
          ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          const tipoW = ctx.measureText(tipoText).width + 16;
          drawRoundRect(ctx, infoX, dateBoxY + 3, tipoW, 18, 4);
          ctx.fillStyle = "#e0f2fe";
          ctx.fill();
          ctx.fillStyle = "#0369a1";
          ctx.fillText(tipoText, infoX + 8, dateBoxY + 15);

          // Pílula de Status (Planejado vs Realizado)
          const isDone = tr.status === "realizado";
          const statusText = isDone ? "Realizado" : "Planejado";
          const statusX = infoX + tipoW + 6;
          ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          const statusW = ctx.measureText(statusText).width + 14;
          drawRoundRect(ctx, statusX, dateBoxY + 3, statusW, 18, 4);
          ctx.fillStyle = isDone ? "#ecfdf5" : "#f1f5f9";
          ctx.fill();
          ctx.strokeStyle = isDone ? "#a7f3d0" : "#cbd5e1";
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.fillStyle = isDone ? "#047857" : "#475569";
          ctx.fillText(statusText, statusX + 7, dateBoxY + 15);

          // Nome do Cliente
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          const clientName = fitText(ctx, (tr.cliente_nome || "Cliente").toUpperCase(), itemW - 80);
          ctx.fillText(clientName, infoX, dateBoxY + 38);

          itemY += itemH + 10;
        }
      }
    }

    // --- COLUNA DIREITA: FREQUÊNCIA DE VISITA (TOP 10) ---
    {
      const cx = pad + colW + 16;
      const cy = curY;

      ctx.save();
      ctx.shadowColor = "rgba(15, 23, 42, 0.04)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      drawRoundRect(ctx, cx, cy, colW, colH, 16);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Cabeçalho
      ctx.fillStyle = "#0284c7";
      ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("🔄 FREQUÊNCIA DE VISITA (TOP 10)", cx + 18, cy + 26);

      ctx.fillStyle = "#64748b";
      ctx.font = "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Média de retorno presencial por cliente", cx + 18, cy + 44);

      // Badge total clientes
      const totalClientes = (structure.frequencia_visitas || []).length;
      const cliLabel = `${totalClientes}/10 Clientes`;
      ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const cliBadgeW = ctx.measureText(cliLabel).width + 14;
      const cliBadgeX = cx + colW - cliBadgeW - 18;
      drawRoundRect(ctx, cliBadgeX, cy + 14, cliBadgeW, 20, 6);
      ctx.fillStyle = "#f1f5f9";
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = "#475569";
      ctx.fillText(cliLabel, cliBadgeX + 7, cy + 28);

      // Lista Top Clientes
      let itemY = cy + 58;
      const itemH = 46;
      const itemW = colW - 36;

      for (let i = 0; i < Math.min(clientesFreq.length, 4); i++) {
        const cli = clientesFreq[i];
        drawRoundRect(ctx, cx + 18, itemY, itemW, itemH, 8);
        ctx.fillStyle = "#f8fafc";
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Círculo de Ranking (1º, 2º, 3º destacados)
        const rankCircleX = cx + 32;
        const rankCircleY = itemY + itemH / 2;
        ctx.beginPath();
        ctx.arc(rankCircleX, rankCircleY, 11, 0, Math.PI * 2);
        if (i === 0) {
          ctx.fillStyle = "#f59e0b"; // Ouro
        } else if (i === 1) {
          ctx.fillStyle = "#94a3b8"; // Prata
        } else if (i === 2) {
          ctx.fillStyle = "#d97706"; // Bronze
        } else {
          ctx.fillStyle = "#cbd5e1";
        }
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${i + 1}º`, rankCircleX, rankCircleY + 3.5);
        ctx.textAlign = "left";

        // Nome do Cliente e Localidade
        const textX = rankCircleX + 18;
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        const maxNameW = itemW - 180;
        ctx.fillText(fitText(ctx, (cli.cliente_nome || "Cliente").toUpperCase(), maxNameW), textX, itemY + 19);

        ctx.fillStyle = "#64748b";
        ctx.font = "500 9.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        const localUf = (cli as any).estado || cli.uf || "BA";
        const local = `${cli.cidade || "Salvador"} - ${localUf}`;
        ctx.fillText(fitText(ctx, local, maxNameW), textX, itemY + 33);

        // Badge de Frequência (Verde)
        const badgeFreqW = 86;
        const badgeFreqH = 24;
        const badgeFreqX = cx + 18 + itemW - badgeFreqW - 10;
        const badgeFreqY = itemY + (itemH - badgeFreqH) / 2;

        drawRoundRect(ctx, badgeFreqX, badgeFreqY, badgeFreqW, badgeFreqH, 6);
        ctx.fillStyle = "#ecfdf5";
        ctx.fill();
        ctx.strokeStyle = "#a7f3d0";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#047857";
        ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`A cada ${cli.frequencia_dias} dias`, badgeFreqX + badgeFreqW / 2, badgeFreqY + 16);
        ctx.textAlign = "left";

        itemY += itemH + 6;
      }

      // Demais Clientes da Base (Card inferior fixo)
      const demaisY = itemY + 2;
      const demaisDias = structure.frequencia_demais_clientes ?? 40;
      drawRoundRect(ctx, cx + 18, demaisY, itemW, 44, 8);
      ctx.fillStyle = "#f0f9ff";
      ctx.fill();
      ctx.strokeStyle = "#bae6fd";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#0369a1";
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Demais Clientes da Carteira", cx + 32, demaisY + 19);

      ctx.fillStyle = "#0284c7";
      ctx.font = "500 9.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Frequência de visita presencial padrão", cx + 32, demaisY + 33);

      const dBadgeW = 86;
      const dBadgeX = cx + 18 + itemW - dBadgeW - 10;
      const dBadgeY = demaisY + 10;
      drawRoundRect(ctx, dBadgeX, dBadgeY, dBadgeW, 24, 6);
      ctx.fillStyle = "#0284c7";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`A cada ${demaisDias} dias`, dBadgeX + dBadgeW / 2, dBadgeY + 16);
      ctx.textAlign = "left";
    }

    curY += colH + gap;
  }

  // =========================================================================
  // CARD 4: ORGANOGRAMA OPERACIONAL DA EQUIPE (3 NÍVEIS HIERÁRQUICOS)
  // =========================================================================
  {
    const cardX = pad;
    const cardY = curY;
    const cardH = organoCardH;

    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.04)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Cabeçalho do Organograma
    ctx.fillStyle = "#0284c7";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("👥 ORGANOGRAMA OPERACIONAL DA EQUIPE", cardX + 22, cardY + 26);

    ctx.fillStyle = "#64748b";
    ctx.font = "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(
      "Estrutura Hierárquica: Representante Titular  ➔  Prepostos  ➔  Assistentes Comerciais",
      cardX + 22,
      cardY + 44
    );

    // Badge total integrantes
    const totalEquipe = equipe.length + 1;
    const eqLabel = `${totalEquipe} Integrantes`;
    ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const eqBadgeW = ctx.measureText(eqLabel).width + 16;
    const eqBadgeX = cardX + cardW - eqBadgeW - 22;
    drawRoundRect(ctx, eqBadgeX, cardY + 16, eqBadgeW, 22, 6);
    ctx.fillStyle = "#e0f2fe";
    ctx.fill();
    ctx.fillStyle = "#0284c7";
    ctx.fillText(eqLabel, eqBadgeX + 8, cardY + 31);

    // Divisor
    ctx.beginPath();
    ctx.moveTo(cardX + 22, cardY + 58);
    ctx.lineTo(cardX + cardW - 22, cardY + 58);
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // NÍVEL 1: CARD DO REPRESENTANTE TITULAR (CENTRALIZADO)
    const treeStartX = cardX + 22;
    const treeW = cardW - 44;
    const treeCenterX = treeStartX + treeW / 2;

    const t1W = Math.min(treeW * 0.58, 380);
    const t1H = 68;
    const t1X = treeCenterX - t1W / 2;
    const t1Y = cardY + 76;

    // Pill de Nível 1
    const pill1Text = "NÍVEL 1 · REPRESENTANTE PRINCIPAL / TITULAR";
    ctx.font = "bold 9.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const pill1W = ctx.measureText(pill1Text).width + 18;
    drawRoundRect(ctx, treeCenterX - pill1W / 2, t1Y - 10, pill1W, 18, 9);
    ctx.fillStyle = "#0284c7";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(pill1Text, treeCenterX, t1Y + 3);
    ctx.textAlign = "left";

    // Card Titular
    drawRoundRect(ctx, t1X, t1Y + 12, t1W, t1H, 10);
    ctx.fillStyle = "#f0f9ff";
    ctx.fill();
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Avatar Titular
    const t1AvR = 18;
    const t1AvX = t1X + 16;
    const t1AvY = t1Y + 12 + (t1H - t1AvR * 2) / 2;
    ctx.beginPath();
    ctx.arc(t1AvX + t1AvR, t1AvY + t1AvR, t1AvR, 0, Math.PI * 2);
    ctx.fillStyle = "#0284c7";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(repInitials, t1AvX + t1AvR, t1AvY + t1AvR + 4.5);
    ctx.textAlign = "left";

    // Textos Titular
    const t1TextX = t1AvX + t1AvR * 2 + 14;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(fitText(ctx, nomeRep.toUpperCase(), t1W - 80), t1TextX, t1Y + 34);

    ctx.fillStyle = "#0284c7";
    ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Representante Titular / Diretor Comercial", t1TextX, t1Y + 49);

    ctx.fillStyle = "#64748b";
    ctx.font = "500 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Negociações estratégicas • Contas-chave • Gestão", t1TextX, t1Y + 63);

    // Linha vertical conectora de Nível 1 para Nível 2
    const conn1Y1 = t1Y + 12 + t1H;
    const conn1Y2 = conn1Y1 + 24;
    ctx.beginPath();
    ctx.moveTo(treeCenterX, conn1Y1);
    ctx.lineTo(treeCenterX, conn1Y2);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Dot na conexão
    ctx.beginPath();
    ctx.arc(treeCenterX, conn1Y2, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#0284c7";
    ctx.fill();

    // NÍVEL 2: PREPOSTOS COMERCIAIS
    const prepostos = equipe.filter((e) => e.nivel === "preposto");
    const t2PillY = conn1Y2 + 4;
    const pill2Text = `NÍVEL 2 · PREPOSTOS COMERCIAIS A CAMPO (${prepostos.length})`;
    ctx.font = "bold 9.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const pill2W = ctx.measureText(pill2Text).width + 18;
    drawRoundRect(ctx, treeCenterX - pill2W / 2, t2PillY, pill2W, 18, 9);
    ctx.fillStyle = "#0284c7";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(pill2Text, treeCenterX, t2PillY + 13);
    ctx.textAlign = "left";

    const t2RowY = t2PillY + 24;
    const t2H = 58;
    const prepostosCount = Math.max(prepostos.length, 1);
    const t2ColW = Math.min((treeW - (prepostosCount - 1) * 16) / prepostosCount, 320);
    const t2StartX = treeCenterX - (prepostosCount * t2ColW + (prepostosCount - 1) * 16) / 2;

    // Linha horizontal conectora entre os prepostos
    if (prepostos.length > 1) {
      const pFirstX = t2StartX + t2ColW / 2;
      const pLastX = t2StartX + (prepostos.length - 1) * (t2ColW + 16) + t2ColW / 2;
      ctx.beginPath();
      ctx.moveTo(pFirstX, t2RowY - 6);
      ctx.lineTo(pLastX, t2RowY - 6);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (prepostos.length === 0) {
      const pbx = treeCenterX - 140;
      drawRoundRect(ctx, pbx, t2RowY, 280, 48, 8);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#64748b";
      ctx.font = "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Atuação direta do titular sem prepostos", treeCenterX, t2RowY + 28);
      ctx.textAlign = "left";
    } else {
      for (let i = 0; i < prepostos.length; i++) {
        const prep = prepostos[i];
        const pbx = t2StartX + i * (t2ColW + 16);
        drawRoundRect(ctx, pbx, t2RowY, t2ColW, t2H, 8);
        ctx.fillStyle = "#f8fafc";
        ctx.fill();
        ctx.strokeStyle = "#bae6fd";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(fitText(ctx, prep.nome || "Preposto", t2ColW - 80), pbx + 14, t2RowY + 22);

        // Badge Preposto
        const pBadgeW = 58;
        const pBadgeX = pbx + t2ColW - pBadgeW - 10;
        drawRoundRect(ctx, pBadgeX, t2RowY + 10, pBadgeW, 16, 4);
        ctx.fillStyle = "#e0f2fe";
        ctx.fill();
        ctx.fillStyle = "#0284c7";
        ctx.font = "bold 8.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Preposto", pBadgeX + pBadgeW / 2, t2RowY + 22);
        ctx.textAlign = "left";

        ctx.fillStyle = "#64748b";
        ctx.font = "500 9.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        const prepVinculo = (prep.vinculo && VINCULO_LABEL[prep.vinculo]) || (prep as any).tipo_contrato || "Prestador";
        const prepMod = (prep.modalidade && MODALIDADE_LABEL[prep.modalidade]) || (prep as any).modelo_trabalho || "Remoto";
        const prepSub = `${prepVinculo}  •  ${prepMod}`;
        ctx.fillText(fitText(ctx, prepSub, t2ColW - 28), pbx + 14, t2RowY + 38);

        ctx.fillStyle = "#0369a1";
        ctx.font = "500 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        const prepAtrib = (prep.responsabilidades && prep.responsabilidades.length > 0)
          ? prep.responsabilidades.join(" • ")
          : ((prep as any).atribuicoes || prep.cargo || "Visitas em campo e vendas");
        ctx.fillText(fitText(ctx, prepAtrib, t2ColW - 28), pbx + 14, t2RowY + 50);
      }
    }

    // Linha vertical conectora de Nível 2 para Nível 3
    const conn2Y1 = t2RowY + t2H;
    const conn2Y2 = conn2Y1 + 22;
    ctx.beginPath();
    ctx.moveTo(treeCenterX, conn2Y1);
    ctx.lineTo(treeCenterX, conn2Y2);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Dot
    ctx.beginPath();
    ctx.arc(treeCenterX, conn2Y2, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#64748b";
    ctx.fill();

    // NÍVEL 3: ASSISTENTES COMERCIAIS & BACKOFFICE
    const assistentes = equipe.filter((e) => e.nivel === "operacao" || e.nivel === "apoio" || !e.nivel);
    const t3PillY = conn2Y2 + 4;
    const pill3Text = `NÍVEL 3 · ASSISTENTES COMERCIAIS & BACKOFFICE (${assistentes.length})`;
    ctx.font = "bold 9.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const pill3W = ctx.measureText(pill3Text).width + 18;
    drawRoundRect(ctx, treeCenterX - pill3W / 2, t3PillY, pill3W, 18, 9);
    ctx.fillStyle = "#475569";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(pill3Text, treeCenterX, t3PillY + 13);
    ctx.textAlign = "left";

    const t3RowY = t3PillY + 24;
    const t3H = 56;
    const assisCount = Math.max(assistentes.length, 1);
    const t3ColW = Math.min((treeW - (assisCount - 1) * 12) / assisCount, 240);
    const t3StartX = treeCenterX - (assisCount * t3ColW + (assisCount - 1) * 12) / 2;

    if (assistentes.length > 1) {
      const aFirstX = t3StartX + t3ColW / 2;
      const aLastX = t3StartX + (assistentes.length - 1) * (t3ColW + 12) + t3ColW / 2;
      ctx.beginPath();
      ctx.moveTo(aFirstX, t3RowY - 6);
      ctx.lineTo(aLastX, t3RowY - 6);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (assistentes.length === 0) {
      const abx = treeCenterX - 140;
      drawRoundRect(ctx, abx, t3RowY, 280, 44, 8);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#64748b";
      ctx.font = "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Operação direta sem equipe interna", treeCenterX, t3RowY + 26);
      ctx.textAlign = "left";
    } else {
      for (let i = 0; i < assistentes.length; i++) {
        const ass = assistentes[i];
        const abx = t3StartX + i * (t3ColW + 12);
        drawRoundRect(ctx, abx, t3RowY, t3ColW, t3H, 8);
        ctx.fillStyle = "#f8fafc";
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(fitText(ctx, ass.nome || "Assistente", t3ColW - 74), abx + 12, t3RowY + 20);

        // Badge Assistente
        const aBadgeW = 56;
        const aBadgeX = abx + t3ColW - aBadgeW - 8;
        drawRoundRect(ctx, aBadgeX, t3RowY + 8, aBadgeW, 16, 4);
        ctx.fillStyle = "#f1f5f9";
        ctx.fill();
        ctx.fillStyle = "#475569";
        ctx.font = "bold 8px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Assistente", aBadgeX + aBadgeW / 2, t3RowY + 19);
        ctx.textAlign = "left";

        ctx.fillStyle = "#64748b";
        ctx.font = "500 9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        const assVinculo = (ass.vinculo && VINCULO_LABEL[ass.vinculo]) || (ass as any).tipo_contrato || "Prestador";
        const assMod = (ass.modalidade && MODALIDADE_LABEL[ass.modalidade]) || (ass as any).modelo_trabalho || "Remoto";
        const assSub = `${assVinculo} • ${assMod}`;
        ctx.fillText(fitText(ctx, assSub, t3ColW - 20), abx + 12, t3RowY + 35);

        ctx.fillStyle = "#475569";
        ctx.font = "500 8.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        const assAtrib = (ass.responsabilidades && ass.responsabilidades.length > 0)
          ? ass.responsabilidades.join(" • ")
          : ((ass as any).atribuicoes || ass.cargo || "Atendimento e suporte");
        ctx.fillText(fitText(ctx, assAtrib, t3ColW - 20), abx + 12, t3RowY + 48);
      }
    }

    curY += cardH + gap;
  }

  // =========================================================================
  // FOOTER MARCA D'ÁGUA POOLFLUX
  // =========================================================================
  {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "PoolFlux · Imersão Comercial Newline · Documento de Inteligência Comercial e Atuação Regional",
      baseW / 2,
      curY + 16
    );
    ctx.textAlign = "left";
  }

  // Exporta imagem final PNG de altíssima fidelidade
  let dataUrl = "";
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch (err) {
    console.error("[infographic] Falha ao exportar canvas para dataUrl:", err);
  }

  // Se o canvas tiver sido contaminado por restrições de CORS/SVG no navegador, aciona fallback vetorial 100% seguro
  if (!dataUrl && !options?.skipImages) {
    console.warn("[infographic] Canvas com restrição de segurança. Acionando renderização vetorial segura...");
    return generateRepInfographicImage(structure, { ...options, skipImages: true });
  }

  const blob = dataUrl ? dataUrlToBlob(dataUrl) : new Blob([], { type: "image/png" });

  return {
    dataUrl,
    blob,
    filename,
    width: canvas.width,
    height: canvas.height,
  };
}

// =========================================================================
// CACHE EM MEMÓRIA & PERSISTÊNCIA ANTECIPADA DO INFOGRÁFICO
// =========================================================================

const infographicMemoryCache = new Map<string, InfographicResult>();

export function getCachedInfographic(repId?: string | null): InfographicResult | null {
  if (!repId) return null;
  return infographicMemoryCache.get(repId) || null;
}

export function setCachedInfographic(repId: string, result: InfographicResult): void {
  if (!repId || !result) return;
  infographicMemoryCache.set(repId, result);
}

/**
 * Tenta carregar o infográfico já existente no cache em memória ou no banco/storage.
 * Retorna null se não houver imagem prévia válida.
 */
export async function loadExistingInfographic(
  structure: RepStructure
): Promise<InfographicResult | null> {
  const repId = structure.representative_id;
  if (!repId) return null;

  // 1. Verifica cache rápido de memória
  const memoryCached = getCachedInfographic(repId);
  if (memoryCached) return memoryCached;

  // 2. Se a estrutura tem URL persistida ou o endpoint og-estrutura possui o PNG pronto
  try {
    const url = `/api/og-estrutura/${repId}.png?v=${encodeURIComponent(structure.infographic_updated_at || structure.updated_at || "1")}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("image/png") && !contentType.includes("image")) {
      return null;
    }

    const blob = await res.blob();
    // Se o fallback padrão default.png foi retornado (menos de 4KB), não considera pré-gerado do representante
    if (!blob || blob.size < 4000) return null;

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });

    if (!dataUrl) return null;

    const nomeRep = structure.nome_representante || "Representante";
    const repSlug = nomeRep
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const result: InfographicResult = {
      dataUrl,
      blob,
      filename: `infografico-estrutura-${repSlug || "comercial"}.png`,
      width: 1720,
      height: 3200,
    };

    setCachedInfographic(repId, result);
    return result;
  } catch (err) {
    console.warn("[loadExistingInfographic] Não foi possível carregar imagem preexistente:", err);
    return null;
  }
}

/**
 * Gera o infográfico em alta resolução, armazena no Storage Supabase e salva no banco de dados.
 * Quando o usuário clicar em "Compartilhar Whats", o infográfico já terá existido!
 */
export async function generateAndSaveInfographic(
  structure: RepStructure
): Promise<{ result: InfographicResult; updatedStructure: RepStructure }> {
  // 1. Renderiza no canvas
  const result = await generateRepInfographicImage(structure);
  if (!result.dataUrl) {
    throw new Error("Canvas gerado sem dados de imagem.");
  }

  // 2. Armazena no cache imediato em memória
  setCachedInfographic(structure.representative_id, result);

  // 3. Faz upload para o bucket e API de armazenamento
  let resultUrl = `https://poolflux.app/api/og-estrutura/${structure.representative_id}.png`;
  try {
    const { uploadEstruturaImageToStorage } = await import("./thumbnail");
    resultUrl = await uploadEstruturaImageToStorage(structure.representative_id, result.blob);
  } catch (uploadErr) {
    console.warn("[generateAndSaveInfographic] Falha ao enviar para storage:", uploadErr);
  }

  // 4. Salva os metadados na estrutura (Supabase + LocalStorage)
  const nowIso = new Date().toISOString();
  const updatedStructure: RepStructure = {
    ...structure,
    infographic_url: resultUrl,
    infographic_updated_at: nowIso,
  };

  try {
    const { saveRepStructure } = await import("./storage");
    await saveRepStructure(updatedStructure);
  } catch (saveErr) {
    console.warn("[generateAndSaveInfographic] Falha ao salvar estrutura no banco:", saveErr);
  }

  return { result, updatedStructure };
}

