import { isTechnicalAddress, parseMailbox } from "./mailbox";
import type { ParsedInboundEmail } from "./inbound";

export function detectInboundQuarantineReason(
  message: ParsedInboundEmail,
  replyDomain: string,
): string | null {
  const sender = parseMailbox(message.from);
  if (!sender) return "invalid_sender";
  if (isTechnicalAddress(sender.email, replyDomain)) return "system_sender_loop";
  if (message.headers["x-newline-relay-id"] || message.headers["x-newline-system-message"]) {
    return "system_relay_loop";
  }
  const autoSubmitted = message.headers["auto-submitted"]?.trim().toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return "automated_message";
  const precedence = message.headers.precedence?.trim().toLowerCase();
  if (precedence && ["bulk", "junk", "list", "auto_reply"].includes(precedence)) {
    return "automated_message";
  }
  return null;
}

export function deriveCleanText(text: string | null): string | null {
  if (!text) return null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const boundary = lines.findIndex((line) =>
    /^(>+\s|On .+ wrote:|Em .+ escreveu:|De:\s|From:\s)/i.test(line.trim()),
  );
  const clean = lines
    .slice(0, boundary < 0 ? undefined : boundary)
    .join("\n")
    .trim();
  return clean || text.trim() || null;
}
