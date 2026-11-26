import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  cb: null as null | ((e: string, s: { user: { id: string } } | null) => void),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "user-a" } } } }),
      onAuthStateChange: (cb: (e: string, s: { user: { id: string } } | null) => void) => {
        auth.cb = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  },
}));
vi.mock("@/lib/ai-endpoint-client", () => ({
  aiAuthHeaders: async () => ({ Authorization: "Bearer t" }),
}));
vi.mock("@/lib/brain.functions", () => ({ getBrainConversation: vi.fn(async () => []) }));

// ambiente "navegador" mínimo para o store
const mem = new Map<string, string>();
vi.stubGlobal("window", {});
vi.stubGlobal("sessionStorage", {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

function sse(eventos: unknown[]) {
  const corpo = eventos.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(new Blob([corpo]).stream(), { status: 200 });
}

describe("brain-chat-store", () => {
  beforeEach(() => {
    mem.clear();
  });

  it("mantém a mesma conversa para qualquer interface que leia o store (janela ↔ página)", async () => {
    const { brainChat, __resetBrainChatStores } = await import("./brain-chat-store");
    __resetBrainChatStores();
    const corpos: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        corpos.push(JSON.parse(String(init.body)));
        return sse([
          { type: "meta", conversationId: "conv-1", persisted: true, contexto: "ALFA" },
          { type: "text", delta: "Olá" },
          { type: "done", messageId: "m-1" },
        ]);
      }),
    );
    await brainChat.enviar("plataforma", "primeira", [], { tipo: "area", area: "Metas" });
    await brainChat.enviar("plataforma", "segunda", [], null);

    // segunda mensagem segue na mesma conversa (como ao trocar da janela para a página)
    expect(corpos[1].conversationId).toBe("conv-1");
    expect(corpos[0].contexto).toEqual({ tipo: "area", area: "Metas" });
    expect(mem.get("brain:conversa:user-a:plataforma")).toBe("conv-1");
  });

  it("portal e plataforma têm conversas separadas", async () => {
    const { brainChat, __resetBrainChatStores } = await import("./brain-chat-store");
    __resetBrainChatStores();
    const corpos: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        corpos.push(JSON.parse(String(init.body)));
        return sse([
          { type: "meta", conversationId: "conv-p", persisted: true },
          { type: "done", messageId: null },
        ]);
      }),
    );
    await brainChat.enviar("plataforma", "a", [], null);
    await brainChat.enviar("portal", "b", [], null);
    expect(corpos[1].interface).toBe("portal");
    expect(corpos[1].conversationId).toBeNull();
  });

  it("troca de usuário zera a conversa em memória", async () => {
    const { brainChat, __resetBrainChatStores } = await import("./brain-chat-store");
    __resetBrainChatStores();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sse([
          { type: "meta", conversationId: "conv-a", persisted: true },
          { type: "done", messageId: null },
        ]),
      ),
    );
    await brainChat.enviar("plataforma", "a", [], null);
    auth.cb?.("SIGNED_IN", { user: { id: "user-b" } });
    const corpos: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        corpos.push(JSON.parse(String(init.body)));
        return sse([{ type: "done", messageId: null }]);
      }),
    );
    await brainChat.enviar("plataforma", "b", [], null);
    expect(corpos[0].conversationId).toBeNull();
  });
});
