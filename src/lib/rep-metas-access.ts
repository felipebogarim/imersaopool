export type RepMetasAccessLinkInput = {
  appOrigin: string;
  email: string;
  next: string;
  firstAccessUrl: string | null;
};

/**
 * Primeiro acesso cadastra senha; contas já ativadas passam obrigatoriamente pelo login normal.
 * `conviteRep` apenas remove uma eventual sessão local de outra pessoa, sem acionar troca de senha.
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
