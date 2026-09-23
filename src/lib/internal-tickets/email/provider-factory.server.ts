import { FakeEmailProvider } from "./fake-provider";
import { ResendEmailProvider } from "./resend-provider.server";
import type { EmailProvider } from "./types";

/**
 * Fase 7 — ambiente de teste sem credencial real. Com
 * INTERNAL_TICKETS_EMAIL_MODE=mock, todo envio do módulo usa o provider em
 * memória (nenhuma chamada de rede, nenhuma chave necessária) — útil pra
 * exercitar o fluxo completo (criar → enviar → outbox) num ambiente de
 * staging antes de ter domínio/chave Resend configurados. Produção deve
 * deixar a env var ausente (default 'live').
 */
let mockProviderSingleton: FakeEmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  const mode = process.env.INTERNAL_TICKETS_EMAIL_MODE;
  if (mode === "mock") {
    if (!mockProviderSingleton) mockProviderSingleton = new FakeEmailProvider();
    return mockProviderSingleton;
  }
  return new ResendEmailProvider();
}
