export type RepMetasAccessLinkInput = {
  appOrigin: string;
  email: string;
  next: string;
  firstAccessUrl: string | null;
};

export type RepInviteSessionAction = "open_destination" | "show_login" | "switch_account";

function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/** Decide o fluxo sem confiar apenas na existência de uma sessão local. */
export function resolveRepInviteSession(
  sessionEmail: string | null | undefined,
  recipientEmail: string | null | undefined,
): RepInviteSessionAction {
  const session = normalizeEmail(sessionEmail);
  const recipient = normalizeEmail(recipientEmail);
  if (!session) return "show_login";
  if (recipient && session === recipient) return "open_destination";
  return "switch_account";
}

/**
 * Primeiro acesso cadastra senha; contas já ativadas passam obrigatoriamente pelo login normal.
 * `conviteRep` valida a conta local e só remove uma sessão de outra pessoa, sem trocar senha.
 */
export function buildRepMetasAccessUrl({
  appOrigin,
  email,
  next,
  firstAccessUrl,
}: RepMetasAccessLinkInput): string {
  const link = firstAccessUrl ? new URL(firstAccessUrl) : new URL("/auth", appOrigin);
  link.searchParams.set("next", next);
  if (!firstAccessUrl) {
    link.searchParams.set("e", email);
    link.searchParams.set("conviteRep", "1");
  }
  return link.toString();
}
