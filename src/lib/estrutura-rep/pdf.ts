import jsPDF from "jspdf";
import { BRAZIL_STATE_PATHS } from "@/components/director-bi/immersions/brazil-svg-paths";
import type { RepStructure } from "./types";
import {
  MODELO_ESCRITORIO_LABEL,
  MODELO_ATUACAO_LABEL,
  MODELO_NEGOCIO_LABEL,
  VINCULO_LABEL,
  MODALIDADE_LABEL,
  RECURSOS_CONFIG,
} from "./types";

type RGB = [number, number, number];
type Style = "normal" | "bold" | "italic";

const C = {
  bg: [248, 250, 252] as RGB,          // slate-50
  card: [255, 255, 255] as RGB,        // white
  cardMuted: [241, 245, 249] as RGB,   // slate-100
  border: [203, 213, 225] as RGB,      // slate-300
  borderLight: [226, 232, 240] as RGB, // slate-200
  text: [15, 23, 42] as RGB,           // slate-900
  muted: [100, 116, 139] as RGB,       // slate-500
  primary: [14, 116, 144] as RGB,      // cyan-700
  primaryDark: [8, 51, 68] as RGB,     // cyan-950
  primarySoft: [207, 250, 254] as RGB, // cyan-100
  emerald: [16, 185, 129] as RGB,      // emerald-500
  emeraldSoft: [209, 250, 229] as RGB, // emerald-100
  amber: [217, 119, 6] as RGB,         // amber-600
  amberSoft: [254, 243, 199] as RGB,   // amber-100
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
    <rect width="800" height="800" fill="#f8fafc" rx="20" />
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
          ctx.fillStyle = "#f8fafc";
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

/** Gera um PDF executivo de alta fidelidade visual para a Estrutura do Representante */
export async function generateRepStructurePdf(structure: RepStructure): Promise<{
  blob: Blob;
  filename: string;
  title: string;
}> {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const PW = doc.internal.pageSize.getWidth(); // 595.28 pt
  const PH = doc.internal.pageSize.getHeight(); // 841.89 pt
  const M = 32; // margem
  const W = PW - M * 2; // 531.28 pt

  // Converte SVG do mapa para imagem rasterizada em paralelo
  const mapSvg = buildBrazilMapSvg(
    structure.estados_atendidos || [],
    structure.detalhes_municipais,
    structure.dias_campo_por_estado
  );
  const mapPng = await svgToPngDataUrl(mapSvg, 700);

  // Helper para desenhar fundo
  const drawBg = () => {
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, PW, PH, "F");
  };

  // Helper para desenhar cartão arredondado
  const drawCard = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: RGB = C.card,
    border: RGB = C.borderLight
  ) => {
    doc.setFillColor(...fill);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, w, h, 6, 6, "FD");
  };

  // Helper para desenhar pílula/badge
  const drawBadge = (
    text: string,
    x: number,
    y: number,
    bg: RGB = C.primarySoft,
    fg: RGB = C.primary,
    fontSize = 7.5
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    const tw = doc.getTextWidth(text);
    const bw = tw + 10;
    const bh = fontSize + 6;
    doc.setFillColor(...bg);
    doc.setDrawColor(...fg);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y - bh + 2, bw, bh, 3, 3, "FD");
    doc.setTextColor(...fg);
    doc.text(text, x + 5, y);
    return bw;
  };

  // =========================================================================
  // PÁGINA 1: IDENTIFICAÇÃO + KPIS + MAPA + MARCAS
  // =========================================================================
  drawBg();

  let y = M;

  // 1. Header Oficial Banner
  doc.setFillColor(...C.primaryDark);
  doc.roundedRect(M, y, W, 46, 6, 6, "F");
  doc.setFillColor(...C.primary);
  doc.roundedRect(M, y, 4, 46, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.white);
  doc.text("POOLFLUX  ·  ESTRUTURA COMERCIAL & OPERACIONAL", M + 14, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.primarySoft);
  doc.text(
    "Radiografia executiva da estrutura e capacidade operacional da representação",
    M + 14,
    y + 35
  );

  const hoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.white);
  doc.text(`Emissão: ${hoje}`, PW - M - 12, y + 27, { align: "right" });

  y += 54;

  // 2. Card de Identificação
  const idCardH = 58;
  drawCard(M, y, W, idCardH, C.card, C.border);

  // Avatar circular com iniciais
  doc.setFillColor(...C.primarySoft);
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(0.8);
  doc.roundedRect(M + 10, y + 9, 40, 40, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C.primaryDark);
  const initials = (structure.nome_representante || "RP").slice(0, 2).toUpperCase();
  doc.text(initials, M + 30, y + 34, { align: "center" });

  // Nome e Empresa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.text);
  doc.text(structure.nome_representante || "Representante", M + 58, y + 23);

  // Badge de Atuação
  const atuacaoLabel = MODELO_ATUACAO_LABEL[structure.modelo_atuacao] || "Equipe";
  drawBadge(atuacaoLabel, M + 58 + doc.getTextWidth(structure.nome_representante || "") + 10, y + 22);

  // Subtítulo: Empresa e Localização
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  const empresaTxt = structure.empresa_representacao || "Representação Comercial";
  const baseTxt =
    structure.cidade_base && structure.estado_base
      ? ` • Base: ${structure.cidade_base}/${structure.estado_base}`
      : "";
  const regiaoTxt = structure.regiao_principal ? ` • Região: ${structure.regiao_principal}` : "";
  doc.text(`${empresaTxt}${baseTxt}${regiaoTxt}`, M + 58, y + 42);

  y += idCardH + 10;

  // 3. Barra de KPIs Executivos (5 blocos métricos)
  const kpiH = 44;
  const kpiW = (W - 8 * 4) / 5;
  const kpis = [
    {
      title: "ESTADOS",
      value: `${structure.estados_atendidos?.length || 0}`,
      unit: "UFs",
      color: C.primary,
    },
    {
      title: "MARCAS",
      value: `${structure.marcas_representadas?.length || 0}`,
      unit: "Portfólio",
      color: C.primary,
    },
    {
      title: "EQUIPE",
      value: `${structure.equipe?.length || 0}`,
      unit: "Pessoas",
      color: C.primary,
    },
    {
      title: "ESCRITÓRIO",
      value: MODELO_ESCRITORIO_LABEL[structure.modelo_escritorio] || "Físico",
      unit: "",
      color: C.primary,
      isText: true,
    },
    {
      title: "RECURSOS",
      value: `${
        RECURSOS_CONFIG.filter((r) => Boolean(structure.recursos_operacionais?.[r.key])).length
      }/6`,
      unit: "Ativos",
      color: C.emerald,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = M + idx * (kpiW + 8);
    drawCard(kpiX, y, kpiW, kpiH, C.card, C.borderLight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(kpi.title, kpiX + 8, y + 14);

    if (kpi.isText) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...C.text);
      doc.text(kpi.value, kpiX + 8, y + 32);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...kpi.color);
      doc.text(kpi.value, kpiX + 8, y + 33);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.muted);
      const valW = doc.getTextWidth(kpi.value);
      doc.text(kpi.unit, kpiX + 8 + valW + 3, y + 33);
    }
  });

  y += kpiH + 12;

  // 4. Área Central em 2 Colunas: Quadrante 1 (Mapa) e Quadrante 2 (Marcas)
  const colGap = 12;
  const colW = (W - colGap) / 2;
  const colH = 345;

  // ---- COLUNA ESQUERDA: MAPA TERRITORIAL ----
  drawCard(M, y, colW, colH, C.card, C.border);

  // Cabeçalho da Seção Mapa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.primaryDark);
  doc.text("MAPA DE ATUAÇÃO TERRITORIAL", M + 10, y + 18);

  const totalUfs = structure.estados_atendidos?.length || 0;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text(`${totalUfs} estados atendidos pelo representante`, M + 10, y + 30);

  // Legenda
  doc.setFillColor(...C.primary);
  doc.circle(M + colW - 70, y + 16, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.primary);
  doc.text(`Atendido (${totalUfs})`, M + colW - 62, y + 19);

  // Imagem do Mapa
  if (mapPng) {
    const mapImgSize = 220;
    const mapImgX = M + (colW - mapImgSize) / 2;
    doc.addImage(mapPng, "PNG", mapImgX, y + 38, mapImgSize, mapImgSize);
  }

  // Lista de Badges dos Estados Atendidos no rodapé do quadrante
  let ufBadgeX = M + 10;
  let ufBadgeY = y + 276;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.text);
  doc.text("UFs Cobertas:", M + 10, ufBadgeY - 4);

  (structure.estados_atendidos || []).forEach((uf) => {
    const dias = structure.detalhes_municipais?.[uf]?.dias_campo_mes ?? structure.dias_campo_por_estado?.[uf];
    const label = dias ? `${uf} (${dias}d/mês)` : uf;
    const approxW = label.length * 5 + 12;
    if (ufBadgeX + approxW > M + colW - 10) {
      ufBadgeX = M + 10;
      ufBadgeY += 16;
    }
    const bw = drawBadge(label, ufBadgeX, ufBadgeY, C.primarySoft, C.primary, 7);
    ufBadgeX += bw + 4;
  });

  // ---- COLUNA DIREITA: MARCAS E PORTFÓLIO ----
  const marcasX = M + colW + colGap;
  drawCard(marcasX, y, colW, colH, C.card, C.border);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.primaryDark);
  doc.text("MARCAS E EMPRESAS REPRESENTADAS", marcasX + 10, y + 18);

  const totalMarcas = structure.marcas_representadas?.length || 0;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text(`${totalMarcas} ${totalMarcas === 1 ? "marca no portfólio" : "marcas no portfólio"}`, marcasX + 10, y + 30);

  // Cards de cada Marca
  let marcaCardY = y + 42;
  const marcasList = structure.marcas_representadas || [];

  marcasList.slice(0, 4).forEach((marca) => {
    const mCardH = 68;
    drawCard(marcasX + 8, marcaCardY, colW - 16, mCardH, C.cardMuted, C.borderLight);

    // Nome da marca
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    doc.text(marca.nome, marcasX + 16, marcaCardY + 16);

    // Badge do modelo de negócio (fabricante, distribuidor, etc.)
    const modNegocio = MODELO_NEGOCIO_LABEL[marca.modelo_negocio] || marca.modelo_negocio;
    drawBadge(modNegocio, marcasX + colW - 74, marcaCardY + 16, C.amberSoft, C.amber, 6.5);

    // Segmento
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(`Segmento: ${marca.segmento || "Iluminação & Complementos"}`, marcasX + 16, marcaCardY + 30);

    // Canais
    const canaisStr = (marca.canais || []).map((c) => c.toUpperCase()).join(" · ") || "VAREJO · PROJETOS";
    doc.text(`Canais: ${canaisStr}`, marcasX + 16, marcaCardY + 44);

    // Abrangência
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...C.primary);
    doc.text(`Abrangência: ${marca.abrangencia || "Integral"}`, marcasX + 16, marcaCardY + 58);

    marcaCardY += mCardH + 6;
  });

  if (marcasList.length > 4) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(`+ ${marcasList.length - 4} outras marcas cadastradas`, marcasX + 16, marcaCardY + 12);
  }

  // Rodapé da Página 1
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text("POOLFLUX · IMERSÃO COMERCIAL NEWLINE · DOCUMENTO EXECUTIVO", M, PH - 16);
  doc.text("Página 01 / 02", PW - M, PH - 16, { align: "right" });

  // =========================================================================
  // PÁGINA 2: ESTRUTURA FÍSICA + EQUIPE / MINI ORGANOGRAMA
  // =========================================================================
  doc.addPage();
  drawBg();

  y = M;

  // Header Página 2
  doc.setFillColor(...C.primaryDark);
  doc.roundedRect(M, y, W, 32, 6, 6, "F");
  doc.setFillColor(...C.primary);
  doc.roundedRect(M, y, 4, 32, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...C.white);
  doc.text(
    `ESTRUTURA FÍSICA, OPERACIONAL E EQUIPE · ${(structure.nome_representante || "REPRESENTANTE").toUpperCase()}`,
    M + 14,
    y + 20
  );

  y += 44;

  // Quadrante 3: Estrutura Física & Operacional (Coluna Esquerda)
  // Quadrante 4: Equipe & Mini Organograma (Coluna Direita)
  const p2ColH = PH - y - M - 20;

  // ---- COLUNA ESQUERDA: ESTRUTURA FÍSICA E OPERACIONAL ----
  drawCard(M, y, colW, p2ColH, C.card, C.border);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.primaryDark);
  doc.text("ESTRUTURA FÍSICA E OPERACIONAL", M + 10, y + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text("Modelo de escritório e recursos disponíveis", M + 10, y + 30);

  let recY = y + 46;

  // Card do Modelo de Escritório
  drawCard(M + 8, recY, colW - 16, 42, C.primarySoft, C.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.primary);
  doc.text("MODELO DE ESCRITÓRIO:", M + 16, recY + 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...C.primaryDark);
  doc.text(MODELO_ESCRITORIO_LABEL[structure.modelo_escritorio] || "Escritório Físico", M + 16, recY + 32);

  recY += 52;

  // Lista dos 6 Recursos Operacionais com Checks
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text("RECURSOS OPERACIONAIS DA OPERAÇÃO:", M + 10, recY + 8);
  recY += 16;

  RECURSOS_CONFIG.forEach((rec) => {
    const isActive = Boolean(structure.recursos_operacionais?.[rec.key]);
    const rCardH = 46;
    drawCard(
      M + 8,
      recY,
      colW - 16,
      rCardH,
      isActive ? C.card : C.cardMuted,
      isActive ? C.borderLight : C.borderLight
    );

    // Ícone de Check
    doc.setFillColor(...(isActive ? C.emeraldSoft : C.cardMuted));
    doc.setDrawColor(...(isActive ? C.emerald : C.muted));
    doc.setLineWidth(0.6);
    doc.circle(M + 22, recY + 23, 8, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...(isActive ? C.emerald : C.muted));
    doc.text(isActive ? "✓" : "—", M + 22, recY + 26, { align: "center" });

    // Nome do recurso
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...(isActive ? C.text : C.muted));
    doc.text(rec.label, M + 36, recY + 18);

    // Descrição
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(rec.descricao || "", M + 36, recY + 30);

    // Status Pill
    drawBadge(
      isActive ? "DISPONÍVEL" : "NÃO ATIVO",
      M + colW - 68,
      recY + 18,
      isActive ? C.emeraldSoft : C.cardMuted,
      isActive ? C.emerald : C.muted,
      6
    );

    recY += rCardH + 6;
  });

  // Observações operacionais
  if (structure.recursos_operacionais?.observacoes) {
    drawCard(M + 8, recY + 4, colW - 16, 50, C.cardMuted, C.borderLight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.primary);
    doc.text("OBSERVAÇÕES DA ESTRUTURA:", M + 14, recY + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.text);
    const obsLines = doc.splitTextToSize(structure.recursos_operacionais.observacoes, colW - 28);
    doc.text(obsLines, M + 14, recY + 30);
  }

  // ---- COLUNA DIREITA: EQUIPE E MINI ORGANOGRAMA ----
  const equipeX = M + colW + colGap;
  drawCard(equipeX, y, colW, p2ColH, C.card, C.border);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.primaryDark);
  doc.text("EQUIPE E MINI ORGANOGRAMA", equipeX + 10, y + 18);

  const totalMembros = structure.equipe?.length || 0;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text(
    `${totalMembros} ${totalMembros === 1 ? "integrante na operação" : "integrantes na operação comercial"}`,
    equipeX + 10,
    y + 30
  );

  let eqY = y + 46;
  const equipeList = structure.equipe || [];

  equipeList.slice(0, 5).forEach((membro, mIdx) => {
    const isTitular = membro.nivel === "titular" || mIdx === 0;
    const mCardH = 76;
    drawCard(
      equipeX + 8,
      eqY,
      colW - 16,
      mCardH,
      isTitular ? C.card : C.cardMuted,
      isTitular ? C.primary : C.borderLight
    );

    // Conector visual de fluxo (seta/linha entre cargos)
    if (mIdx > 0) {
      doc.setDrawColor(...C.primary);
      doc.setLineWidth(1);
      doc.line(equipeX + 24, eqY - 6, equipeX + 24, eqY);
    }

    // Avatar
    doc.setFillColor(...(isTitular ? C.primarySoft : C.cardMuted));
    doc.setDrawColor(...(isTitular ? C.primary : C.border));
    doc.setLineWidth(0.6);
    doc.roundedRect(equipeX + 14, eqY + 10, 24, 24, 4, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...(isTitular ? C.primary : C.muted));
    const mInitials = (membro.nome || "M").slice(0, 2).toUpperCase();
    doc.text(mInitials, equipeX + 26, eqY + 25, { align: "center" });

    // Nome e Cargo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    doc.text(membro.nome, equipeX + 44, eqY + 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.primary);
    doc.text(membro.cargo || "Atendimento Comercial", equipeX + 44, eqY + 31);

    // Badges de Vínculo e Modalidade
    const vinculoTxt = VINCULO_LABEL[membro.vinculo] || membro.vinculo?.toUpperCase() || "CLT";
    const modTxt = MODALIDADE_LABEL[membro.modalidade] || membro.modalidade || "Presencial";
    drawBadge(vinculoTxt, equipeX + colW - 90, eqY + 20, C.cardMuted, C.muted, 6);
    drawBadge(modTxt, equipeX + colW - 50, eqY + 20, C.primarySoft, C.primary, 6);

    // Responsabilidades (Tags compactas)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text("RESPONSABILIDADES:", equipeX + 14, eqY + 45);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.text);
    const respStr = (membro.responsabilidades || []).join("  ·  ") || "Atendimento em campo e suporte";
    const respLines = doc.splitTextToSize(respStr, colW - 32);
    doc.text(respLines.slice(0, 2), equipeX + 14, eqY + 56);

    eqY += mCardH + 8;
  });

  // Rodapé Página 2
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text("POOLFLUX · IMERSÃO COMERCIAL NEWLINE · DOCUMENTO EXECUTIVO", M, PH - 16);
  doc.text("Página 02 / 02", PW - M, PH - 16, { align: "right" });

  // Retorna o blob e metadados
  const blob = doc.output("blob");
  const safeName = (structure.nome_representante || "estrutura-rep")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    blob,
    filename: `Estrutura-Rep-${safeName}.pdf`,
    title: `Estrutura Rep — ${structure.nome_representante}`,
  };
}
