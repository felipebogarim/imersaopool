import { describe, expect, it } from "vitest";
import { canReach, canTransition, isTerminalStatus, TICKET_STATUSES } from "./status";

describe("internal-tickets status", () => {
  it("permite o fluxo feliz completo", () => {
    expect(canTransition("rascunho", "aberto")).toBe(true);
    expect(canTransition("aberto", "enviado")).toBe(true);
    expect(canTransition("enviado", "recebido_pelo_setor")).toBe(true);
    expect(canTransition("recebido_pelo_setor", "em_analise")).toBe(true);
    expect(canTransition("em_analise", "respondido")).toBe(true);
    expect(canTransition("respondido", "aguardando_validacao")).toBe(true);
    expect(canTransition("aguardando_validacao", "concluido")).toBe(true);
  });

  it("permite reabrir um ticket concluído", () => {
    expect(canTransition("concluido", "reaberto")).toBe(true);
    expect(canTransition("reaberto", "em_analise")).toBe(true);
  });

  it("permite cancelar de qualquer status não terminal", () => {
    for (const status of TICKET_STATUSES) {
      if (status === "cancelado") continue;
      expect(canTransition(status, "cancelado")).toBe(true);
    }
  });

  it("rejeita pular etapas (aberto direto para em_analise)", () => {
    expect(canTransition("aberto", "em_analise")).toBe(false);
  });

  it("rejeita transição para o mesmo status", () => {
    expect(canTransition("em_analise", "em_analise")).toBe(false);
  });

  it("cancelado não tem nenhuma transição de saída", () => {
    for (const status of TICKET_STATUSES) {
      expect(canTransition("cancelado", status)).toBe(false);
    }
  });

  it("concluido e cancelado são terminais para fins de lembrete", () => {
    expect(isTerminalStatus("concluido")).toBe(true);
    expect(isTerminalStatus("cancelado")).toBe(true);
    expect(isTerminalStatus("em_analise")).toBe(false);
  });
});

describe("canReach (pulo de etapas pelas ações públicas do e-mail)", () => {
  it("permite pular direto de enviado para em_analise", () => {
    expect(canReach("enviado", "em_analise")).toBe(true);
  });

  it("permite pular direto de enviado para concluido", () => {
    expect(canReach("enviado", "concluido")).toBe(true);
  });

  it("continua rejeitando andar pra trás (concluido não alcança aberto)", () => {
    expect(canReach("concluido", "aberto")).toBe(false);
  });

  it("cancelado não alcança nenhum outro status", () => {
    for (const status of TICKET_STATUSES) {
      if (status === "cancelado") continue;
      expect(canReach("cancelado", status)).toBe(false);
    }
  });

  it("rejeita o mesmo status como alcance", () => {
    expect(canReach("em_analise", "em_analise")).toBe(false);
  });
});
