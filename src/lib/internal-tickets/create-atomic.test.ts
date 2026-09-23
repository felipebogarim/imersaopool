import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
const tableWrites: string[] = [];
let rpcResult: { data: unknown; error: { message: string } | null };
let currentContext: unknown;

function userClient() {
  const table = (name: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in"]) q[m] = () => q;
    q.insert = () => {
      tableWrites.push(name);
      return q;
    };
    q.single = async () => ({
      data: {
        sla_first_response_minutes: 60,
        sla_resolution_minutes: 240,
        default_sla_first_response_minutes: 60,
        default_sla_resolution_minutes: 240,
      },
      error: null,
    });
    q.maybeSingle = async () => ({ data: { active_company_id: "co-1" }, error: null });
    q.then = (res: (v: unknown) => unknown) =>
      res({ data: [{ is_primary_recipient: true }], error: null, count: 1 });
    return q;
  };
  return { from: table, rpc: async () => ({ data: true, error: null }) };
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (name: string) => ({ insert: () => (tableWrites.push(name), { error: null }) }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return rpcResult;
    },
  },
}));

const ids = {
  categoryId: "11111111-1111-4111-8111-111111111111",
  sectorId: "22222222-2222-4222-8222-222222222222",
};
const input = { title: "Pintura", description: "desc", ...ids, productIds: [] as string[] };

describe("createTicketAtomic (persistência local atômica)", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    tableWrites.length = 0;
    currentContext = { supabase: userClient(), userId: "u-1" };
    vi.stubEnv("INTERNAL_TICKETS_EMAIL_MODE", "mock");
    vi.stubEnv("INTERNAL_TICKETS_REPLY_DOMAIN", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sucesso: uma única chamada RPC e nenhuma escrita avulsa em tabela", async () => {
    rpcResult = { data: { ticket: { id: "t-1", ticket_number: "SOL-000009" } }, error: null };
    const { createTicketAtomic } = await import("./create-ticket.server");
    const t = await createTicketAtomic(currentContext as never, input);
    expect(t.id).toBe("t-1");
    expect(rpcCalls.map((c) => c.name)).toEqual(["internal_ticket_create_atomic"]);
    expect(tableWrites).toEqual([]);
  });

  // Cenários A/B/C: falha em sector_stop / produtos / recipients acontece DENTRO da
  // função SQL; o Postgres desfaz tudo. Aqui: o erro chega como "nenhum ticket registrado"
  // e o código da aplicação não gravou nada por fora (nada para "compensar").
  it.each(["sector_stops", "internal_ticket_products", "internal_ticket_recipients"])(
    "falha da RPC (%s) → erro claro, sem escritas parciais fora da transação",
    async (failing) => {
      rpcResult = { data: null, error: { message: `erro em ${failing}` } };
      const { createTicketAtomic } = await import("./create-ticket.server");
      await expect(createTicketAtomic(currentContext as never, input)).rejects.toThrow(
        "Nenhum ticket foi registrado",
      );
      expect(tableWrites).toEqual([]);
    },
  );

  it("modo de e-mail inválido falha antes de gravar", async () => {
    vi.stubEnv("INTERNAL_TICKETS_EMAIL_MODE", "live");
    const { createTicketAtomic } = await import("./create-ticket.server");
    await expect(createTicketAtomic(currentContext as never, input)).rejects.toThrow(
      "INTERNAL_TICKETS_EMAIL_MODE inválido",
    );
    expect(rpcCalls).toEqual([]);
  });
});

describe("migration internal_ticket_create_atomic", () => {
  const sql = readFileSync(
    resolve(
      __dirname,
      "../../../supabase/migrations/20260923190000_internal_tickets_create_atomic.sql",
    ),
    "utf8",
  );
  it("grava todas as estruturas obrigatórias na mesma função (mesma transação)", () => {
    for (const t of [
      "internal_tickets",
      "internal_ticket_products",
      "internal_ticket_sector_stops",
      "internal_ticket_recipients",
      "internal_ticket_events",
      "internal_ticket_email_outbox",
    ]) {
      expect(sql).toMatch(new RegExp(`INSERT INTO public\\.${t}\\b`));
    }
  });
  it("só service_role executa", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*FROM public, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/);
  });
});
