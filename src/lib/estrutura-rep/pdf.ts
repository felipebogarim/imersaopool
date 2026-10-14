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

/** Gera o SVG do mapa do Brasil com os estados atendidos destacados */
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
      const radius = isDf ? 9 : 13;
      const ufCircle = `<circle cx="${s.centroid.x}" cy="${s.centroid.y}" r="${radius}" fill="#ffffff" stroke="#0e7490" stroke-width="0.8" />
            <text x="${s.centroid.x}" y="${s.centroid.y + (isDf ? 3 : 4)}" font-family="Helvetica, Arial, sans-serif" font-size="${isDf ? 8 : 10}" font-weight="bold" fill="#0e7490" text-anchor="middle">${s.id}</text>`;
      const diasBadge = dias > 0
        ? `<g transform="translate(${s.centroid.x + 4}, ${s.centroid.y + 3})">
            <rect x="0" y="4" width="50" height="14" rx="7" fill="#BAE6FD" stroke="#7DD3FC" stroke-width="0.6" />
            <circle cx="6.5" cy="11" r="7.5" fill="#BAE6FD" />
            <text x="6.5" y="13.8" font-family="Helvetica, Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#0369A1" text-anchor="middle">${dias}</text>
            <text x="16.5" y="9.2" font-family="Helvetica, Arial, sans-serif" font-size="4" font-weight="bold" fill="#0F172A">dias por mês</text>
            <text x="16.5" y="14.5" font-family="Helvetica, Arial, sans-serif" font-size="4" font-weight="bold" fill="#0F172A">em campo</text>
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

/** Rasteriza o SVG do mapa para um PNG Data URL para inserção no jsPDF */
export async function svgToPngDataUrl(svgString: string, size = 600): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      resolve("");
      return;
    }
    try {
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          const dataUrl = canvas.toDataURL("image/png");
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } else {
          URL.revokeObjectURL(url);
          resolve("");
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve("");
      };
      img.src = url;
    } catch {
      resolve("");
    }
  });
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
      const mes = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
      const dia = String(day).padStart(2, "0");
      const sem = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      const semCapitalized = sem.charAt(0).toUpperCase() + sem.slice(1);
      return { mes, dia, sem: semCapitalized };
    }
  } catch {
    // fallback
  }
  return { mes: "DATA", dia: dateStr.slice(-2), sem: "" };
}

/** Classifica a equipe nos 3 níveis hierárquicos para o organograma do PDF */
function categorizarOrganograma(equipe: MembroEquipe[]) {
  const titulares: MembroEquipe[] = [];
  const prepostos: MembroEquipe[] = [];
  const assistentes: MembroEquipe[] = [];

  equipe.forEach((m, idx) => {
    const cargoLower = (m.cargo || "").toLowerCase();

    // 1. Titular / Representante Principal
    if (
      m.nivel === "titular" ||
      cargoLower.includes("titular") ||
      cargoLower.includes("representante principal") ||
      cargoLower.includes("gestor comercial") ||
      cargoLower.includes("gestor geral") ||
      cargoLower.includes("sócio diretor") ||
      (m.vinculo === "socio" && !cargoLower.includes("assistente") && !cargoLower.includes("preposto")) ||
      (idx === 0 && !equipe.some((item) => item.nivel === "titular"))
    ) {
      titulares.push(m);
      return;
    }

    // 2. Prepostos Comerciais / Vendas Externas / Campo
    if (
      m.nivel === "preposto" ||
      m.nivel === "lideranca" ||
      cargoLower.includes("preposto") ||
      cargoLower.includes("vendedor") ||
      cargoLower.includes("comercial externo") ||
      cargoLower.includes("executivo") ||
      cargoLower.includes("consultor externo") ||
      (cargoLower.includes("campo") && !cargoLower.includes("assistente"))
    ) {
      prepostos.push(m);
      return;
    }

    // 3. Assistentes Comerciais / Backoffice / Operação / Apoio
    assistentes.push(m);
  });

  if (titulares.length === 0 && equipe.length > 0) {
    const primeiro = equipe[0];
    titulares.push(primeiro);
    const pIdx = prepostos.findIndex((x) => x.id === primeiro.id);
    if (pIdx >= 0) prepostos.splice(pIdx, 1);
    const aIdx = assistentes.findIndex((x) => x.id === primeiro.id);
    if (aIdx >= 0) assistentes.splice(aIdx, 1);
  }

  return { titulares, prepostos, assistentes };
}

/**
 * Gera o PDF Executivo da Estrutura do Representante
 * Conforme Modelo Visual Padrão em Anexo (.orca/drops/dias por mês copy.pdf)
 * - 1 Página única em formato dashboard de alta definição (740 x 775 pt)
 * - Header de identificação do Representante
 * - Faixa horizontal de Marcas Representadas
 * - Grade central em 3 colunas: Mapa Territorial (dias em campo), Calendário de Treinamentos, Frequência Top 10 + Demais
 * - Organograma Operacional da Equipe em 3 níveis hierárquicos
 */
export async function generateRepStructurePdf(
  structure: RepStructure,
  repContact?: { email?: string | null; telefone?: string | null }
): Promise<{
  blob: Blob;
  filename: string;
  title: string;
}> {
  // Dimensões do documento (740 x 775 pt)
  const PW = 740;
  const PH = 775;
  const doc = new jsPDF({ unit: "pt", format: [PW, PH], orientation: "portrait" });

  const M = 16;
  const W = PW - M * 2; // 708 pt

  // Converte SVG do mapa para imagem rasterizada em alta resolução
  const mapSvg = buildBrazilMapSvg(
    structure.estados_atendidos || [],
    structure.detalhes_municipais,
    structure.dias_campo_por_estado
  );
  const mapPng = await svgToPngDataUrl(mapSvg, 800);

  // Helper para desenhar fundo geral do canvas
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

  // Subtítulo: Empresa de Representação • Base • Região
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textMuted);
  const empresaTxt = structure.empresa_representacao || "Representação Comercial";
  const baseTxt =
    structure.cidade_base && structure.estado_base
      ? ` • Base: ${structure.cidade_base}/${structure.estado_base}`
      : "";
  const regiaoTxt = structure.regiao_principal ? ` • Região: ${structure.regiao_principal}` : "";
  doc.text(`${empresaTxt}${baseTxt}${regiaoTxt}`, infoX, curY + 36);

  // Contato no lado direito do Header
  const emailContact = repContact?.email || `${repNome.toLowerCase().replace(/\s+/g, "")}@ribeirotlda.com.br`;
  const phoneContact = repContact?.telefone || "(71) 98752-0000";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textMuted);
  doc.text(`${emailContact}  •  ${phoneContact}`, PW - M - 12, curY + 27, { align: "right" });

  curY += headH + 8;

  // =========================================================================
  // 2. FAIXA DE MARCAS E EMPRESAS REPRESENTADAS
  // =========================================================================
  const marcasH = 54;
  drawCard(M, curY, W, marcasH, C.card, C.border, 6);

  // Título da faixa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textMuted);
  doc.text("MARCAS E EMPRESAS REPRESENTADAS", M + 12, curY + 16);

  const totalMarcas = structure.marcas_representadas?.length || 0;
  drawBadge(`${totalMarcas} marcas`, M + 195, curY + 15, C.primarySoft, C.sky, C.primarySoft, 6);

  // Indicador sutil de ação à direita
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.sky);
  doc.text("+ Adicionar Marca", PW - M - 12, curY + 16, { align: "right" });

  // Lista de Cards de Marcas (Horizontal)
  const marcasList = structure.marcas_representadas || [];
  const numMarcasExibidas = Math.max(1, Math.min(marcasList.length, 5));
  const marcaCardW = Math.min(125, (W - 24 - (numMarcasExibidas - 1) * 8) / numMarcasExibidas);
  const marcaCardH = 26;
  const marcaCardY = curY + 22;

  if (marcasList.length === 0) {
    drawCard(M + 12, marcaCardY, 130, marcaCardH, C.cardMuted, C.border, 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.textMuted);
    doc.text("Nenhuma marca", M + 12 + 65, marcaCardY + 16, { align: "center" });
  } else {
    marcasList.slice(0, 5).forEach((m, idx) => {
      const mX = M + 12 + idx * (marcaCardW + 8);
      drawCard(mX, marcaCardY, marcaCardW, marcaCardH, C.card, C.border, 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...C.text);
      doc.text(m.nome.toLowerCase(), mX + marcaCardW / 2, marcaCardY + 16, { align: "center" });
    });
  }

  curY += marcasH + 8;

  // =========================================================================
  // 3. GRADE CENTRAL EM 3 COLUNAS (MAPA, TREINAMENTOS, FREQUÊNCIA TOP 10)
  // =========================================================================
  const colGap = 8;
  const colW = (W - colGap * 2) / 3; // ~230.6 pt
  const colH = 295;

  const col1X = M;
  const col2X = M + colW + colGap;
  const col3X = M + (colW + colGap) * 2;

  // ---- COLUNA 1: MAPA DE ATUAÇÃO TERRITORIAL ----
  drawCard(col1X, curY, colW, colH, C.card, C.border, 6);

  // Título e Subtítulo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text("MAPA DE ATUAÇÃO TERRITORIAL", col1X + 10, curY + 16);

  const totalUfs = structure.estados_atendidos?.length || 0;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.textMuted);
  doc.text(`${totalUfs} estados atendidos pelo representante`, col1X + 10, curY + 27);

  // Legenda (Atendido / Não atendido)
  doc.setFillColor(...C.primary);
  doc.circle(col1X + colW - 68, curY + 15, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...C.primary);
  doc.text(`Atendido (${totalUfs})`, col1X + colW - 62, curY + 17);

  doc.setFillColor(...C.borderDark);
  doc.circle(col1X + colW - 28, curY + 15, 2.5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...C.textLight);
  doc.text("Outros", col1X + colW - 23, curY + 17);

  // Imagem do Mapa Rasterizado
  if (mapPng) {
    const mapSize = 190;
    const mapImgX = col1X + (colW - mapSize) / 2;
    doc.addImage(mapPng, "PNG", mapImgX, curY + 34, mapSize, mapSize);
  }

  // Rodapé do Card do Mapa: UFs Atendidas e Dias em campo
  const ufsRodapeY = curY + 272;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.textMuted);
  doc.text("UFs Atendidas:", col1X + 10, ufsRodapeY + 10);

  let ufX = col1X + 62;
  (structure.estados_atendidos || []).slice(0, 4).forEach((uf) => {
    const dias =
      structure.detalhes_municipais?.[uf]?.dias_campo_mes ??
      structure.dias_campo_por_estado?.[uf] ??
      0;
    const label = dias > 0 ? `${uf} (${dias}d)` : uf;
    const pillW = label.length * 4.2 + 8;

    doc.setFillColor(...C.primary);
    doc.roundedRect(ufX, ufsRodapeY + 2, pillW, 11, 5, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...C.white);
    doc.text(label, ufX + pillW / 2, ufsRodapeY + 10, { align: "center" });
    ufX += pillW + 4;
  });

  // ---- COLUNA 2: CALENDÁRIO DE TREINAMENTOS ----
  drawCard(col2X, curY, colW, colH, C.card, C.border, 6);

  // Título e Subtítulo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text("CALENDÁRIO DE TREINAMENTOS", col2X + 10, curY + 16);

  const treinamentosList = structure.treinamentos || [];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.textMuted);
  doc.text(`${treinamentosList.length} próximas datas agendadas pelo rep`, col2X + 10, curY + 27);

  // Badges da coluna 2
  drawBadge("+ Agendar", col2X + colW - 68, curY + 15, C.primarySoft, C.sky, C.primarySoft, 5.5);
  drawBadge(`${treinamentosList.length} Sessões`, col2X + colW - 32, curY + 15, C.cardMuted, C.textMuted, C.border, 5.5);

  // Lista de Treinamentos (até 3 ou 4 cards)
  let trainCardY = curY + 36;
  const trainItemH = 50;

  if (treinamentosList.length === 0) {
    // Placeholder limpo se não houver treinamentos cadastrados
    drawCard(col2X + 8, trainCardY, colW - 16, 55, C.cardMuted, C.border, 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.textMuted);
    doc.text("Nenhum treinamento agendado", col2X + colW / 2, trainCardY + 28, { align: "center" });
  } else {
    treinamentosList.slice(0, 4).forEach((t) => {
      drawCard(col2X + 8, trainCardY, colW - 16, trainItemH, C.cardMuted, C.border, 4);

      // Bloco de Data (à esquerda)
      const dateBoxW = 32;
      const dateBoxH = 38;
      const dateBoxX = col2X + 12;
      const dateBoxY = trainCardY + 6;
      drawCard(dateBoxX, dateBoxY, dateBoxW, dateBoxH, C.primarySoft, C.border, 3);

      const dParsed = parseTrainingDate(t.data);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...C.skyDark);
      doc.text(dParsed.mes, dateBoxX + dateBoxW / 2, dateBoxY + 10, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...C.text);
      doc.text(dParsed.dia, dateBoxX + dateBoxW / 2, dateBoxY + 23, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5);
      doc.setTextColor(...C.textMuted);
      doc.text(dParsed.sem, dateBoxX + dateBoxW / 2, dateBoxY + 33, { align: "center" });

      // Detalhes do Treinamento (à direita)
      const detX = dateBoxX + dateBoxW + 8;
      const tipoLabel = TIPO_TREINAMENTO_LABEL[t.tipo] || "Treinamento Técnico";

      // Tag do Tipo
      doc.setFillColor(...C.sky);
      doc.circle(detX + 2, trainCardY + 14, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...C.skyDark);
      const tipoShort = tipoLabel.length > 28 ? `${tipoLabel.slice(0, 26)}...` : tipoLabel;
      doc.text(tipoShort, detX + 7, trainCardY + 16);

      // Nome do Cliente
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.text);
      const cliShort = t.cliente_nome.length > 25 ? `${t.cliente_nome.slice(0, 23)}...` : t.cliente_nome;
      doc.text(cliShort, detX, trainCardY + 29);

      // Ministrante e Horário
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(...C.textMuted);
      const ministrante = t.ministrante || structure.nome_representante || "Anselmo (Rep Titular)";
      const infoSub = t.horario ? `${ministrante} • ${t.horario}` : ministrante;
      doc.text(infoSub, detX, trainCardY + 41);

      trainCardY += trainItemH + 8;
    });
  }

  // ---- COLUNA 3: FREQUÊNCIA DE VISITA (TOP 10 + DEMAIS) ----
  drawCard(col3X, curY, colW, colH, C.card, C.border, 6);

  // Título e Subtítulo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text("FREQUÊNCIA DE VISITA (TOP 10)", col3X + 10, curY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...C.textMuted);
  doc.text("Média de ciclo de retorno presencial em cada cliente", col3X + 10, curY + 27);

  const freqList = structure.frequencia_visitas || [];
  drawBadge(`${freqList.length}/10 Clientes`, col3X + colW - 56, curY + 15, C.primarySoft, C.sky, C.primarySoft, 5.5);

  // Top 5 Clientes Chave
  let freqCardY = curY + 34;
  const freqItemH = 36;

  freqList.slice(0, 5).forEach((f, idx) => {
    drawCard(col3X + 8, freqCardY, colW - 16, freqItemH, C.cardMuted, C.border, 4);

    // Círculo com Posição / Ranking (1º ouro, 2º prata, 3º bronze, etc.)
    const rankX = col3X + 18;
    const rankY = freqCardY + 18;
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
    doc.circle(rankX, rankY, 7.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...rankFg);
    doc.text(`${rankNum}º`, rankX, rankY + 2, { align: "center" });

    // Nome e Localidade do Cliente
    const cInfoX = col3X + 31;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...C.text);
    const cliNome = f.cliente_nome.length > 21 ? `${f.cliente_nome.slice(0, 19)}...` : f.cliente_nome;
    doc.text(cliNome, cInfoX, freqCardY + 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2);
    doc.setTextColor(...C.textMuted);
    const cLoc = `${f.cidade || "SALVADOR"} - ${f.uf || "BA"}`;
    doc.text(cLoc, cInfoX, freqCardY + 27);

    // Badge de Frequência (à direita)
    const fBadgeW = 52;
    const fBadgeX = col3X + colW - 14 - fBadgeW;
    const fBadgeY = freqCardY + 7;
    doc.setFillColor(...C.emeraldSoft);
    doc.setDrawColor(...C.emeraldBorder);
    doc.setLineWidth(0.4);
    doc.roundedRect(fBadgeX, fBadgeY, fBadgeW, 22, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.setTextColor(...C.emerald);
    doc.text(`A cada ${f.frequencia_dias} dias`, fBadgeX + fBadgeW / 2, fBadgeY + 10, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    doc.setTextColor(...C.textMuted);
    const freqSub = f.frequencia_dias <= 7 ? "Semanal" : f.frequencia_dias <= 15 ? "Quinzenal" : "Mensal";
    doc.text(freqSub, fBadgeX + fBadgeW / 2, fBadgeY + 18, { align: "center" });

    freqCardY += freqItemH + 6;
  });

  // Card Fixo no Rodapé da Coluna 3: Demais Clientes da Carteira
  const demaisCardY = curY + 248;
  const demaisCardH = 38;
  drawCard(col3X + 8, demaisCardY, colW - 16, demaisCardH, C.skySoft, C.primarySoft, 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...C.skyDark);
  doc.text("Demais Clientes da Carteira", col3X + 16, demaisCardY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.2);
  doc.setTextColor(...C.textMuted);
  doc.text("Frequência de visita presencial para todos", col3X + 16, demaisCardY + 28);

  const freqDemais = structure.frequencia_demais_clientes ?? 40;
  const dBadgeW = 54;
  const dBadgeX = col3X + colW - 14 - dBadgeW;
  const dBadgeY = demaisCardY + 8;
  doc.setFillColor(...C.primarySoft);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(dBadgeX, dBadgeY, dBadgeW, 22, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.8);
  doc.setTextColor(...C.skyDark);
  doc.text(`A cada ${freqDemais} dias`, dBadgeX + dBadgeW / 2, dBadgeY + 10, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.8);
  doc.setTextColor(...C.textMuted);
  const demaisSub = freqDemais <= 30 ? "Mensal" : freqDemais <= 60 ? "Bimestral" : "Trimestral";
  doc.text(demaisSub, dBadgeX + dBadgeW / 2, dBadgeY + 18, { align: "center" });

  curY += colH + 8;

  // =========================================================================
  // 4. ORGANOGRAMA OPERACIONAL DA EQUIPE (3 NÍVEIS HIERÁRQUICOS)
  // =========================================================================
  const organoH = PH - curY - M; // Ocupa todo o restante da página até a margem inferior (~240 pt)
  drawCard(M, curY, W, organoH, C.card, C.border, 6);

  // Título e Subtítulo do Organograma
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text("ORGANOGRAMA OPERACIONAL DA EQUIPE", M + 12, curY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.textMuted);
  doc.text(
    "Estrutura hierárquica: Representante Titular  ->  Prepostos  ->  Assistentes Comerciais",
    M + 12,
    curY + 27
  );

  const equipeCompleta = structure.equipe || [];
  const { titulares, prepostos, assistentes } = categorizarOrganograma(equipeCompleta);

  // Badges da hierarquia à direita
  let orgBadgeX = PW - M - 200;
  orgBadgeX += drawBadge(`Titular (${titulares.length})`, orgBadgeX, curY + 15, C.primarySoft, C.sky, C.primarySoft, 5.5) + 4;
  orgBadgeX += drawBadge(`Prepostos (${prepostos.length})`, orgBadgeX, curY + 15, C.blueSoft, C.blue, C.blueSoft, 5.5) + 4;
  orgBadgeX += drawBadge(`Assistentes (${assistentes.length})`, orgBadgeX, curY + 15, C.cardMuted, C.textMuted, C.border, 5.5) + 4;
  drawBadge(`${equipeCompleta.length} Integrantes`, orgBadgeX, curY + 15, C.cardMuted, C.textMuted, C.border, 5.5);

  // ---- NÍVEL 1: REPRESENTANTE PRINCIPAL (TOPO) ----
  const tier1LabelY = curY + 36;
  const tier1CardY = tier1LabelY + 8;
  const tier1CardW = 310;
  const tier1CardH = 46;
  const tier1CardX = M + (W - tier1CardW) / 2;

  // Etiqueta Pílula Nível 1
  doc.setFillColor(...C.sky);
  doc.roundedRect(tier1CardX + (tier1CardW - 140) / 2, tier1LabelY, 140, 11, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(...C.white);
  doc.text("NÍVEL 1 • REPRESENTANTE PRINCIPAL (TOPO)", tier1CardX + tier1CardW / 2, tier1LabelY + 8, {
    align: "center",
  });

  // Card do Titular
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
  const tAvSize = 26;
  const tAvX = tier1CardX + 10;
  const tAvY = tier1CardY + 6;
  doc.setFillColor(...C.primarySoft);
  doc.setDrawColor(...C.border);
  doc.roundedRect(tAvX, tAvY, tAvSize, tAvSize, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.skyDark);
  doc.text(titular.nome.slice(0, 2).toUpperCase(), tAvX + tAvSize / 2, tAvY + 17, { align: "center" });

  // Nome e Cargo
  const tInfoX = tAvX + tAvSize + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text(titular.nome, tInfoX, tier1CardY + 15);

  const tNomeW = doc.getTextWidth(titular.nome);
  drawBadge("TITULAR", tInfoX + tNomeW + 6, tier1CardY + 14, C.primarySoft, C.skyDark, C.primarySoft, 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.skyDark);
  doc.text(titular.cargo || "Representante Titular / Gestor Comercial", tInfoX, tier1CardY + 26);

  // Badges Vínculo e Modalidade
  const vincLabel = VINCULO_LABEL[titular.vinculo] || "Sócio";
  const modLabel = MODALIDADE_LABEL[titular.modalidade] || "Híbrido";
  const b1W = drawBadge(vincLabel, tier1CardX + tier1CardW - 74, tier1CardY + 14, C.card, C.textMuted, C.border, 5);
  drawBadge(modLabel, tier1CardX + tier1CardW - 74 + b1W + 4, tier1CardY + 14, C.card, C.textMuted, C.border, 5);

  // Linha de Responsabilidades
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(...C.textMuted);
  const respStr = (titular.responsabilidades || ["Gestão comercial e relacionamento"]).join("  •  ");
  const respTrunc = respStr.length > 70 ? `${respStr.slice(0, 68)}...` : respStr;
  doc.text(respTrunc, tInfoX, tier1CardY + 38);

  // Linha conectora vertical Tier 1 -> Tier 2
  const centerCanvasX = PW / 2;
  const line1StartY = tier1CardY + tier1CardH;
  const tier2LabelY = line1StartY + 8;
  doc.setDrawColor(...C.borderDark);
  doc.setLineWidth(0.8);
  doc.line(centerCanvasX, line1StartY, centerCanvasX, tier2LabelY);

  // ---- NÍVEL 2: PREPOSTOS COMERCIAIS & CAMPO ----
  const tier2CardY = tier2LabelY + 8;
  const tier2PillW = 150;
  doc.setFillColor(...C.blue);
  doc.roundedRect(centerCanvasX - tier2PillW / 2, tier2LabelY, tier2PillW, 11, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(...C.white);
  doc.text(`NÍVEL 2 • PREPOSTOS COMERCIAIS & CAMPO (${prepostos.length})`, centerCanvasX, tier2LabelY + 8, {
    align: "center",
  });

  const numPrepostos = Math.max(1, Math.min(prepostos.length, 3));
  const pCardW = Math.min(220, (W - 40 - (numPrepostos - 1) * 12) / numPrepostos);
  const pCardH = 40;
  const pTotalW = numPrepostos * pCardW + (numPrepostos - 1) * 12;
  const pStartX = centerCanvasX - pTotalW / 2;

  if (prepostos.length === 0) {
    drawCard(centerCanvasX - 100, tier2CardY, 200, 32, C.cardMuted, C.border, 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.textMuted);
    doc.text("Nenhum preposto cadastrado", centerCanvasX, tier2CardY + 19, { align: "center" });
  } else {
    prepostos.slice(0, 3).forEach((p, idx) => {
      const pX = pStartX + idx * (pCardW + 12);
      drawCard(pX, tier2CardY, pCardW, pCardH, C.cardMuted, C.border, 4);

      // Avatar
      const pAvSize = 22;
      const pAvX = pX + 8;
      const pAvY = tier2CardY + 6;
      doc.setFillColor(...C.blueSoft);
      doc.setDrawColor(...C.border);
      doc.roundedRect(pAvX, pAvY, pAvSize, pAvSize, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.blue);
      doc.text(p.nome.slice(0, 2).toUpperCase(), pAvX + pAvSize / 2, pAvY + 15, { align: "center" });

      // Nome e Cargo
      const pInfoX = pAvX + pAvSize + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.setTextColor(...C.text);
      doc.text(p.nome, pInfoX, tier2CardY + 14);

      drawBadge("Preposto", pX + pCardW - 45, tier2CardY + 13, C.blueSoft, C.blue, C.blueSoft, 4.8);

      // Badges
      const pVinc = VINCULO_LABEL[p.vinculo] || "PJ";
      const pMod = MODALIDADE_LABEL[p.modalidade] || "Remoto";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.2);
      doc.setTextColor(...C.textMuted);
      doc.text(`${pVinc}  ·  ${pMod}`, pInfoX, tier2CardY + 25);

      // Responsabilidade
      const pResp = (p.responsabilidades || ["Atendimento e vendas em campo"]).join(" • ");
      const pRespTrunc = pResp.length > 40 ? `${pResp.slice(0, 38)}...` : pResp;
      doc.text(pRespTrunc, pInfoX, tier2CardY + 34);
    });
  }

  // Linha conectora vertical Tier 2 -> Tier 3
  const line2StartY = tier2CardY + (prepostos.length === 0 ? 32 : pCardH);
  const tier3LabelY = line2StartY + 8;
  doc.setDrawColor(...C.borderDark);
  doc.setLineWidth(0.8);
  doc.line(centerCanvasX, line2StartY, centerCanvasX, tier3LabelY);

  // ---- NÍVEL 3: ASSISTENTES COMERCIAIS & BACKOFFICE ----
  const tier3CardY = tier3LabelY + 8;
  const tier3PillW = 175;
  doc.setFillColor(...C.textMuted);
  doc.roundedRect(centerCanvasX - tier3PillW / 2, tier3LabelY, tier3PillW, 11, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(...C.white);
  doc.text(
    `NÍVEL 3 • ASSISTENTES COMERCIAIS & BACKOFFICE (${assistentes.length})`,
    centerCanvasX,
    tier3LabelY + 8,
    { align: "center" }
  );

  const numAssistentes = Math.max(1, Math.min(assistentes.length, 4));
  const aCardW = Math.min(160, (W - 30 - (numAssistentes - 1) * 8) / numAssistentes);
  const aCardH = 38;
  const aTotalW = numAssistentes * aCardW + (numAssistentes - 1) * 8;
  const aStartX = centerCanvasX - aTotalW / 2;

  if (assistentes.length === 0) {
    drawCard(centerCanvasX - 100, tier3CardY, 200, 28, C.cardMuted, C.border, 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.textMuted);
    doc.text("Nenhum assistente cadastrado", centerCanvasX, tier3CardY + 17, { align: "center" });
  } else {
    assistentes.slice(0, 4).forEach((a, idx) => {
      const aX = aStartX + idx * (aCardW + 8);
      drawCard(aX, tier3CardY, aCardW, aCardH, C.cardMuted, C.border, 4);

      // Avatar
      const aAvSize = 20;
      const aAvX = aX + 6;
      const aAvY = tier3CardY + 5;
      doc.setFillColor(...C.card);
      doc.setDrawColor(...C.border);
      doc.roundedRect(aAvX, aAvY, aAvSize, aAvSize, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text(a.nome.slice(0, 2).toUpperCase(), aAvX + aAvSize / 2, aAvY + 14, { align: "center" });

      // Nome e Cargo
      const aInfoX = aAvX + aAvSize + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(...C.text);
      const aNome = a.nome.length > 15 ? `${a.nome.slice(0, 13)}...` : a.nome;
      doc.text(aNome, aInfoX, tier3CardY + 13);

      drawBadge("Assistente", aX + aCardW - 42, tier3CardY + 12, C.card, C.textMuted, C.border, 4.5);

      // Badges
      const aVinc = VINCULO_LABEL[a.vinculo] || "PJ";
      const aMod = MODALIDADE_LABEL[a.modalidade] || "Remoto";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5);
      doc.setTextColor(...C.textMuted);
      doc.text(`${aVinc} · ${aMod}`, aInfoX, tier3CardY + 23);

      // Responsabilidade
      const aResp = (a.responsabilidades || ["Atendimento e apoio"]).join(" • ");
      const aRespTrunc = aResp.length > 30 ? `${aResp.slice(0, 28)}...` : aResp;
      doc.text(aRespTrunc, aInfoX, tier3CardY + 32);
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
