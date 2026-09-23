export type EmailMode = "mock" | "resend";

/**
 * Lê INTERNAL_TICKETS_EMAIL_MODE. Sem fallback silencioso: ausente ou inválido
 * é erro de configuração explícito (nunca cai em Resend por padrão).
 */
export function getEmailMode(): EmailMode {
  const raw = process.env.INTERNAL_TICKETS_EMAIL_MODE?.trim().toLowerCase();
  if (raw === "mock" || raw === "resend") return raw;
  throw new Error(
    raw
      ? `INTERNAL_TICKETS_EMAIL_MODE inválido: "${raw}" (use "mock" ou "resend")`
      : 'INTERNAL_TICKETS_EMAIL_MODE não configurada (use "mock" ou "resend")',
  );
}

/** Em modo mock, domínio/segredo de reply têm valores locais — nada real é enviado. */
export function getReplyEnv(
  name: "INTERNAL_TICKETS_REPLY_DOMAIN" | "INTERNAL_TICKETS_REPLY_SECRET",
): string {
  const value = process.env[name];
  if (value) return value;
  if (getEmailMode() === "mock") {
    return name === "INTERNAL_TICKETS_REPLY_DOMAIN" ? "mock.local" : "mock-reply-secret";
  }
  throw new Error(`${name} não configurada`);
}
