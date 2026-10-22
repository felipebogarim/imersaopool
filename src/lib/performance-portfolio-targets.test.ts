import { describe, expect, it } from "vitest";
import {
  getPerformancePortfolioTarget,
  normalizePortfolioCategory,
  PERFORMANCE_PORTFOLIO_TARGETS,
} from "./performance-portfolio-targets";

describe("performance portfolio targets", () => {
  it("mantém os totais oficiais por categoria", () => {
    expect(Object.values(PERFORMANCE_PORTFOLIO_TARGETS.Silver).reduce((a, b) => a + b, 0)).toBe(
      7_000,
    );
    expect(Object.values(PERFORMANCE_PORTFOLIO_TARGETS.Gold).reduce((a, b) => a + b, 0)).toBe(
      15_000,
    );
    expect(Object.values(PERFORMANCE_PORTFOLIO_TARGETS.Black).reduce((a, b) => a + b, 0)).toBe(
      41_000,
    );
  });

  it("resolve a meta pela categoria do cliente e normaliza a família", () => {
    expect(getPerformancePortfolioTarget("black", "Sistemas e Modulos")).toBe(10_000);
    expect(getPerformancePortfolioTarget(" Silver ", "perfil")).toBe(1_000);
    expect(getPerformancePortfolioTarget("Gold", "PRO LED")).toBe(1_500);
  });

  it("não presume categoria quando ela é inválida ou ausente", () => {
    expect(normalizePortfolioCategory("Bronze")).toBeNull();
    expect(getPerformancePortfolioTarget(null, "PERFIL")).toBeNull();
  });
});
