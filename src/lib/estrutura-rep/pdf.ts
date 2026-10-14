import jsPDF from "jspdf";
import { BRAZIL_STATE_PATHS } from "@/components/director-bi/immersions/brazil-svg-paths";
import type {
  RepStructure,
  MembroEquipe,
  TreinamentoItem,
  ClienteFrequenciaItem,
} from "./types";
import {
  MODELO_ATUACAO_LABEL,
  VINCULO_LABEL,
  MODALIDADE_LABEL,
  TIPO_TREINAMENTO_LABEL,
} from "./types";
import { findBrandLogo } from "./brand-library";

type RGB = [number, number, number];

const C = {
  bg: [241, 245, 249] as RGB,          // slate-100 (fundo do dashboard)
  card: [255, 255, 255] as RGB,        // white
  cardMuted: [248, 250, 252] as RGB,   // slate-50
  border: [226, 232, 240] as RGB,      // slate-200
  borderDark: [203, 213, 225] as RGB,  // slate-300
  text: [15, 23, 42] as RGB,           // slate-900
  textMuted: [100, 116, 139] as RGB,   // slate-500
  textLight: [148, 163, 184] as RGB,   // slate-400
  primary: [14, 116, 144] as RGB,      // cyan-700
  primaryDark: [8, 51, 68] as RGB,     // cyan-950
  primarySoft: [224, 242, 254] as RGB, // sky-100
  sky: [2, 132, 199] as RGB,           // sky-600
  skyDark: [3, 105, 161] as RGB,       // sky-700
  skySoft: [240, 249, 255] as RGB,     // sky-50
  blue: [37, 99, 235] as RGB,          // blue-600
  blueSoft: [239, 246, 255] as RGB,    // blue-50
  emerald: [21, 128, 61] as RGB,       // green-700
  emeraldSoft: [240, 253, 244] as RGB, // green-50
  emeraldBorder: [187, 247, 208] as RGB, // green-200
  amber: [217, 119, 6] as RGB,         // amber-600
  goldBadge: [254, 240, 138] as RGB,   // yellow-200
  goldText: [133, 77, 14] as RGB,      // amber-800
  silverBadge: [226, 232, 240] as RGB, // slate-200
  silverText: [71, 85, 105] as RGB,    // slate-600
  bronzeBadge: [254, 215, 170] as RGB, // orange-200
  bronzeText: [154, 52, 18] as RGB,    // orange-800
  white: [255, 255, 255] as RGB,
};

/** Gera o SVG do mapa do Brasil com os estados atendidos e badges sem colisão */
export function buildBrazilMapSvg(
  estadosAtendidos: string[],
  detalhesMunicipais: Record<string, import("./types").DetalheMunicipal> = {},
  diasCampoPorEstado: Record<string, number> = {}
): string {
  const set = new Set(estadosAtendidos);
  const stateElements = BRAZIL_STATE_PATHS.map((s) => {
    const isSelected = set.has(s.id);
    const fill = isSelected ? "#0e7490" : "#e2e8f0";
    const stroke = isSelected ? "#083344" : "#cbd5e1";
    return `<path d="${s.d}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" />`;
  }).join("");

  const labelElements = BRAZIL_STATE_PATHS.filter((s) => set.has(s.id))
    .map((s) => {
      const dias = detalhesMunicipais[s.id]?.dias_campo_mes ?? diasCampoPorEstado[s.id] ?? 0;
      const isDf = s.id === "DF";
      const radius = isDf ? 8 : 11;

      // Offsets personalizados para estados pequenos ou com vizinhos próximos para evitar sobreposição
      let dxCircle = 0;
      let dyCircle = 0;
      let dxBadge = 0;
      let dyBadge = 0;

      if (s.id === "SE") {
        // Sergipe: joga o badge para o leste no oceano para não colidir com a Bahia
        dxCircle = 4;
        dyCircle = 0;
        dxBadge = 14;
        dyBadge = -4;
      } else if (s.id === "BA") {
        dxBadge = -20;
        dyBadge = 16;
      } else if (s.id === "CE") {
        dxBadge = 8;
        dyBadge = -8;
      } else if (s.id === "DF") {
        dxBadge = 10;
        dyBadge = -8;
      } else {
        dxBadge = 6;
        dyBadge = 6;
      }

      const cx = s.centroid.x + dxCircle;
      const cy = s.centroid.y + dyCircle;

      const ufCircle = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="#ffffff" stroke="#0e7490" stroke-width="1" />
            <text x="${cx}" y="${cy + (isDf ? 3 : 3.5)}" font-family="Helvetica, Arial, sans-serif" font-size="${isDf ? 7.5 : 8.5}" font-weight="bold" fill="#0e7490" text-anchor="middle">${s.id}</text>`;

      const diasBadge = dias > 0
        ? `<g transform="translate(${cx + dxBadge}, ${cy + dyBadge})">
            <rect x="0" y="0" width="46" height="13" rx="6.5" fill="#BAE6FD" stroke="#7DD3FC" stroke-width="0.6" />
            <circle cx="6.5" cy="6.5" r="5.5" fill="#0284C7" />
            <text x="6.5" y="9" font-family="Helvetica, Arial, sans-serif" font-size="7" font-weight="bold" fill="#ffffff" text-anchor="middle">${dias}</text>
            <text x="14" y="6" font-family="Helvetica, Arial, sans-serif" font-size="3.8" font-weight="bold" fill="#0369A1">dias/mês</text>
            <text x="14" y="10.5" font-family="Helvetica, Arial, sans-serif" font-size="3.8" font-weight="bold" fill="#0369A1">em campo</text>
          </g>`
        : "";

      return `<g>${ufCircle}${diasBadge}</g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
    <rect width="800" height="800" fill="#ffffff" rx="12" />
    ${stateElements}
    ${labelElements}
  </svg>`;
}

/** Rasteriza o SVG do mapa para um PNG Data URL para inserção no jsPDF sem manchar o canvas */
export async function svgToPngDataUrl(svgString: string, size = 600): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof document === "undefined" || !svgString) {
      resolve("");
      return;
    }
    try {
      const img = new Image();
      const safeDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

      const timer = setTimeout(() => resolve(""), 3500);
      img.onload = () => {
        clearTimeout(timer);
        try {
          const natW = img.naturalWidth || img.width || size;
          const natH = img.naturalHeight || img.height || size;
          if (natW <= 0 || natH <= 0) {
            resolve("");
            return;
          }

          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, size, size);
            ctx.drawImage(img, 0, 0, size, size);
            try {
              const dataUrl = canvas.toDataURL("image/png");
              resolve(dataUrl);
            } catch {
              resolve("");
            }
          } else {
            resolve("");
          }
        } catch {
          resolve("");
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve("");
      };
      img.src = safeDataUrl;
    } catch {
      resolve("");
    }
  });
}

/** Rasteriza logomarca (SVG data URL, string ou imagem) para um PNG Data URL de alta nitidez para jsPDF */
export async function logoToPngDataUrl(logoUrlOrSvg?: string, width = 240, height = 72): Promise<string> {
  if (!logoUrlOrSvg) return "";
  if (typeof window === "undefined" || typeof document === "undefined") return "";

  if (logoUrlOrSvg.startsWith("data:image/png") || logoUrlOrSvg.startsWith("data:image/jpeg")) {
    return logoUrlOrSvg;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      let src = logoUrlOrSvg;

      if (!src.startsWith("data:") && !src.startsWith("http")) {
        src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src);
      } else if (src.startsWith("http")) {
        img.crossOrigin = "anonymous";
      }

      const timer = setTimeout(() => resolve(""), 3500);
      img.onload = () => {
        clearTimeout(timer);
        try {
          const natW = img.naturalWidth || img.width || width;
          const natH = img.naturalHeight || img.height || height;
          if (natW <= 0 || natH <= 0) {
            resolve("");
            return;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width * 2; // retina 2x
          canvas.height = height * 2;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve("");
            return;
          }

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const padX = 12;
          const padY = 8;
          const maxW = Math.max(10, canvas.width - padX * 2);
          const maxH = Math.max(10, canvas.height - padY * 2);
          const scale = Math.min(maxW / natW, maxH / natH);
          const dw = Math.max(1, natW * scale);
          const dh = Math.max(1, natH * scale);
          const dx = (canvas.width - dw) / 2;
          const dy = (canvas.height - dh) / 2;

          ctx.drawImage(img, dx, dy, dw, dh);
          try {
            const pngUrl = canvas.toDataURL("image/png");
            resolve(pngUrl);
          } catch {
            resolve("");
          }
        } catch {
          resolve("");
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve("");
      };

      img.src = src;
    } catch {
      resolve("");
    }
  });
}

/** Gera um SVG elegante com o nome da marca caso não haja logotipo vetorial oficial */
export function generateTextLogoSvg(name: string): string {
  const cleanName = (name || "").trim().toUpperCase();
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60">
      <rect width="200" height="60" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2" />
      <text x="100" y="38" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="20" text-anchor="middle" fill="#0f172a" letter-spacing="1.5">${cleanName}</text>
    </svg>`
  )}`;
}

/** Extrai mês, dia e dia da semana para o bloco visual de calendário */
function parseTrainingDate(dateStr?: string): { mes: string; dia: string; sem: string } {
  if (!dateStr) return { mes: "DATA", dia: "—", sem: "—" };
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);

      const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
      const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

      return {
        mes: meses[month] || "MÊS",
        dia: String(day).padStart(2, "0"),
        sem: diasSemana[d.getDay()] || "Dia",
      };
    }
  } catch {}
  return { mes: "DATA", dia: dateStr.slice(-2), sem: "Dia" };
}

/** Categoriza os membros da equipe nos 3 níveis hierárquicos do organograma */
function categorizarOrganograma(equipe: MembroEquipe[]) {
  const titulares: MembroEquipe[] = [];
  const prepostos: MembroEquipe[] = [];
  const assistentes: MembroEquipe[] = [];

  equipe.forEach((m) => {
    const niv = m.nivel;
    const cargoLower = (m.cargo || "").toLowerCase();
    const nomeLower = (m.nome || "").toLowerCase();

    if (
      niv === "titular" ||
      cargoLower.includes("titular") ||
      cargoLower.includes("principal") ||
      cargoLower.includes("diretor") ||
      cargoLower.includes("gestor comercial")
    ) {
      titulares.push(m);
    } else if (
      niv === "preposto" ||
      cargoLower.includes("preposto") ||
      cargoLower.includes("campo") ||
      cargoLower.includes("vendedor externo") ||
      cargoLower.includes("representante") ||
      nomeLower.includes("preposto")
    ) {
      prepostos.push(m);
    } else {
      assistentes.push(m);
    }
  });

  return { titulares, prepostos, assistentes };
}

/**
 * Gera o documento executivo em PDF (1 Página Paisagem A4 de Alta Fidelidade)
 * sem sobreposições de textos ou imagens, preservando as logomarcas originais das representadas.
 */
export async function generateRepStructurePdf(
  structure: RepStructure,
  repContact?: { email?: string | null; telefone?: string | null }
): Promise<{ blob: Blob; filename: string; title: string }> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const PW = 841.89; // largura A4 landscape em pt
  const PH = 595.28; // altura A4 landscape em pt
  const M = 16;      // margem padrão
  const W = PW - M * 2; // ~809.89 pt de largura útil

  // 0. Rasteriza imagem do mapa SVG e logomarcas originais em paralelo
  const mapSvg = buildBrazilMapSvg(
    structure.estados_atendidos || [],
    structure.detalhes_municipais || {},
    structure.dias_campo_por_estado || {}
  );
  const mapPngPromise = svgToPngDataUrl(mapSvg, 600);

  const marcasList = structure.marcas_representadas || [];
  const marcasLogosPromise = Promise.all(
    marcasList.slice(0, 5).map(async (m) => {
      const rawLogo = m.logo_url || findBrandLogo(m.nome) || generateTextLogoSvg(m.nome);
      const pngLogo = await logoToPngDataUrl(rawLogo, 240, 72);
      return { ...m, pngLogo };
    })
  );

  const [mapPng, marcasWithLogos] = await Promise.all([mapPngPromise, marcasLogosPromise]);

  // Fundo geral do dashboard (slate-100)
  doc.setFillColor(...C.bg);
  doc.rect(0, 0, PW, PH, "F");

  // Helper para desenhar cartão arredondado
  const drawCard = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: RGB = C.card,
    border: RGB = C.border,
    radius = 6
  ) => {
    doc.setFillColor(...fill);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, w, h, radius, radius, "FD");
  };

  // Helper para desenhar pílula/badge
  const drawBadge = (
    text: string,
    x: number,
    y: number,
    bg: RGB = C.primarySoft,
    fg: RGB = C.sky,
    border: RGB = C.primarySoft,
    fontSize = 6.5
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    const tw = doc.getTextWidth(text);
    const bw = tw + 8;
    const bh = fontSize + 6;
    doc.setFillColor(...bg);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y - bh + 2, bw, bh, 3, 3, "FD");
    doc.setTextColor(...fg);
    doc.text(text, x + 4, y);
    return bw;
  };

  // =========================================================================
  // 1. HEADER CARD (IDENTIFICAÇÃO DO REPRESENTANTE)
  // =========================================================================
  const headH = 50;
  let curY = M;
  drawCard(M, curY, W, headH, C.card, C.border, 6);

  // Avatar circular com iniciais
  const avX = M + 10;
  const avY = curY + 8;
  const avSize = 34;
  doc.setFillColor(...C.primarySoft);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.5);
  doc.roundedRect(avX, avY, avSize, avSize, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.skyDark);
  const initials = (structure.nome_representante || "RP").slice(0, 2).toUpperCase();
  doc.text(initials, avX + avSize / 2, avY + 23, { align: "center" });

  // Nome do Representante + Badge de Atuação
  const infoX = avX + avSize + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...C.text);
  const repNome = structure.nome_representante || "Representante";
  doc.text(repNome.toUpperCase(), infoX, curY + 21);

  const nameWidth = doc.getTextWidth(repNome.toUpperCase());
  const atuacaoLabel = MODELO_ATUACAO_LABEL[structure.modelo_atuacao] || "Estrutura com Equipe";
  drawBadge(atuacaoLabel, infoX + nameWidth + 8, curY + 20, C.primarySoft, C.sky, C.primarySoft, 6.5);

  // Subtítulo: Empresa de Representação • Base • Região com truncamento anti-colisão
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textMuted);
  const empresaTxt = structure.empresa_representacao || "Representação Comercial";
  const baseTxt =
    structure.cidade_base && structure.estado_base
      ? ` • Base: ${structure.cidade_base}/${structure.estado_base}`
      : "";
  const regiaoTxt = structure.regiao_principal ? ` • Região: ${structure.regiao_principal}` : "";
  const subFull = `${empresaTxt}${baseTxt}${regiaoTxt}`;
  const maxSubW = PW - M - 210 - infoX;
  const subTrunc = doc.getTextWidth(subFull) > maxSubW ? `${subFull.slice(0, 56)}...` : subFull;
  doc.text(subTrunc, infoX, curY + 36);

  // Contato no lado direito do Header
  const emailContact = repContact?.email || `${repNome.toLowerCase().replace(/\s+/g, "")}@ribeirotlda.com.br`;
  const phoneContact = repContact?.telefone || "(71) 98752-0000";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textMuted);
  doc.text(`${emailContact}  •  ${phoneContact}`, PW - M - 12, curY + 27, { align: "right" });

  curY += headH + 6;

  // =========================================================================
  // 2. FAIXA DE MARCAS E EMPRESAS REPRESENTADAS (COM LOGOS ORIGINAIS)
  // =========================================================================
  const marcasH = 50;
  drawCard(M, curY, W, marcasH, C.card, C.border, 6);

  // Título da faixa e contagem
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text("MARCAS E EMPRESAS REPRESENTADAS", M + 12, curY + 16);

  const totalMarcas = marcasList.length;
  drawBadge(`${totalMarcas} marcas`, M + 185, curY + 15, C.primarySoft, C.sky, C.primarySoft, 6);

  // Lista de Cards de Marcas (Horizontal) com imagem original da logo
  const numMarcasExibidas = Math.max(1, Math.min(marcasWithLogos.length, 5));
  const marcaCardW = (W - 24 - (numMarcasExibidas - 1) * 8) / numMarcasExibidas;
  const marcaCardH = 26;
  const marcaCardY = curY + 20;

  if (marcasWithLogos.length === 0) {
    drawCard(M + 12, marcaCardY, 130, marcaCardH, C.cardMuted, C.border, 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.textMuted);
    doc.text("Nenhuma marca", M + 12 + 65, marcaCardY + 16, { align: "center" });
  } else {
    marcasWithLogos.forEach((m, idx) => {
      const mX = M + 12 + idx * (marcaCardW + 8);
      drawCard(mX, marcaCardY, marcaCardW, marcaCardH, C.card, C.border, 4);

      if (m.pngLogo) {
        const padX = 6;
        const padY = 3;
        doc.addImage(
          m.pngLogo,
          "PNG",
          mX + padX,
          marcaCardY + padY,
          marcaCardW - padX * 2,
          marcaCardH - padY * 2
        );
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);
        doc.text(m.nome, mX + marcaCardW / 2, marcaCardY + 16, { align: "center" });
      }
    });
  }

  curY += marcasH + 6;

  // =========================================================================
  // 3. GRADE CENTRAL EM 3 COLUNAS (MAPA, TREINAMENTOS, FREQUÊNCIA TOP 10)
  // =========================================================================
  const colGap = 8;
  const colW = (W - colGap * 2) / 3; // ~264.6 pt
  const colH = 236; // Altura otimizada para acomodar perfeitamente o organograma

  const col1X = M;
  const col2X = M + colW + colGap;
  const col3X = M + (colW + colGap) * 2;

  // ---- COLUNA 1: MAPA DE ATUAÇÃO TERRITORIAL ----
  drawCard(col1X, curY, colW, colH, C.card, C.border, 6);

  // Título e Subtítulo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text("MAPA DE ATUAÇÃO TERRITORIAL", col1X + 10, curY + 15);

  const totalUfs = structure.estados_atendidos?.length || 0;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.textMuted);
  doc.text(`${totalUfs} estados atendidos pelo representante`, col1X + 10, curY + 25);

  // Legenda
  doc.setFillColor(...C.primary);
  doc.circle(col1X + colW - 68, curY + 14, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...C.primary);
  doc.text(`Atendido (${totalUfs})`, col1X + colW - 62, curY + 16);

  doc.setFillColor(...C.borderDark);
  doc.circle(col1X + colW - 28, curY + 14, 2.5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...C.textLight);
  doc.text("Outros", col1X + colW - 23, curY + 16);

  // Imagem do Mapa Rasterizado
  if (mapPng) {
    const mapSize = 168;
    const mapImgX = col1X + (colW - mapSize) / 2;
    doc.addImage(mapPng, "PNG", mapImgX, curY + 30, mapSize, mapSize);
  }

  // Rodapé do Card do Mapa: UFs Atendidas e Dias em campo
  const ufsRodapeY = curY + 208;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.textMuted);
  doc.text("UFs Atendidas:", col1X + 10, ufsRodapeY + 9);

  let ufX = col1X + 60;
  (structure.estados_atendidos || []).slice(0, 4).forEach((uf) => {
    const dias =
      structure.detalhes_municipais?.[uf]?.dias_campo_mes ??
      structure.dias_campo_por_estado?.[uf] ??
      0;
    const label = dias > 0 ? `${uf} (${dias}d/mês)` : uf;
    const pillW = label.length * 4.3 + 10;

    doc.setFillColor(...C.primary);
    doc.roundedRect(ufX, ufsRodapeY + 1, pillW, 11, 5, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...C.white);
    doc.text(label, ufX + pillW / 2, ufsRodapeY + 9, { align: "center" });
    ufX += pillW + 4;
  });

  // ---- COLUNA 2: CALENDÁRIO DE TREINAMENTOS ----
  drawCard(col2X, curY, colW, colH, C.card, C.border, 6);

  // Título e Subtítulo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text("CALENDÁRIO DE TREINAMENTOS", col2X + 10, curY + 15);

  const treinamentosList = structure.treinamentos || [];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.textMuted);
  doc.text(`${treinamentosList.length} próximas datas agendadas pelo rep`, col2X + 10, curY + 25);

  // Badge limpo sem botão interativo de tela
  drawBadge(`${treinamentosList.length} Sessões`, col2X + colW - 56, curY + 14, C.primarySoft, C.sky, C.primarySoft, 5.5);

  // Lista de Treinamentos (até 3 cards)
  let trainCardY = curY + 34;
  const trainItemH = 46;

  if (treinamentosList.length === 0) {
    drawCard(col2X + 8, trainCardY, colW - 16, 50, C.cardMuted, C.border, 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    doc.text("Nenhum treinamento agendado", col2X + colW / 2, trainCardY + 28, { align: "center" });
  } else {
    treinamentosList.slice(0, 3).forEach((t) => {
      drawCard(col2X + 8, trainCardY, colW - 16, trainItemH, C.cardMuted, C.border, 4);

      // Bloco de Data (à esquerda)
      const dateBoxW = 30;
      const dateBoxH = 36;
      const dateBoxX = col2X + 12;
      const dateBoxY = trainCardY + 5;
      drawCard(dateBoxX, dateBoxY, dateBoxW, dateBoxH, C.primarySoft, C.border, 3);

      const dParsed = parseTrainingDate(t.data);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);
      doc.setTextColor(...C.skyDark);
      doc.text(dParsed.mes, dateBoxX + dateBoxW / 2, dateBoxY + 9, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...C.text);
      doc.text(dParsed.dia, dateBoxX + dateBoxW / 2, dateBoxY + 22, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(4.8);
      doc.setTextColor(...C.textMuted);
      doc.text(dParsed.sem, dateBoxX + dateBoxW / 2, dateBoxY + 31, { align: "center" });

      // Detalhes do Treinamento (à direita)
      const detX = dateBoxX + dateBoxW + 8;
      const tipoLabel = TIPO_TREINAMENTO_LABEL[t.tipo] || "Treinamento Técnico";

      // Tag do Tipo
      doc.setFillColor(...C.sky);
      doc.circle(detX + 2, trainCardY + 12, 1.8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);
      doc.setTextColor(...C.skyDark);
      const tipoShort = tipoLabel.length > 26 ? `${tipoLabel.slice(0, 24)}...` : tipoLabel;
      doc.text(tipoShort, detX + 7, trainCardY + 14);

      // Nome do Cliente
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.setTextColor(...C.text);
      const cliShort = t.cliente_nome.length > 24 ? `${t.cliente_nome.slice(0, 22)}...` : t.cliente_nome;
      doc.text(cliShort, detX, trainCardY + 26);

      // Ministrante e Horário
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.2);
      doc.setTextColor(...C.textMuted);
      const ministrante = t.ministrante || structure.nome_representante || "Anselmo (Rep Titular)";
      const infoSub = t.horario ? `${ministrante} • ${t.horario}` : ministrante;
      doc.text(infoSub, detX, trainCardY + 38);

      trainCardY += trainItemH + 6;
    });
  }

  // ---- COLUNA 3: FREQUÊNCIA DE VISITA (TOP 10 + DEMAIS) ----
  drawCard(col3X, curY, colW, colH, C.card, C.border, 6);

  // Título e Subtítulo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text("FREQUÊNCIA DE VISITA (TOP 10)", col3X + 10, curY + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...C.textMuted);
  doc.text("Média de ciclo de retorno presencial em cada cliente", col3X + 10, curY + 25);

  const freqList = structure.frequencia_visitas || [];
  drawBadge(`${freqList.length}/10 Clientes`, col3X + colW - 56, curY + 14, C.primarySoft, C.sky, C.primarySoft, 5.5);

  // Top 4 Clientes Chave com espaçamento confortável
  let freqCardY = curY + 34;
  const freqItemH = 34;

  freqList.slice(0, 4).forEach((f, idx) => {
    drawCard(col3X + 8, freqCardY, colW - 16, freqItemH, C.cardMuted, C.border, 4);

    const rankX = col3X + 17;
    const rankY = freqCardY + 17;
    const rankNum = f.posicao || idx + 1;
    let rankBg = C.cardMuted;
    let rankFg = C.textMuted;
    if (rankNum === 1) {
      rankBg = C.goldBadge;
      rankFg = C.goldText;
    } else if (rankNum === 2) {
      rankBg = C.silverBadge;
      rankFg = C.silverText;
    } else if (rankNum === 3) {
      rankBg = C.bronzeBadge;
      rankFg = C.bronzeText;
    }

    doc.setFillColor(...rankBg);
    doc.circle(rankX, rankY, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...rankFg);
    doc.text(`${rankNum}º`, rankX, rankY + 2, { align: "center" });

    // Nome e Localidade do Cliente
    const cInfoX = col3X + 29;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...C.text);
    const cliNome = f.cliente_nome.length > 20 ? `${f.cliente_nome.slice(0, 18)}...` : f.cliente_nome;
    doc.text(cliNome, cInfoX, freqCardY + 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2);
    doc.setTextColor(...C.textMuted);
    const cLoc = `${f.cidade || "SALVADOR"} - ${f.uf || "BA"}`;
    doc.text(cLoc, cInfoX, freqCardY + 25);

    // Badge de Frequência (à direita)
    const fBadgeW = 50;
    const fBadgeX = col3X + colW - 12 - fBadgeW;
    const fBadgeY = freqCardY + 6;
    doc.setFillColor(...C.emeraldSoft);
    doc.setDrawColor(...C.emeraldBorder);
    doc.setLineWidth(0.4);
    doc.roundedRect(fBadgeX, fBadgeY, fBadgeW, 21, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...C.emerald);
    doc.text(`A cada ${f.frequencia_dias} dias`, fBadgeX + fBadgeW / 2, fBadgeY + 9, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    doc.setTextColor(...C.textMuted);
    const freqSub = f.frequencia_dias <= 7 ? "Semanal" : f.frequencia_dias <= 15 ? "Quinzenal" : "Mensal";
    doc.text(freqSub, fBadgeX + fBadgeW / 2, fBadgeY + 17, { align: "center" });

    freqCardY += freqItemH + 4;
  });

  // Card Fixo no Rodapé da Coluna 3: Demais Clientes da Carteira
  const demaisCardY = curY + 190;
  const demaisCardH = 34;
  drawCard(col3X + 8, demaisCardY, colW - 16, demaisCardH, C.skySoft, C.primarySoft, 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...C.skyDark);
  doc.text("Demais Clientes da Carteira", col3X + 16, demaisCardY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.2);
  doc.setTextColor(...C.textMuted);
  doc.text("Frequência de visita presencial para todos", col3X + 16, demaisCardY + 25);

  const freqDemais = structure.frequencia_demais_clientes ?? 40;
  const dBadgeW = 52;
  const dBadgeX = col3X + colW - 12 - dBadgeW;
  const dBadgeY = demaisCardY + 6;
  doc.setFillColor(...C.primarySoft);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(dBadgeX, dBadgeY, dBadgeW, 21, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(...C.skyDark);
  doc.text(`A cada ${freqDemais} dias`, dBadgeX + dBadgeW / 2, dBadgeY + 9, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.8);
  doc.setTextColor(...C.textMuted);
  const demaisSub = freqDemais <= 30 ? "Mensal" : freqDemais <= 60 ? "Bimestral" : "Trimestral";
  doc.text(demaisSub, dBadgeX + dBadgeW / 2, dBadgeY + 17, { align: "center" });

  curY += colH + 6;

  // =========================================================================
  // 4. ORGANOGRAMA OPERACIONAL DA EQUIPE (3 NÍVEIS HIERÁRQUICOS SEM SOBREPOSIÇÃO)
  // =========================================================================
  const organoH = PH - curY - M; // ~219 pt
  drawCard(M, curY, W, organoH, C.card, C.border, 6);

  // Título e Subtítulo do Organograma
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text("ORGANOGRAMA OPERACIONAL DA EQUIPE", M + 12, curY + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.textMuted);
  doc.text(
    "Estrutura hierárquica: Representante Titular  ->  Prepostos  ->  Assistentes Comerciais",
    M + 12,
    curY + 25
  );

  const equipeCompleta = structure.equipe || [];
  const { titulares, prepostos, assistentes } = categorizarOrganograma(equipeCompleta);

  // Badges da hierarquia à direita sem colisão
  let orgBadgeX = PW - M - 210;
  orgBadgeX += drawBadge(`Titular (${titulares.length})`, orgBadgeX, curY + 14, C.primarySoft, C.sky, C.primarySoft, 5.5) + 4;
  orgBadgeX += drawBadge(`Prepostos (${prepostos.length})`, orgBadgeX, curY + 14, C.blueSoft, C.blue, C.blueSoft, 5.5) + 4;
  orgBadgeX += drawBadge(`Assistentes (${assistentes.length})`, orgBadgeX, curY + 14, C.cardMuted, C.textMuted, C.border, 5.5) + 4;
  drawBadge(`${equipeCompleta.length} Integrantes`, orgBadgeX, curY + 14, C.cardMuted, C.textMuted, C.border, 5.5);

  const centerCanvasX = PW / 2;

  // ---- NÍVEL 1: TITULAR ----
  const tier1PillY = curY + 31;
  const tier1PillW = 148;
  doc.setFillColor(...C.sky);
  doc.roundedRect(centerCanvasX - tier1PillW / 2, tier1PillY, tier1PillW, 10, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(...C.white);
  doc.text("NÍVEL 1 • REPRESENTANTE PRINCIPAL (TOPO)", centerCanvasX, tier1PillY + 7.5, { align: "center" });

  const tier1CardY = tier1PillY + 13; // Espaçamento limpo após o pill, ZERO sobreposição!
  const tier1CardW = 340;
  const tier1CardH = 42;
  const tier1CardX = centerCanvasX - tier1CardW / 2;

  drawCard(tier1CardX, tier1CardY, tier1CardW, tier1CardH, C.skySoft, C.primarySoft, 5);
  const titular = titulares[0] || {
    id: "titular-def",
    nome: structure.nome_representante || "Representante Titular",
    cargo: "Representante Titular / Gestor Comercial",
    vinculo: "socio" as const,
    modalidade: "hibrido" as const,
    nivel: "titular" as const,
    responsabilidades: ["Negociações estratégicas", "Abertura de contas-chave", "Visitas a especificadores e lojistas"],
  };

  // Avatar Titular
  const tAvSize = 24;
  const tAvX = tier1CardX + 8;
  const tAvY = tier1CardY + 5;
  doc.setFillColor(...C.primarySoft);
  doc.setDrawColor(...C.border);
  doc.roundedRect(tAvX, tAvY, tAvSize, tAvSize, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.skyDark);
  doc.text(titular.nome.slice(0, 2).toUpperCase(), tAvX + tAvSize / 2, tAvY + 16, { align: "center" });

  // Nome e Cargo
  const tInfoX = tAvX + tAvSize + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text(titular.nome, tInfoX, tier1CardY + 14);

  const tNomeW = doc.getTextWidth(titular.nome);
  drawBadge("TITULAR", tInfoX + tNomeW + 6, tier1CardY + 13, C.primarySoft, C.skyDark, C.primarySoft, 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.skyDark);
  doc.text(titular.cargo || "Representante Titular / Gestor Comercial", tInfoX, tier1CardY + 24);

  // Badges Vínculo e Modalidade à direita
  const vincLabel = VINCULO_LABEL[titular.vinculo] || "Sócio";
  const modLabel = MODALIDADE_LABEL[titular.modalidade] || "Híbrido";
  const b1W = drawBadge(vincLabel, tier1CardX + tier1CardW - 74, tier1CardY + 13, C.card, C.textMuted, C.border, 4.8);
  drawBadge(modLabel, tier1CardX + tier1CardW - 74 + b1W + 4, tier1CardY + 13, C.card, C.textMuted, C.border, 4.8);

  // Responsabilidades do Titular
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.2);
  doc.setTextColor(...C.textMuted);
  const respStr = (titular.responsabilidades || ["Gestão comercial e relacionamento"]).join("  •  ");
  const respTrunc = respStr.length > 70 ? `${respStr.slice(0, 68)}...` : respStr;
  doc.text(respTrunc, tInfoX, tier1CardY + 34);

  // ---- CONEXÃO E NÍVEL 2: PREPOSTOS ----
  const tier1BottomY = tier1CardY + tier1CardH;
  const tier2ForkY = tier1BottomY + 12;
  const tier2PillY = tier1BottomY + 3;
  const tier2PillW = 158;

  // Tronco vertical conectando Titular -> Fork
  doc.setDrawColor(...C.borderDark);
  doc.setLineWidth(0.8);
  doc.line(centerCanvasX, tier1BottomY, centerCanvasX, tier2ForkY);

  // Pílula do Nível 2
  doc.setFillColor(...C.blue);
  doc.roundedRect(centerCanvasX - tier2PillW / 2, tier2PillY, tier2PillW, 10, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(...C.white);
  doc.text(`NÍVEL 2 • PREPOSTOS COMERCIAIS & CAMPO (${prepostos.length})`, centerCanvasX, tier2PillY + 7.5, { align: "center" });

  const numPrepostos = Math.max(1, Math.min(prepostos.length, 3));
  const pCardW = Math.min(220, (W - 40 - (numPrepostos - 1) * 16) / numPrepostos);
  const pCardH = 38;
  const pTotalW = numPrepostos * pCardW + (numPrepostos - 1) * 16;
  const pStartX = centerCanvasX - pTotalW / 2;
  const tier2CardY = tier2ForkY + 4; // Gap limpo após o fork, ZERO sobreposição!

  if (prepostos.length === 0) {
    drawCard(centerCanvasX - 100, tier2CardY, 200, 28, C.cardMuted, C.border, 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.textMuted);
    doc.text("Nenhum preposto cadastrado", centerCanvasX, tier2CardY + 17, { align: "center" });
  } else {
    // Linha horizontal ramificada conectando todos os prepostos
    const firstCenterX = pStartX + pCardW / 2;
    const lastCenterX = pStartX + (numPrepostos - 1) * (pCardW + 16) + pCardW / 2;
    doc.setDrawColor(...C.borderDark);
    doc.setLineWidth(0.8);
    doc.line(firstCenterX, tier2ForkY, lastCenterX, tier2ForkY);

    prepostos.slice(0, 3).forEach((p, idx) => {
      const pX = pStartX + idx * (pCardW + 16);
      const pCenterX = pX + pCardW / 2;

      // Drop vertical da ramificação até o topo do card
      doc.line(pCenterX, tier2ForkY, pCenterX, tier2CardY);

      drawCard(pX, tier2CardY, pCardW, pCardH, C.cardMuted, C.border, 4);

      // Avatar
      const pAvSize = 20;
      const pAvX = pX + 7;
      const pAvY = tier2CardY + 5;
      doc.setFillColor(...C.blueSoft);
      doc.setDrawColor(...C.border);
      doc.roundedRect(pAvX, pAvY, pAvSize, pAvSize, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.blue);
      doc.text(p.nome.slice(0, 2).toUpperCase(), pAvX + pAvSize / 2, pAvY + 14, { align: "center" });

      // Nome e Badge Preposto
      const pInfoX = pAvX + pAvSize + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.setTextColor(...C.text);
      doc.text(p.nome, pInfoX, tier2CardY + 13);

      drawBadge("Preposto", pX + pCardW - 44, tier2CardY + 12, C.blueSoft, C.blue, C.blueSoft, 4.6);

      // Vínculo e Modalidade
      const pVinc = VINCULO_LABEL[p.vinculo] || "PJ";
      const pMod = MODALIDADE_LABEL[p.modalidade] || "Remoto";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5);
      doc.setTextColor(...C.textMuted);
      doc.text(`${pVinc}  ·  ${pMod}`, pInfoX, tier2CardY + 23);

      // Responsabilidade
      const pResp = (p.responsabilidades || ["Atendimento e vendas em campo"]).join(" • ");
      const pRespTrunc = pResp.length > 38 ? `${pResp.slice(0, 36)}...` : pResp;
      doc.text(pRespTrunc, pInfoX, tier2CardY + 32);
    });
  }

  // ---- CONEXÃO E NÍVEL 3: ASSISTENTES ----
  const tier2BottomY = tier2CardY + (prepostos.length === 0 ? 28 : pCardH);
  const tier3ForkY = tier2BottomY + 12;
  const tier3PillY = tier2BottomY + 3;
  const tier3PillW = 180;

  // Tronco vertical conectando Prepostos -> Assistentes
  doc.setDrawColor(...C.borderDark);
  doc.setLineWidth(0.8);
  doc.line(centerCanvasX, tier2BottomY, centerCanvasX, tier3ForkY);

  // Pílula do Nível 3
  doc.setFillColor(...C.textMuted);
  doc.roundedRect(centerCanvasX - tier3PillW / 2, tier3PillY, tier3PillW, 10, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(...C.white);
  doc.text(`NÍVEL 3 • ASSISTENTES COMERCIAIS & BACKOFFICE (${assistentes.length})`, centerCanvasX, tier3PillY + 7.5, { align: "center" });

  const numAssistentes = Math.max(1, Math.min(assistentes.length, 4));
  const aCardW = Math.min(165, (W - 32 - (numAssistentes - 1) * 8) / numAssistentes);
  const aCardH = 36;
  const aTotalW = numAssistentes * aCardW + (numAssistentes - 1) * 8;
  const aStartX = centerCanvasX - aTotalW / 2;
  const tier3CardY = tier3ForkY + 4; // Gap limpo após o fork, ZERO sobreposição!

  if (assistentes.length === 0) {
    drawCard(centerCanvasX - 100, tier3CardY, 200, 26, C.cardMuted, C.border, 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.textMuted);
    doc.text("Nenhum assistente cadastrado", centerCanvasX, tier3CardY + 16, { align: "center" });
  } else {
    // Linha horizontal ramificada conectando todos os assistentes
    const firstACenterX = aStartX + aCardW / 2;
    const lastACenterX = aStartX + (numAssistentes - 1) * (aCardW + 8) + aCardW / 2;
    doc.setDrawColor(...C.borderDark);
    doc.setLineWidth(0.8);
    doc.line(firstACenterX, tier3ForkY, lastACenterX, tier3ForkY);

    assistentes.slice(0, 4).forEach((a, idx) => {
      const aX = aStartX + idx * (aCardW + 8);
      const aCenterX = aX + aCardW / 2;

      // Drop vertical da ramificação até o topo do card
      doc.line(aCenterX, tier3ForkY, aCenterX, tier3CardY);

      drawCard(aX, tier3CardY, aCardW, aCardH, C.cardMuted, C.border, 4);

      // Avatar
      const aAvSize = 18;
      const aAvX = aX + 6;
      const aAvY = tier3CardY + 5;
      doc.setFillColor(...C.card);
      doc.setDrawColor(...C.border);
      doc.roundedRect(aAvX, aAvY, aAvSize, aAvSize, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text(a.nome.slice(0, 2).toUpperCase(), aAvX + aAvSize / 2, aAvY + 13, { align: "center" });

      // Nome e Badge Assistente
      const aInfoX = aAvX + aAvSize + 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(...C.text);
      const aNome = a.nome.length > 13 ? `${a.nome.slice(0, 11)}...` : a.nome;
      doc.text(aNome, aInfoX, tier3CardY + 12);

      drawBadge("Assistente", aX + aCardW - 39, tier3CardY + 11, C.card, C.textMuted, C.border, 4.4);

      // Vínculo e Modalidade
      const aVinc = VINCULO_LABEL[a.vinculo] || "PJ";
      const aMod = MODALIDADE_LABEL[a.modalidade] || "Remoto";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(4.8);
      doc.setTextColor(...C.textMuted);
      doc.text(`${aVinc} · ${aMod}`, aInfoX, tier3CardY + 22);

      // Responsabilidade
      const aResp = (a.responsabilidades || ["Atendimento e apoio"]).join(" • ");
      const aRespTrunc = aResp.length > 28 ? `${aResp.slice(0, 26)}...` : aResp;
      doc.text(aRespTrunc, aInfoX, tier3CardY + 30);
    });
  }

  // Gera o slug para o nome do arquivo
  const slug = (structure.nome_representante || "representante")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const filename = `Estrutura-Rep-${slug}.pdf`;
  const title = `Estrutura Comercial e Operacional — ${structure.nome_representante || "Representante"}`;

  const blob = doc.output("blob");

  return { blob, filename, title };
}
