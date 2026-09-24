import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseInboundEmailData } from "./inbound";
import { directParticipantPayload } from "./inbound-processing.server";
import { calculateDirectRecipients, calculateRelayTargets } from "./mailbox";
import { collectReferences } from "./message-id";
import { sanitizeInboundHtml } from "../sanitize-html";

const migration = readFileSync(
  "supabase/migrations/20260924180000_internal_ticket_email_first_rpcs.sql",
  "utf8",
);
const schema = readFileSync(
  "supabase/migrations/20260924170000_internal_ticket_email_first_schema.sql",
  "utf8",
);
const completionMigration = readFileSync(
  "supabase/migrations/20260924190000_internal_ticket_email_first_opening_message.sql",
  "utf8",
);

describe("EMAIL-FIRST Reply and Reply All", () => {
  const domain = "chamados.poolflux.app";
  const participants = [
    { email: "felipe@newline.com" },
    { email: "angelica@newline.com" },
    { email: "copy@newline.com" },
  ];

  it("Reply relays to every other active participant", () => {
    const direct = calculateDirectRecipients([`r+token@${domain}`], [], domain);
    expect(calculateRelayTargets(participants, "felipe@newline.com", direct)).toEqual([
      "angelica@newline.com",
      "copy@newline.com",
    ]);
  });

  it("Reply All does not relay to a direct requester", () => {
    const direct = calculateDirectRecipients(
      [`r+token@${domain}`],
      ["Angélica <angelica@newline.com>"],
      domain,
    );
    expect(calculateRelayTargets(participants, "felipe@newline.com", direct)).toEqual([
      "copy@newline.com",
    ]);
  });

  it("registers new TO and CC participants with their respective origin", () => {
    const parsed = parseInboundEmailData({
      to: [`r+token@${domain}`, "Diego <diego@external.com>"],
      cc: ["Ana <ana@external.com>"],
    });
    expect(directParticipantPayload(parsed, domain)).toEqual([
      { email: "diego@external.com", name: "Diego", source: "email_to" },
      { email: "ana@external.com", name: "Ana", source: "email_cc" },
    ]);
  });

  it("never sends a relay to the sender or duplicate direct recipients", () => {
    expect(
      calculateRelayTargets(
        [...participants, { email: "ANGELICA@newline.com" }],
        "Felipe@Newline.com",
        ["angelica@newline.com"],
      ),
    ).toEqual(["copy@newline.com"]);
  });
});

describe("EMAIL-FIRST durable database contract", () => {
  it("deduplicates webhook, inbound message and relay per recipient", () => {
    expect(schema).toContain("internal_ticket_webhook_events_provider_event_key");
    expect(schema).toContain("internal_ticket_webhook_received_email_key");
    expect(schema).toContain("internal_ticket_messages_provider_email_key");
    expect(schema).toContain("internal_ticket_relay_source_target_key");
  });

  it("uses leases for concurrent webhook and relay processing", () => {
    expect(migration).toContain("lease_expires_at < now()");
    expect(migration).toContain("internal_ticket_claim_relay");
    expect(migration).toContain("status = 'sending'");
  });

  it("quarantines an unknown sender instead of creating relays", () => {
    expect(migration).toContain("NOT v_known OR p_quarantine_reason IS NOT NULL");
    expect(migration).toContain("'unknown_sender'");
    const quarantinePosition = migration.indexOf("IF NOT v_known OR p_quarantine_reason");
    const relayPosition = migration.indexOf("INSERT INTO public.internal_ticket_relay_deliveries");
    expect(quarantinePosition).toBeLessThan(relayPosition);
  });

  it("only the active principal records first response and SLA", () => {
    expect(migration).toContain("p.active AND p.is_current_primary");
    expect(migration).toContain("IF v_is_primary AND v_ticket.first_response_at IS NULL");
    expect(migration).toContain("first_response_sla_met");
  });

  it("keeps email-added participants active after sector reassignment", () => {
    expect(migration).toContain("AND NOT added_by_email");
    expect(migration).toContain("SET is_current_primary = false");
  });

  it("consumes requester validation links atomically and invalidates the sibling", () => {
    expect(completionMigration).toContain("FOR UPDATE");
    expect(completionMigration).toContain("v_token.intended_user_id IS DISTINCT FROM");
    expect(completionMigration).toContain("v_ticket.status <> 'aguardando_validacao'");
    expect(completionMigration).toContain("action IN ('confirmar_conclusao', 'nao_resolvido')");
  });
});

describe("EMAIL-FIRST content and threading", () => {
  it("works without Message-ID because provider email_id is canonical", () => {
    const parsed = parseInboundEmailData({ email_id: "received-1", from: "a@example.com" });
    expect(parsed.messageId).toBeNull();
    expect(parsed.emailId).toBe("received-1");
  });

  it("preserves threading references in order without duplicates", () => {
    expect(collectReferences("<reply@x>", "<root@x> <reply@x>")).toEqual(["<root@x>", "<reply@x>"]);
  });

  it("removes executable HTML while retaining safe message content", () => {
    const sanitized = sanitizeInboundHtml(
      '<p>Olá</p><script>alert(1)</script><img src=x onerror="alert(2)">',
    );
    expect(sanitized).toContain("Olá");
    expect(sanitized).not.toContain("script");
    expect(sanitized).not.toContain("onerror");
  });
});
