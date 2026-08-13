// Comparativo técnico genérico por família.
// O farol técnico é totalmente independente do farol de preço:
// nada aqui altera preços, diferenças percentuais ou registros importados.

import { MapaFamilyConfig, MapaTechField } from "./family-config";

export type TechFarol = "verde" | "amarelo" | "vermelho" | "cinza";

export type TechComparisonRow = {
  key: string;
  label: string;
  baseTexto: string;
  concTexto: string;
  analise: string;
  farol: TechFarol;
};

export const NAO_INFORMADO = "Não informado";

/** Extrai número de textos como "4,8 W/m", ">90", "<2", "IP65", "550 lm". */
export function parseTechNumber(v: string | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m = s.replace(/\.(?=\d{3}(\D|$))/g, "").match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function texto(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v).trim();
  if (!s) return NAO_INFORMADO;
  if (/^(n\/?a|nd|não informado|nao informado|-|--)$/i.test(s)) return NAO_INFORMADO;
  return s;
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function fmtPct(p: number): string {
  return `${Math.abs(p).toFixed(1)}%`;
}

/** "Studio +8,2%" / "Concorrente +12,5%" / "Igual". */
function rotuloPercentual(baseBrand: string, p: number): string {
  if (Math.abs(p) < 0.05) return "Igual";
  return p > 0 ? `${baseBrand} +${fmtPct(p)}` : `Concorrente +${fmtPct(p)}`;
}

function row(
  field: MapaTechField,
  baseTexto: string,
  concTexto: string,
  analise: string,
  farol: TechFarol,
): TechComparisonRow {
  return { key: field.key, label: field.label, baseTexto, concTexto, analise, farol };
}

/** Detecta tecnologia declarada (SMD, COB, NEON, etc.). */
function tecnologiaToken(s: string): string {
  const n = norm(s);
  const m = n.match(/\b(smd|cob|neon|filete|3528|2835|5050)\b/);
  return m ? m[1] : n;
}

/**
 * Avalia um campo técnico comparando marca base x concorrente.
 * Toda a semântica vem da configuração da família (tipo, direção, tolerância).
 */
export function compareTechField(
  field: MapaTechField,
  baseBrand: string,
  baseRaw: string | undefined | null,
  concRaw: string | undefined | null,
): TechComparisonRow {
  const baseTexto = texto(baseRaw);
  const concTexto = texto(concRaw);

  if (baseTexto === NAO_INFORMADO || concTexto === NAO_INFORMADO) {
    return row(field, baseTexto, concTexto, NAO_INFORMADO, "cinza");
  }

  const tipo = field.tipo ?? (field.direcao && field.direcao !== "neutro" ? "numerico" : "categorico");
  const direcao = field.direcao ?? "neutro";
  const tolerancia = field.toleranciaPct ?? 5;
  const limiteRelevante = field.limiteRelevantePct ?? 15;
  const iguais = norm(baseTexto) === norm(concTexto);

  // Tecnologia / categóricos com impacto de aplicação
  if (tipo === "tecnologia") {
    const a = tecnologiaToken(baseTexto);
    const b = tecnologiaToken(concTexto);
    if (a === b) return row(field, baseTexto, concTexto, "Compatível neste critério", "verde");
    return row(field, baseTexto, concTexto, "Tecnologia diferente", "vermelho");
  }

  if (tipo === "aplicacao") {
    if (iguais) return row(field, baseTexto, concTexto, "Equivalente", "verde");
    return row(field, baseTexto, concTexto, `${field.label} diferente — pode alterar a aplicação`, "vermelho");
  }

  if (tipo === "cct") {
    if (iguais) return row(field, baseTexto, concTexto, "Equivalente", "verde");
    return row(field, baseTexto, concTexto, "Temperatura de cor diferente", "amarelo");
  }

  const a = parseTechNumber(baseTexto);
  const b = parseTechNumber(concTexto);

  // Patamares (>90, <2): comparam níveis, não diferença percentual
  if (tipo === "patamar") {
    if (a === null || b === null) {
      return row(field, baseTexto, concTexto, iguais ? "Equivalente" : "Diferente", iguais ? "verde" : "amarelo");
    }
    if (a === b) return row(field, baseTexto, concTexto, "Equivalente", "verde");
    const melhorBase = direcao === "menor" ? a < b : a > b;
    return melhorBase
      ? row(field, baseTexto, concTexto, `${baseBrand} superior`, "verde")
      : row(field, baseTexto, concTexto, "Concorrente superior", "amarelo");
  }

  if (a === null || b === null) {
    if (iguais) return row(field, baseTexto, concTexto, "Equivalente", "verde");
    return row(field, baseTexto, concTexto, "Diferente", "amarelo");
  }

  if (a === b) return row(field, baseTexto, concTexto, "Igual", "verde");

  const p = b === 0 ? null : ((a - b) / Math.abs(b)) * 100;
  if (p === null) return row(field, baseTexto, concTexto, "Diferente", "amarelo");

  const rotulo = rotuloPercentual(baseBrand, p);
  const magnitude = Math.abs(p);

  if (direcao === "neutro") {
    const farol: TechFarol = magnitude <= tolerancia ? "verde" : magnitude <= limiteRelevante ? "amarelo" : "vermelho";
    return row(field, baseTexto, concTexto, rotulo, farol);
  }

  const favoravel = direcao === "maior" ? a > b : a < b;
  if (favoravel) return row(field, baseTexto, concTexto, `${rotulo} — ${baseBrand} superior`, "verde");
  if (magnitude <= tolerancia) return row(field, baseTexto, concTexto, `${rotulo} — próximo`, "verde");
  if (magnitude <= limiteRelevante) return row(field, baseTexto, concTexto, rotulo, "amarelo");
  return row(field, baseTexto, concTexto, rotulo, "vermelho");
}

/** Constrói o comparativo técnico completo respeitando a ordem definida na família. */
export function buildTechComparison(
  cfg: MapaFamilyConfig,
  baseTecnicos: Record<string, string> | undefined | null,
  concTecnicos: Record<string, string> | undefined | null,
): TechComparisonRow[] {
  return cfg.camposTecnicos
    .filter((f) => f.comparativo !== false)
    .map((f) => compareTechField(f, cfg.baseBrand, baseTecnicos?.[f.label], concTecnicos?.[f.label]));
}
