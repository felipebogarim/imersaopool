/**
 * Geração e leitura de cabeçalhos RFC 5322 (Message-ID / In-Reply-To / References)
 * usados para encadear a conversa de um ticket por e-mail, como correlação
 * secundária ao token em reply-address.ts.
 */

export function generateMessageId(domain: string): string {
  return `<${crypto.randomUUID()}@${domain}>`;
}

/** União de In-Reply-To + References recebidos, sem duplicatas, preservando a ordem de chegada. */
export function collectReferences(
  inReplyTo: string | null | undefined,
  references: string | null | undefined,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const add = (value: string | null | undefined) => {
    if (!value) return;
    for (const ref of value.split(/\s+/).filter(Boolean)) {
      if (!seen.has(ref)) {
        seen.add(ref);
        ordered.push(ref);
      }
    }
  };
  add(references);
  add(inReplyTo);
  return ordered;
}
