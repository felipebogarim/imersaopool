import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
const tableWrites: string[] = [];
let rpcResult: { data: unknown; error: { message: string } | null };
let currentContext: unknown;

function userClient() {
  return {
    from: (name: string) => ({
      insert: () => (tableWrites.push(name), { error: null }),
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return rpcResult;
    },
  };
}

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
    expect(rpcCalls.map((c) => c.name)).toEqual(["internal_ticket_create_atomic_authenticated"]);
    expect(rpcCalls[0].args).toEqual({
      p_title: "Pintura",
      p_description: "desc",
      p_client_id: null,
      p_category_id: ids.categoryId,
      p_sector_id: ids.sectorId,
      p_commercial_owner_user_id: null,
      p_priority: "normal",
      p_product_ids: [],
    });
    expect(tableWrites).toEqual([]);
  });

  it("usa o cliente autenticado e não envia identidade, empresa, SLA ou outbox", async () => {
    rpcResult = { data: { ticket: { id: "t-1", ticket_number: "SOL-000009" } }, error: null };
    const { createTicketAtomic } = await import("./create-ticket.server");
    await createTicketAtomic(currentContext as never, input);

    expect(Object.keys(rpcCalls[0].args)).not.toEqual(
      expect.arrayContaining([
        "p_user_id",
        "p_company_id",
        "p_sla_first_response_minutes",
        "p_sla_resolution_minutes",
        "p_sla_first_response_due_at",
        "p_sla_resolution_due_at",
        "p_outbox_sender",
        "p_outbox_message_id",
      ]),
    );
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

describe("createInternalTicket (ligação do formulário com a persistência atômica)", () => {
  const source = readFileSync(resolve(__dirname, "./tickets.functions.ts"), "utf8");

  it("delega a criação exclusivamente para createTicketAtomic", () => {
    const createSection = source.slice(
      source.indexOf("export const createInternalTicket"),
      source.indexOf("const sendTicketSchema"),
    );
    expect(createSection).toContain('import("@/lib/internal-tickets/create-ticket.server")');
    expect(createSection).toContain("return createTicketAtomic(context, data)");
    expect(createSection).not.toMatch(/\.from\([^)]*internal_ticket/);
  });
});

describe("migration internal_ticket_create_atomic_authenticated", () => {
  const sql = readFileSync(
    resolve(
      __dirname,
      "../../../supabase/migrations/20260923210000_internal_tickets_create_atomic_authenticated.sql",
    ),
    "utf8",
  );

  const functionBody = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION"));

  it("deriva identidade de auth.uid() e rejeita sessão ausente", () => {
    expect(functionBody).toMatch(/v_user_id uuid := auth\.uid\(\)/);
    expect(functionBody).toMatch(/IF v_user_id IS NULL THEN[\s\S]*Autenticação obrigatória/);
    expect(functionBody).not.toMatch(/\bp_user_id\b/);
  });

  it("deriva a empresa ativa e não aceita company_id do chamador", () => {
    expect(functionBody).toContain("v_company_id := public.current_company_id()");
    expect(functionBody).toMatch(/IF v_company_id IS NULL THEN/);
    expect(functionBody).not.toMatch(/\bp_company_id\b/);
  });

  it("reutiliza o papel do módulo e preserva somente os papéis autorizados a criar", () => {
    expect(functionBody).toContain("public.internal_ticket_module_role(v_user_id)");
    for (const role of ["comercial", "gestor_comercial", "admin"]) {
      expect(functionBody).toContain(`public.has_role(v_user_id, '${role}')`);
    }
    expect(functionBody).not.toContain("public.has_role(v_user_id, 'diretoria')");
  });

  it("valida isolamento tenant de cliente, produtos e responsável comercial", () => {
    expect(functionBody).toMatch(/public\.clients[\s\S]*c\.company_id = v_company_id/);
    expect(functionBody).toMatch(/public\.own_products[\s\S]*product\.company_id = v_company_id/);
    expect(functionBody).toMatch(
      /public\.profiles owner_profile[\s\S]*owner_profile\.active_company_id = v_company_id/,
    );
  });

  it("calcula SLA no banco com precedência categoria sobre setor", () => {
    expect(functionBody).toMatch(
      /v_first_response_minutes := COALESCE\([\s\S]*v_category_first_response_minutes,[\s\S]*v_sector_first_response_minutes/,
    );
    expect(functionBody).toMatch(/make_interval\(mins => v_first_response_minutes\)/);
    expect(functionBody).not.toMatch(/\bp_sla_/);
  });

  it("rejeita setor sem principal antes do primeiro INSERT", () => {
    const recipientValidation = functionBody.indexOf("sp.is_primary_recipient");
    const firstInsert = functionBody.indexOf("INSERT INTO public.internal_tickets");
    expect(recipientValidation).toBeGreaterThan(0);
    expect(recipientValidation).toBeLessThan(firstInsert);
  });

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
    expect(functionBody).not.toMatch(/\b(COMMIT|ROLLBACK)\b/);
    expect(functionBody).not.toMatch(/EXCEPTION\s+WHEN/);
  });

  it("gera metadados internos da outbox sem parâmetros controlados pelo chamador", () => {
    expect(functionBody).toContain("'ticket-opened:' || v_ticket.id");
    expect(functionBody).toContain("'ticket-opened'");
    expect(functionBody).toContain("jsonb_build_object('to', v_to, 'cc', v_cc)");
    expect(functionBody).toContain("gen_random_uuid()");
    expect(functionBody).not.toMatch(/\bp_outbox_/);
  });

  it("mantém a RPC antiga intacta e expõe apenas a nova para authenticated", () => {
    expect(sql).not.toMatch(/DROP FUNCTION[\s\S]*public\.internal_ticket_create_atomic\s*\(/);
    expect(sql).not.toMatch(/REVOKE[\s\S]*ON FUNCTION public\.internal_ticket_create_atomic\s*\(/);
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.internal_ticket_create_atomic_authenticated\([\s\S]*REVOKE ALL ON FUNCTION public\.internal_ticket_create_atomic_authenticated\([\s\S]*FROM public, anon, service_role;[\s\S]*GRANT EXECUTE ON FUNCTION public\.internal_ticket_create_atomic_authenticated\([\s\S]*TO authenticated;/,
    );
  });

  it("o fluxo TypeScript não usa supabaseAdmin nem exige service role", () => {
    const source = readFileSync(resolve(__dirname, "./create-ticket.server.ts"), "utf8");
    expect(source).toContain("db(context.supabase)");
    expect(source).not.toContain("supabaseAdmin");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
