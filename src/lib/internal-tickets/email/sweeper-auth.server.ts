import { timingSafeEqual } from "node:crypto";

export function authorizeInternalTicketSweeper(
  authorization: string | null,
  expectedSecret = process.env.INTERNAL_TICKETS_SWEEPER_SECRET ?? "",
): boolean {
  if (!expectedSecret || !authorization?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(expectedSecret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
