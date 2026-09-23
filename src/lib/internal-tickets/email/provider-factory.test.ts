import { afterEach, describe, expect, it, vi } from "vitest";

describe("getEmailProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("devolve FakeEmailProvider em modo mock, mesmo sem RESEND_API_KEY", async () => {
    vi.stubEnv("INTERNAL_TICKETS_EMAIL_MODE", "mock");
    vi.stubEnv("RESEND_API_KEY", "");
    const { getEmailProvider } = await import("./provider-factory.server");
    const { FakeEmailProvider } = await import("./fake-provider");
    expect(getEmailProvider()).toBeInstanceOf(FakeEmailProvider);
  });

  it("reaproveita a mesma instância mock entre chamadas (permite inspecionar o histórico de envios)", async () => {
    vi.stubEnv("INTERNAL_TICKETS_EMAIL_MODE", "mock");
    const { getEmailProvider } = await import("./provider-factory.server");
    expect(getEmailProvider()).toBe(getEmailProvider());
  });

  it("sem modo mock, tenta o provider Resend real (falha sem RESEND_API_KEY, como esperado fora de teste)", async () => {
    vi.stubEnv("INTERNAL_TICKETS_EMAIL_MODE", "");
    vi.stubEnv("RESEND_API_KEY", "");
    const { getEmailProvider } = await import("./provider-factory.server");
    expect(() => getEmailProvider()).toThrow("RESEND_API_KEY não configurada");
  });
});
