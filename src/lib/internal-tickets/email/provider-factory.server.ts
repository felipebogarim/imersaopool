import { getEmailMode } from "./email-mode.server";
import { FakeEmailProvider } from "./fake-provider";
import type { EmailProvider } from "./types";

/**
 * INTERNAL_TICKETS_EMAIL_MODE=mock   → FakeEmailProvider (sem rede, sem RESEND_API_KEY).
 * INTERNAL_TICKETS_EMAIL_MODE=resend → ResendEmailProvider (exige RESEND_API_KEY).
 * Ausente/inválido → erro explícito (sem fallback). O módulo do Resend só é
 * carregado (import dinâmico) no modo resend, então nada dele é avaliado em mock.
 */
let mockProviderSingleton: FakeEmailProvider | null = null;

export async function getEmailProvider(): Promise<EmailProvider> {
  if (getEmailMode() === "mock") {
    if (!mockProviderSingleton) mockProviderSingleton = new FakeEmailProvider();
    return mockProviderSingleton;
  }
  const { ResendEmailProvider } = await import("./resend-provider.server");
  return new ResendEmailProvider();
}
