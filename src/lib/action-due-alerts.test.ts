import { describe, expect, it } from "vitest";

// O módulo importa o cliente admin; os testes cobrem só a regra pura.
import { vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/action-tracking.server", () => ({
  listActionsForRep: vi.fn(),
  sendSystemEmail: vi.fn(),
}));

import { needsDueAlert } from "./action-due-alerts.server";

const now = new Date(2026, 10, 20, 9);
const base = { due_date: "2026-11-25", status: "nao_iniciado", acceptance: "aceita", metadata: {} };

describe("needsDueAlert", () => {
  it("avisa quando faltam 5 dias ou menos", () => {
    expect(needsDueAlert(base, now)).toBe(true);
    expect(needsDueAlert({ ...base, due_date: "2026-11-20" }, now)).toBe(true);
  });
  it("não avisa fora da janela, sem prazo ou já vencida", () => {
    expect(needsDueAlert({ ...base, due_date: "2026-11-26" }, now)).toBe(false);
    expect(needsDueAlert({ ...base, due_date: null }, now)).toBe(false);
    expect(needsDueAlert({ ...base, due_date: "2026-11-19" }, now)).toBe(false);
  });
  it("ignora rascunho, recusada e concluída", () => {
    expect(needsDueAlert({ ...base, acceptance: "nao_enviada" }, now)).toBe(false);
    expect(needsDueAlert({ ...base, acceptance: "recusada" }, now)).toBe(false);
    expect(needsDueAlert({ ...base, status: "concluido" }, now)).toBe(false);
  });
  it("não repete o aviso para o mesmo prazo, mas avisa de novo se o prazo mudou", () => {
    expect(needsDueAlert({ ...base, metadata: { due_alert_for: "2026-11-25" } }, now)).toBe(false);
    expect(needsDueAlert({ ...base, metadata: { due_alert_for: "2026-11-22" } }, now)).toBe(true);
  });
});
