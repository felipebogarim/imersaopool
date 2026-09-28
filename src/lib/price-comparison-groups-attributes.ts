// Price › Validação de Comparáveis — atributos técnicos prioritários (máx. 6) por família
// e análise textual da comparação técnica (linha "Comparativo Técnico" ao expandir um item).
// Lógica pura, sem React/Supabase.

import { getFamilyConfig } from "@/lib/price-mapa/family-config";
import type { SpecValue } from "@/lib/price-comparativos-core";

export type AttributeKind = "superioridade" | "compatibilidade" | "configuracao";

export type Top6Attribute = {
  key: string;
  label: string;
  unidade?: string;
  /** "maior" = quanto maior melhor, "menor" = quanto menor melhor, "neutro" = não é hierárquico. */
  direcao: "maior" | "menor" | "neutro";
  kind: AttributeKind;
};

/** Ordem canônica exigida para Fitas: Tensão, Potência/m, Fluxo/m, LEDs/m, IRC, SDCM. */
const FITA_TOP6: Top6Attribute[] = [
  { key: "tensao", label: "Tensão", unidade: "V", direcao: "neutro", kind: "configuracao" },
  {
    key: "potencia_m",
    label: "Potência/m",
    unidade: "W/m",
    direcao: "neutro",
    kind: "compatibilidade",
  },
  {
    key: "fluxo_m",
    label: "Fluxo luminoso/m",
    unidade: "lm/m",
    direcao: "maior",
    kind: "superioridade",
  },
  { key: "leds_m", label: "LEDs/m", unidade: "un/m", direcao: "maior", kind: "compatibilidade" },
  { key: "irc", label: "IRC", direcao: "maior", kind: "superioridade" },
  { key: "sdcm", label: "SDCM", direcao: "menor", kind: "superioridade" },
];

const CONFIG_KEYS = new Set(["tensao", "cct", "tecnologia", "dimerizacao", "protocolo"]);

/**
 * Seis atributos técnicos principais para a família, na ordem de prioridade.
 * Fitas usa a ordem canônica fixa acima; demais famílias reaproveitam a
 * configuração já genérica de `price-mapa/family-config.ts` (primeiros 6
 * `camposTecnicos`, já ordenados por prioridade), sem hardcode de marca.
 */
export function top6For(familia: string): Top6Attribute[] {
  if (familia === "Fitas e Fontes") return FITA_TOP6;
  const cfg = getFamilyConfig(familia);
  return cfg.camposTecnicos.slice(0, 6).map((c) => {
    const kind: AttributeKind = CONFIG_KEYS.has(c.key)
      ? "configuracao"
      : c.direcao === "maior" || c.direcao === "menor"
        ? "superioridade"
        : "compatibilidade";
    return {
      key: c.key,
      label: c.label,
      unidade: c.unidade,
      direcao: c.direcao ?? "neutro",
      kind,
    };
  });
}

export type AttributeAnalysisTone = "igual" | "base" | "concorrente" | "config" | "sem_dado";

export type AttributeAnalysis = { text: string; tone: AttributeAnalysisTone };

function numeric(v: SpecValue | null | undefined): number | null {
  return v?.value_numeric ?? null;
}

function textual(v: SpecValue | null | undefined): string | null {
  return v?.value_text ?? v?.normalized_value ?? v?.original_value ?? null;
}

/** Analisa um atributo técnico entre base e concorrente, conforme os critérios do item 9. */
export function analyzeAttribute(
  attr: Top6Attribute,
  baseVal: SpecValue | null | undefined,
  compVal: SpecValue | null | undefined,
): AttributeAnalysis {
  const bn = numeric(baseVal);
  const cn = numeric(compVal);

  if (attr.kind === "configuracao") {
    if (bn == null && cn == null) {
      const bt = textual(baseVal);
      const ct = textual(compVal);
      if (bt == null && ct == null) return { text: "Não informado", tone: "sem_dado" };
      if (bt != null && ct != null && bt.trim().toLowerCase() === ct.trim().toLowerCase()) {
        return { text: "Igual", tone: "igual" };
      }
      return { text: "Diferença de configuração", tone: "config" };
    }
    if (bn == null || cn == null) return { text: "Não informado", tone: "sem_dado" };
    if (bn === cn) return { text: "Igual", tone: "igual" };
    if (attr.key === "tensao")
      return { text: "Comparação intencional entre tensões", tone: "config" };
    return { text: "Diferença de configuração", tone: "config" };
  }

  if (bn == null || cn == null) return { text: "Não informado", tone: "sem_dado" };
  if (bn === cn) return { text: "Igual", tone: "igual" };

  if (attr.kind === "compatibilidade") {
    if (bn === 0) return { text: "Não informado", tone: "sem_dado" };
    const deltaPct = ((cn - bn) / Math.abs(bn)) * 100;
    if (Math.abs(deltaPct) < 3) return { text: "Equivalente", tone: "igual" };
    return deltaPct > 0
      ? { text: `Concorrente +${deltaPct.toFixed(0)}%`, tone: "concorrente" }
      : { text: `Base +${Math.abs(deltaPct).toFixed(0)}%`, tone: "base" };
  }

  // superioridade
  const baseIsBetter = attr.direcao === "menor" ? bn < cn : bn > cn;
  return baseIsBetter
    ? { text: "Base superior", tone: "base" }
    : { text: "Concorrente superior", tone: "concorrente" };
}

/** Preço simulado a partir do preço original e um ajuste percentual (item 8). Positivo = desconto. */
export function simulatePrice(
  original: number | null | undefined,
  adjustmentPercent: number | null | undefined,
): number | null {
  if (original == null || !Number.isFinite(original)) return null;
  const adj = adjustmentPercent ?? 0;
  if (!Number.isFinite(adj)) return original;
  return original * (1 - adj / 100);
}
