import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession } } }));

const { aiAuthHeaders, setPublicRepToken } = await import("./ai-endpoint-client");

describe("cabeçalhos de autenticação das rotas de IA", () => {
  beforeEach(() => setPublicRepToken(null));

  it("usuário logado envia o Bearer da sessão", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "a.b.c" } } });
    expect(await aiAuthHeaders()).toEqual({ Authorization: "Bearer a.b.c" });
  });

  it("página pública envia o token do representante; sem nada, nenhum cabeçalho", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await aiAuthHeaders()).toEqual({});
    setPublicRepToken("tok-12345678");
    expect(await aiAuthHeaders()).toEqual({ "x-rep-token": "tok-12345678" });
  });
});
