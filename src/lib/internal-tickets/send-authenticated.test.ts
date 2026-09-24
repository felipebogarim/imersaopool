import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEmailProvider } from "./email/fake-provider";

const ticketId = "11111111-1111-4111-8111-111111111111";
const prepared = {
  already_sent: false,
  attempt_token: "22222222-2222-4222-8222-222222222222",
  idempotency_key: `ticket-opened:${ticketId}`,
  message_id: "<message@internal-tickets.local>",
  ticket_id: ticketId,
  ticket_number: "SOL-000007",
  title: "Pintura especial",
  description: "Descrição",
  priority: "normal",
  sla_first_response_due_at: null,
  sector_name: "Engenharia",
  category_name: "Produto",
  requester_name: "Comercial",
  to: ["destinatario@example.com"],
  cc: [],
};

type RpcResult = { data: unknown; error: { message: string } | null };

function authenticatedClient(prepareResult: RpcResult = { data: prepared, error: null }) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    rpc: async (name: string, args: Record<string, unknown>): Promise<RpcResult> => {
      calls.push({ name, args });
      if (name === "internal_ticket_prepare_send_authenticated") return prepareResult;
      return { data: { ok: true }, error: null };
    },
  };
}

describe("sendTicketAuthenticated", () => {
  beforeEach(() => {
    vi.stubEnv("INTERNAL_TICKETS_EMAIL_MODE", "mock");
    vi.stubEnv("INTERNAL_TICKETS_REPLY_DOMAIN", "");
    vi.stubEnv("INTERNAL_TICKETS_REPLY_SECRET", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("executa o fluxo mock completo sem service role e confirma sucesso", async () => {
    const client = authenticatedClient();
    const provider = new FakeEmailProvider();
    const { sendTicketAuthenticated } = await import("./send-ticket.server");

    const result = await sendTicketAuthenticated(
      { supabase: client, userId: "user-1" },
      ticketId,
      provider,
    );

    expect(provider.sent).toHaveLength(1);
    expect(client.calls.map((call) => call.name)).toEqual([
      "internal_ticket_prepare_send_authenticated",
      "internal_ticket_mark_send_success_authenticated",
    ]);
    expect(result).toEqual({ ok: true, ticketId, status: "enviado", alreadySent: false });
  });

  it("provider falha: registra failure e não confirma sucesso", async () => {
    const client = authenticatedClient();
    const provider = new FakeEmailProvider({ failNextWith: new Error("Falha simulada") });
    const { sendTicketAuthenticated } = await import("./send-ticket.server");

    await expect(
      sendTicketAuthenticated({ supabase: client, userId: "user-1" }, ticketId, provider),
    ).rejects.toThrow("Falha simulada");

    expect(client.calls.map((call) => call.name)).toEqual([
      "internal_ticket_prepare_send_authenticated",
      "internal_ticket_mark_send_failure_authenticated",
    ]);
  });

  it("ticket já enviado não chama o provider nem duplica bookkeeping", async () => {
    const client = authenticatedClient({
      data: {
        already_sent: true,
        ticket_id: ticketId,
        ticket_number: "SOL-000007",
        message_id: prepared.message_id,
      },
      error: null,
    });
    const provider = new FakeEmailProvider();
    const { sendTicketAuthenticated } = await import("./send-ticket.server");

    const result = await sendTicketAuthenticated(
      { supabase: client, userId: "user-1" },
      ticketId,
      provider,
    );

    expect(provider.sent).toHaveLength(0);
    expect(client.calls.map((call) => call.name)).toEqual([
      "internal_ticket_prepare_send_authenticated",
    ]);
    expect(result.alreadySent).toBe(true);
  });
});

describe("migration authenticated send", () => {
  const sql = readFileSync(
    resolve(
      __dirname,
      "../../../supabase/migrations/20260923220000_internal_ticket_authenticated_send.sql",
    ),
    "utf8",
  );

  it("expõe três RPCs estreitas somente para authenticated", () => {
    for (const fn of [
      "internal_ticket_prepare_send_authenticated",
      "internal_ticket_mark_send_success_authenticated",
      "internal_ticket_mark_send_failure_authenticated",
    ]) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
      expect(sql).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}[\\s\\S]*FROM public, anon, service_role`),
      );
      expect(sql).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*TO authenticated`),
      );
    }
  });

  it("todas exigem auth.uid, empresa ativa, acesso ao ticket e papel de envio", () => {
    expect(sql.match(/v_user_id uuid := auth\.uid\(\)/g)).toHaveLength(3);
    expect(sql.match(/v_company_id := public\.current_company_id\(\)/g)).toHaveLength(3);
    expect(sql.match(/public\.internal_ticket_can_access\(t\.id, v_user_id\)/g)).toHaveLength(3);
    expect(sql.match(/t\.company_id = v_company_id/g)).toHaveLength(3);
    expect(sql.match(/Acesso negado: você não pode enviar este ticket/g)).toHaveLength(3);
  });

  it("prepare devolve somente recipients/outbox do ticket e reivindica uma tentativa", () => {
    expect(sql).toMatch(/r\.ticket_id = v_ticket\.id AND r\.role = 'principal'/);
    expect(sql).toMatch(
      /o\.ticket_id = v_ticket\.id[\s\S]*o\.idempotency_key = 'ticket-opened:' \|\| v_ticket\.id/,
    );
    expect(sql).toMatch(/attempt_count = attempt_count \+ 1/);
    expect(sql).toContain("send_attempt_token = v_attempt_token");
    expect(sql).toContain("send_lease_expires_at = now() + interval '5 minutes'");
  });

  it("sucesso confirma outbox, ticket e evento na mesma RPC e é idempotente", () => {
    expect(sql).toMatch(
      /SET status = 'sent',[\s\S]*sent_at = COALESCE\(sent_at, now\(\)\),[\s\S]*provider_message_id = [\s\S]*error_message = NULL,[\s\S]*send_attempt_token = NULL,[\s\S]*send_lease_expires_at = NULL/,
    );
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL");
    expect(sql).toMatch(/SET status = 'enviado', sent_at = now\(\)/);
    expect(sql).toMatch(/INSERT INTO public\.internal_ticket_events/);
    expect(sql).toMatch(/status IN \('sent', 'delivered'\)[\s\S]*already_sent/);
  });

  it("falha altera somente a outbox, preserva ticket e limpa a reivindicação", () => {
    const failureBody = sql.slice(
      sql.indexOf(
        "CREATE OR REPLACE FUNCTION public.internal_ticket_mark_send_failure_authenticated",
      ),
      sql.indexOf("REVOKE ALL ON FUNCTION public.internal_ticket_prepare_send_authenticated"),
    );
    expect(failureBody).toMatch(/SET status = 'failed'/);
    expect(failureBody).toContain("send_attempt_token = NULL");
    expect(failureBody).not.toMatch(/UPDATE public\.internal_tickets/);
    expect(failureBody).not.toMatch(/INSERT INTO public\.internal_ticket_events/);
  });

  it("fluxo autenticado não importa admin nem exige service role", () => {
    const sources = [
      "./tickets.functions.ts",
      "./send-ticket.server.ts",
      "./email/outbox.server.ts",
      "./email/send-ticket-email.server.ts",
    ].map((file) => readFileSync(resolve(__dirname, file), "utf8"));
    for (const source of sources) {
      expect(source).not.toContain("supabaseAdmin");
      expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });
});
