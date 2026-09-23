import { afterEach, describe, expect, it, vi } from "vitest";

describe("getEmailProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("./resend-provider.server");
  });

  it("mock sem RESEND_API_KEY → FakeEmailProvider, Resend nem é carregado", async () => {
    vi.stubEnv("INTERNAL_TICKETS_EMAIL_MODE", "mock");
    vi.stubEnv("RESEND_API_KEY", "");
    const resendLoaded = vi.fn();
    vi.doMock("./resend-provider.server", () => {
      resendLoaded();
      return { ResendEmailProvider: class {} };
    });
    const { getEmailProvider } = await import("./provider-factory.server");
    const { FakeEmailProvider } = await import("./fake-provider");
    expect(await getEmailProvider()).toBeInstanceOf(FakeEmailProvider);
    expect(resendLoaded).not.toHaveBeenCalled();
  });

  it("mock tolera caixa/espacos e reaproveita a instância", async () => {
    vi.stubEnv("INTERNAL_TICKETS_EMAIL_MODE", " Mock ");
    const { getEmailProvider } = await import("./provider-factory.server");
    expect(await getEmailProvider()).toBe(await getEmailProvider());
  });

  it("resend sem RESEND_API_KEY → erro explícito de configuração", async () => {
    vi.stubEnv("INTERNAL_TICKETS_EMAIL_MODE", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    const { getEmailProvider } = await import("./provider-factory.server");
    await expect(getEmailProvider()).rejects.toThrow("RESEND_API_KEY não configurada");
  });

  it("modo inválido → erro explícito, sem fallback", async () => {
    vi.stubEnv("INTERNAL_TICKETS_EMAIL_MODE", "live");
    const { getEmailProvider } = await import("./provider-factory.server");
    await expect(getEmailProvider()).rejects.toThrow("INTERNAL_TICKETS_EMAIL_MODE inválido");
  });

  it("modo ausente → erro explícito, sem fallback", async () => {
    vi.stubEnv("INTERNAL_TICKETS_EMAIL_MODE", "");
    const { getEmailProvider } = await import("./provider-factory.server");
    await expect(getEmailProvider()).rejects.toThrow("não configurada");
  });
});
