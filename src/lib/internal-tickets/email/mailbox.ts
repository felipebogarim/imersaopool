export type Mailbox = {
  email: string;
  name: string | null;
};

const SIMPLE_EMAIL = /^[^\s@<>]+@[^\s@<>]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Parses the formats returned by Resend (address or `Display name <address>`). */
export function parseMailbox(value: string): Mailbox | null {
  const trimmed = value.trim();
  const angle = /^(.*?)\s*<([^<>]+)>$/.exec(trimmed);
  const email = normalizeEmail(angle ? angle[2] : trimmed);
  if (!SIMPLE_EMAIL.test(email)) return null;
  const rawName = angle?.[1]
    ?.trim()
    .replace(/^(["'])(.*)\1$/, "$2")
    .trim();
  return { email, name: rawName || null };
}

export function uniqueMailboxes(values: readonly string[]): Mailbox[] {
  const byEmail = new Map<string, Mailbox>();
  for (const value of values) {
    const mailbox = parseMailbox(value);
    if (!mailbox) continue;
    const previous = byEmail.get(mailbox.email);
    if (!previous || (!previous.name && mailbox.name)) byEmail.set(mailbox.email, mailbox);
  }
  return [...byEmail.values()];
}

export function isTechnicalAddress(email: string, replyDomain: string): boolean {
  const normalized = normalizeEmail(email);
  const domain = replyDomain.trim().toLowerCase();
  return (
    normalized === `chamados@${domain}` ||
    (normalized.startsWith("r+") && normalized.endsWith(`@${domain}`))
  );
}

export type ActiveParticipant = {
  email: string;
  active?: boolean;
};

export function calculateDirectRecipients(
  to: readonly string[],
  cc: readonly string[],
  replyDomain: string,
): string[] {
  return uniqueMailboxes([...to, ...cc])
    .map((mailbox) => mailbox.email)
    .filter((email) => !isTechnicalAddress(email, replyDomain));
}

export function calculateRelayTargets(
  participants: readonly ActiveParticipant[],
  sender: string,
  directRecipients: readonly string[],
): string[] {
  const excluded = new Set([normalizeEmail(sender), ...directRecipients.map(normalizeEmail)]);
  const targets = new Set<string>();
  for (const participant of participants) {
    const email = normalizeEmail(participant.email);
    if (participant.active !== false && SIMPLE_EMAIL.test(email) && !excluded.has(email)) {
      targets.add(email);
    }
  }
  return [...targets];
}
