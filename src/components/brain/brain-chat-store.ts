// Estado da conversa do Brain compartilhado entre a janela flutuante e a página completa.
// Vive no módulo (sobrevive à navegação SPA) e é isolado por usuário: troca de sessão zera tudo.
// A conversa persistida continua no banco; aqui fica só o que está na tela.

import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aiAuthHeaders } from "@/lib/ai-endpoint-client";
import { getBrainConversation } from "@/lib/brain.functions";
import type { ContextoTela } from "@/lib/brain/page-context";
import type {
  BrainAttachmentInput,
  BrainInterface,
  BrainMessage,
  BrainSource,
  BrainStreamEvent,
} from "@/lib/brain/types";

export type MsgUi = BrainMessage & { status?: string; erro?: boolean };
export type AnexoEnvio = BrainAttachmentInput & { size: number };

export type BrainChatState = {
  conversaId: string | null;
  msgs: MsgUi[];
  enviando: boolean;
  persistido: boolean;
  analise: boolean;
  contexto: string | null;
  carregando: boolean;
};

const inicial = (): BrainChatState => ({
  conversaId: null,
  msgs: [],
  enviando: false,
  persistido: true,
  analise: false,
  contexto: null,
  carregando: false,
});

type Store = {
  state: BrainChatState;
  listeners: Set<() => void>;
  abort: AbortController | null;
  restaurado: boolean;
};

const stores = new Map<BrainInterface, Store>();
let dono: string | null | undefined;

const chaveSessao = (iface: BrainInterface) => `brain:conversa:${dono ?? "anon"}:${iface}`;

function store(iface: BrainInterface): Store {
  let s = stores.get(iface);
  if (!s) {
    s = { state: inicial(), listeners: new Set(), abort: null, restaurado: false };
    stores.set(iface, s);
  }
  return s;
}

function set(iface: BrainInterface, patch: Partial<BrainChatState>) {
  const s = store(iface);
  s.state = { ...s.state, ...patch };
  if ("conversaId" in patch && typeof window !== "undefined") {
    try {
      if (patch.conversaId) sessionStorage.setItem(chaveSessao(iface), patch.conversaId);
      else sessionStorage.removeItem(chaveSessao(iface));
    } catch {
      // sessionStorage indisponível
    }
  }
  s.listeners.forEach((l) => l());
}

function atualizarMsg(iface: BrainInterface, id: string, f: (m: MsgUi) => MsgUi) {
  set(iface, { msgs: store(iface).state.msgs.map((m) => (m.id === id ? f(m) : m)) });
}

/** Zera todas as conversas em memória (troca de usuário / logout). */
function resetarTudo() {
  for (const [iface, s] of stores) {
    s.abort?.abort();
    s.state = inicial();
    s.restaurado = false;
    s.listeners.forEach((l) => l());
    stores.set(iface, s);
  }
}

if (typeof window !== "undefined") {
  void supabase.auth.getSession().then(({ data }) => {
    dono = data.session?.user.id ?? null;
  });
  supabase.auth.onAuthStateChange((_e, session) => {
    const novo = session?.user.id ?? null;
    if (dono !== undefined && novo !== dono) resetarTudo();
    dono = novo;
  });
}

export function useBrainChat(iface: BrainInterface): BrainChatState {
  const s = store(iface);
  return useSyncExternalStore(
    (l) => {
      s.listeners.add(l);
      return () => s.listeners.delete(l);
    },
    () => s.state,
    () => s.state,
  );
}

export const brainChat = {
  setAnalise(iface: BrainInterface, analise: boolean) {
    set(iface, { analise });
  },

  /** Reabre a última conversa da aba (após recarregar a página). */
  async restaurar(iface: BrainInterface) {
    const s = store(iface);
    if (s.restaurado || s.state.msgs.length || s.state.enviando) return;
    s.restaurado = true;
    if (dono === undefined) {
      const { data } = await supabase.auth.getSession();
      dono = data.session?.user.id ?? null;
    }
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(chaveSessao(iface));
    } catch {
      id = null;
    }
    if (id) await brainChat.abrir(iface, id).catch(() => set(iface, { conversaId: null }));
  },

  async abrir(iface: BrainInterface, id: string) {
    if (store(iface).state.enviando) return;
    set(iface, { carregando: true });
    try {
      const msgs = await getBrainConversation({ data: { interface: iface, id } });
      set(iface, { conversaId: id, msgs, carregando: false });
    } catch (e) {
      set(iface, { carregando: false });
      throw e;
    }
  },

  nova(iface: BrainInterface) {
    store(iface).abort?.abort();
    set(iface, { conversaId: null, msgs: [], contexto: null });
  },

  interromper(iface: BrainInterface) {
    store(iface).abort?.abort();
  },

  async enviar(
    iface: BrainInterface,
    message: string,
    anexos: AnexoEnvio[],
    contexto: ContextoTela | null,
  ) {
    const s = store(iface);
    if (!message.trim() || s.state.enviando) return;
    const idUser = `u${Date.now()}`;
    const idBot = `a${Date.now()}`;
    const agora = new Date().toISOString();
    set(iface, {
      enviando: true,
      msgs: [
        ...s.state.msgs,
        {
          id: idUser,
          role: "user",
          content: message,
          attachments: anexos.map((a) => ({ name: a.name, mime: a.mime })),
          created_at: agora,
        },
        { id: idBot, role: "assistant", content: "", created_at: agora, status: "Pensando…" },
      ],
    });
    const ctrl = new AbortController();
    s.abort = ctrl;
    let botId = idBot;
    const upd = (f: (m: MsgUi) => MsgUi) => atualizarMsg(iface, botId, f);

    try {
      const res = await fetch("/api/brain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await aiAuthHeaders()) },
        body: JSON.stringify({
          interface: iface,
          conversationId: s.state.conversaId,
          message,
          analise: s.state.analise,
          contexto,
          attachments: anexos.map(({ name, mime, size, text, dataUrl }) => ({
            name,
            mime,
            size,
            text,
            dataUrl,
          })),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Não foi possível obter resposta.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const bloco = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!bloco.startsWith("data:")) continue;
          let ev: BrainStreamEvent;
          try {
            ev = JSON.parse(bloco.slice(5)) as BrainStreamEvent;
          } catch {
            continue;
          }
          if (ev.type === "meta") {
            set(iface, {
              persistido: ev.persisted,
              contexto: ev.contexto ?? null,
              ...(ev.conversationId ? { conversaId: ev.conversationId } : {}),
            });
          } else if (ev.type === "tool") upd((m) => ({ ...m, status: `${ev.label}…` }));
          else if (ev.type === "text")
            upd((m) => ({ ...m, content: m.content + ev.delta, status: undefined }));
          else if (ev.type === "sources")
            upd((m) => ({ ...m, sources: ev.sources as BrainSource[] }));
          else if (ev.type === "done") {
            const novo = ev.messageId;
            upd((m) => ({ ...m, id: novo ?? m.id, status: undefined }));
            if (novo) botId = novo;
          } else if (ev.type === "error") {
            upd((m) => ({ ...m, content: ev.message, erro: true, status: undefined }));
          }
        }
      }
    } catch (e) {
      if (ctrl.signal.aborted) {
        upd((m) => ({ ...m, status: undefined, content: m.content || "_(interrompido)_" }));
      } else {
        upd((m) => ({
          ...m,
          status: undefined,
          erro: true,
          content: e instanceof Error ? e.message : "Falha na resposta.",
        }));
      }
    } finally {
      s.abort = null;
      set(iface, { enviando: false });
    }
  },
};

/** Somente para testes. */
export function __resetBrainChatStores() {
  resetarTudo();
}

/** Somente para testes/preview visual: injeta um estado de conversa. */
export function __seedBrainChat(iface: BrainInterface, patch: Partial<BrainChatState>) {
  set(iface, patch);
}
