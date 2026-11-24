import { describe, expect, it } from "vitest";
import { needsRepFirstAccess } from "./rep-first-access";

describe("primeiro acesso do representante", () => {
  it("mantém o cadastro de senha obrigatório quando a conta nova está marcada", () => {
    expect(
      needsRepFirstAccess({
        profileStatus: "ativo",
        mustChangePassword: true,
        lastSignInAt: null,
      }),
    ).toBe(true);
  });

  it("recupera contas legadas ativas que nunca fizeram login", () => {
    expect(
      needsRepFirstAccess({
        profileStatus: "ativo",
        mustChangePassword: undefined,
        lastSignInAt: null,
      }),
    ).toBe(true);
  });

  it("não reabre o primeiro acesso depois que a senha foi cadastrada", () => {
    expect(
      needsRepFirstAccess({
        profileStatus: "ativo",
        mustChangePassword: false,
        lastSignInAt: null,
      }),
    ).toBe(false);
  });

  it("considera habilitada uma conta legada que já entrou no portal", () => {
    expect(
      needsRepFirstAccess({
        profileStatus: "ativo",
        mustChangePassword: undefined,
        lastSignInAt: "2026-11-24T10:00:00.000Z",
      }),
    ).toBe(false);
  });
});
