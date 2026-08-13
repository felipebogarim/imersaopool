// Comparativo técnico genérico por família.
// Não interfere em preços: o farol técnico é independente do farol de preço.

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
  const m = s.replace(/\./g, "").match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function texto(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v).trim();
  return s.length ? s : NAO_INFORMADO;
}

function pct(a: number, b: number): number | null {
  if (!b) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

function fmtPct(p: number): string {
  return `${p > 0 ? "+" : ""}${p.toFixed(1)}%`;
}

/**
 * Avalia um campo técnico comparando marca base x concorrente.
 * direction: "maior" = quanto maior melhor; "menor" = quanto menor melhor; "neutro" = só igualdade.
 */
export function compareTechField(
  field: MapaTechField,
  baseBrand: string,
  baseRaw: string | undefined,
  concRaw: string | undefined,
): TechComparisonRow {
  const baseTexto = texto(baseRaw);
  const concTexto = texto(concRaw);
  const direction = field.direcao ?? "neutro";

  if (baseTexto === NAO_INFORMADO || concTexto === NAO_INFORMADO) {
    return {
      key: field.key,
      label: field.label,
      baseTexto,
      concTexto,
      analise: NAO_INFORMADO,
      farol: "cinza",
    };
  }

  const normalizado = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalizado(baseTexto) === normalizado(concTexto)) {
    return { key: field.key, label: field.label, baseTexto, concTexto, analise: "Igual", farol: "verde" };
  }

  const a = parseTechNumber(baseTexto);
  const b = parseTechNumber(concTexto);

  if (a === null || b === null) {
    return {
      key: field.key,
      label: field.label,
      baseTexto,
      concTexto,
      analise: "Diferente",
      farol: direction === "neutro" ? "amarelo" : "amarelo",
    };
  }

  if (a === b) {
    return { key: field.key, label: field.label, baseTexto, concTexto, analise: "Igual", farol: "verde" };
  }

  const p = pct(a, b);
  const diffAbs = a - b;
  const unidade = field.unidade ? ` ${field.unidade}` : "";

  if (direction === "neutro") {
    return {
      key: field.key,
      label: field.label,
      baseTexto,
      concTexto,
      analise: p !== null ? `Diferença ${fmtPct(p)}` : "Diferente",
      farol: "amarelo",
    };
  }

  const favoravel = direction === "maior" ? a > b : a < b;
  const magnitude = p === null ? 0 : Math.abs(p);

  const analise = favoravel
    ? `${baseBrand} superior${p !== null ? ` (${fmtPct(p)})` : ""}`
    : magnitude <= 5
      ? `Próximo${p !== null ? ` (${fmtPct(p)})` : ""}`
      : `${baseBrand} inferior${p !== null ? ` (${fmtPct(p)})` : ""}`;

  const farol: TechFarol = favoravel ? "verde" : magnitude <= 15 ? "amarelo" : "vermelho";

  return {
    key: field.key,
    label: field.label,
    baseTexto,
    concTexto,
    analise: `${analise}${Math.abs(diffAbs) && field.unidade ? ` · Δ ${diffAbs > 0 ? "+" : ""}${Number(diffAbs.toFixed(2))}${unidade}` : ""}`,
    farol,
  };
}

/** Constrói o comparativo técnico completo respeitando a ordem definida na família. */
export function buildTechComparison(
  cfg: MapaFamilyConfig,
  baseTecnicos: Record<string, string> | undefined,
  concTecnicos: Record<string, string> | undefined,
): TechComparisonRow[] {
  return cfg.camposTecnicos
    .filter((f) => f.comparativo !== false)
    .map((f) =>
      compareTechField(f, cfg.baseBrand, baseTecnicos?.[f.label], concTecnicos?.[f.label]),
    );
}
