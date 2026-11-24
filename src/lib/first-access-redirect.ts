const DEFAULT_FIRST_ACCESS_DESTINATION = "/home";

/** Aceita somente destinos internos do portal do representante. */
export function firstAccessDestination(next: string | null | undefined): string {
  if (!next) return DEFAULT_FIRST_ACCESS_DESTINATION;
  if (!/^\/portal-rep(?:\/|$)/.test(next)) return DEFAULT_FIRST_ACCESS_DESTINATION;
  if (next.startsWith("//") || next.includes("\\")) return DEFAULT_FIRST_ACCESS_DESTINATION;
  return next;
}
