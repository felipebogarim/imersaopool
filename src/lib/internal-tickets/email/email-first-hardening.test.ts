import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");

describe("contrato SQL de hardening EMAIL-FIRST", () => {
  it("protege INSERT técnico de mensagens e anexos sem revogar UPDATE de tickets (compatibilidade)", () => {
    const sql = migration("20260924170000_internal_ticket_email_first_schema.sql");
    expect(sql).not.toMatch(/^\s*REVOKE\s+UPDATE\s+ON\s+(TABLE\s+)?public\.internal_tickets\b/im);
    expect(sql).toContain("REVOKE INSERT ON public.internal_ticket_messages FROM authenticated");
    expect(sql).toContain("REVOKE INSERT ON public.internal_ticket_attachments FROM authenticated");
    expect(sql).not.toMatch(/GRANT INSERT \([^)]*scan_status/is);
    expect(sql).not.toMatch(/GRANT INSERT \([^)]*provider_email_id/is);
  });

  it("finaliza relay somente após ownership da lease e limita retry ambíguo", () => {
    const sql = migration("20260924180000_internal_ticket_email_first_rpcs.sql");
    const update = sql.indexOf("WHERE id = p_relay_id AND lease_token = p_lease_token");
    const stale = sql.indexOf("'reason', 'stale_lease'", update);
    const outbound = sql.indexOf("INSERT INTO public.internal_ticket_messages", update);
    expect(update).toBeGreaterThan(-1);
    expect(stale).toBeGreaterThan(update);
    expect(outbound).toBeGreaterThan(stale);
    expect(sql).toContain("provider_reconciliation_required");
  });

  it("expõe RPCs autenticadas de status e reatribuição e o código novo não faz UPDATE direto", () => {
    const sql = migration("20260924180000_internal_ticket_email_first_rpcs.sql");
    const application = readFileSync(
      resolve(process.cwd(), "src/lib/internal-tickets/ticket-actions.functions.ts"),
      "utf8",
    );
    expect(sql).toContain("internal_ticket_update_status_authenticated");
    expect(sql).toContain("internal_ticket_reassign_authenticated");
    expect(application).toContain('"internal_ticket_update_status_authenticated"');
    expect(application).toContain('"internal_ticket_reassign_authenticated"');
    expect(application).not.toMatch(/\.from\("internal_tickets"\)\s*\.update\(/);
  });

  it("reatribui setor e participantes em uma RPC autenticada", () => {
    const sql = migration("20260924180000_internal_ticket_email_first_rpcs.sql");
    const application = readFileSync(
      resolve(process.cwd(), "src/lib/internal-tickets/ticket-actions.functions.ts"),
      "utf8",
    );
    expect(sql).toContain("internal_ticket_reassign_authenticated");
    expect(sql).toContain("PERFORM public.internal_ticket_sync_sector_participants");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.internal_ticket_reassign_authenticated",
    );
    expect(application).toContain('"internal_ticket_reassign_authenticated"');
    expect(application).not.toContain(".update({ sector_id: data.toSectorId })");
  });

  it("serializa emissão e consumo de magic links em ticket -> tokens", () => {
    const sql = migration("20260924190000_internal_ticket_email_first_opening_message.sql");
    const apply = sql.indexOf("internal_ticket_apply_requester_validation");
    const ticketLock = sql.indexOf("WHERE id = v_ticket_id FOR UPDATE", apply);
    const tokenLocks = sql.indexOf("ORDER BY id FOR UPDATE", ticketLock);
    expect(ticketLock).toBeGreaterThan(apply);
    expect(tokenLocks).toBeGreaterThan(ticketLock);
    expect(sql).toContain("internal_ticket_issue_requester_validation_tokens");
  });

  it("mantém preflight de Message-ID documentado antes da 170000", () => {
    const docs = readFileSync(resolve(process.cwd(), "internal-tickets-setup.md"), "utf8");
    expect(docs).toContain("GROUP BY ticket_id, message_id");
    expect(docs).toContain("HAVING count(*) > 1");
  });
});
