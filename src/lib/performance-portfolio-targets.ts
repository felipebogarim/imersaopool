import { normalizeFamilyName, type CanonicalFamily } from "./client-bi-familias";

export type PortfolioCategory = "Silver" | "Gold" | "Black";

/** Metas mensais de portfólio por categoria e família. */
export const PERFORMANCE_PORTFOLIO_TARGETS: Record<
  PortfolioCategory,
  Record<CanonicalFamily, number>
> = {
  Silver: {
    "DECOR NEWLINE": 1_000,
    "DECOR STUDIO": 1_500,
    "SISTEMAS E MÓDULOS": 1_000,
    "PRO LED": 500,
    "PRO LAMP": 1_000,
    PERFIL: 1_000,
    "FITAS E FONTES": 1_000,
  },
  Gold: {
    "DECOR NEWLINE": 2_500,
    "DECOR STUDIO": 3_000,
    "SISTEMAS E MÓDULOS": 2_500,
    "PRO LED": 1_500,
    "PRO LAMP": 1_500,
    PERFIL: 2_000,
    "FITAS E FONTES": 2_000,
  },
  Black: {
    "DECOR NEWLINE": 8_000,
    "DECOR STUDIO": 6_000,
    "SISTEMAS E MÓDULOS": 10_000,
    "PRO LED": 3_000,
    "PRO LAMP": 4_000,
    PERFIL: 7_000,
    "FITAS E FONTES": 3_000,
  },
};

export function normalizePortfolioCategory(value: unknown): PortfolioCategory | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "silver") return "Silver";
  if (normalized === "gold") return "Gold";
  if (normalized === "black") return "Black";
  return null;
}

export function getPerformancePortfolioTarget(category: unknown, family: unknown): number | null {
  const normalizedCategory = normalizePortfolioCategory(category);
  const normalizedFamily = normalizeFamilyName(family) as CanonicalFamily | null;
  if (!normalizedCategory || !normalizedFamily) return null;
  return PERFORMANCE_PORTFOLIO_TARGETS[normalizedCategory][normalizedFamily];
}
