import { describe, expect, it } from "vitest";
import { generateActionToken, hashActionToken, verifyActionToken } from "./action-tokens";

describe("internal-tickets action tokens", () => {
  it("gera um token e seu hash correspondente", () => {
    const { rawToken, tokenHash } = generateActionToken();
    expect(rawToken).toHaveLength(64);
    expect(tokenHash).toBe(hashActionToken(rawToken));
  });

  it("dois tokens gerados são diferentes", () => {
    expect(generateActionToken().rawToken).not.toBe(generateActionToken().rawToken);
  });

  it("valida um token correto, não usado e não expirado", () => {
    const { rawToken, tokenHash } = generateActionToken();
    const result = verifyActionToken({
      rawToken,
      storedHash: tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    expect(result).toEqual({ valid: true });
  });

  it("rejeita token com hash que não bate", () => {
    const { tokenHash } = generateActionToken();
    const result = verifyActionToken({
      rawToken: "token-errado",
      storedHash: tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    expect(result).toEqual({ valid: false, reason: "mismatch" });
  });

  it("rejeita token já usado, mesmo com hash correto", () => {
    const { rawToken, tokenHash } = generateActionToken();
    const result = verifyActionToken({
      rawToken,
      storedHash: tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });
    expect(result).toEqual({ valid: false, reason: "used" });
  });

  it("rejeita token expirado", () => {
    const { rawToken, tokenHash } = generateActionToken();
    const result = verifyActionToken({
      rawToken,
      storedHash: tokenHash,
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    expect(result).toEqual({ valid: false, reason: "expired" });
  });
});
