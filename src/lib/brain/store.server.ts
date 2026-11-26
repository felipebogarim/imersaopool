// Persistência do Brain (conversas, mensagens, anexos, auditoria). Usa service role SEMPRE com
// filtro explícito pelo dono (user_id) — o representante não tem acesso direto às tabelas.
// Se a migration ainda não foi aplicada, as funções sinalizam "indisponível" e o chat funciona
// sem histórico persistido.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LlmMessage } from "./llm";
import type {
  BrainConversation,
  BrainInterface,
  BrainMessage,
  BrainScope,
  BrainSource,
} from "./types";
import { ehAusente } from "./brain.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

async function admin(): Promise<AnyClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyClient;
}

export class StoreIndisponivel extends Error {}

function checar(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (ehAusente(error)) throw new StoreIndisponivel("Persistência do Brain indisponível.");
  throw new Error("Falha ao gravar/ler o histórico.");
}

export async function criarConversa(userId: string, iface: BrainInterface, titulo: string) {
  const db = await admin();
  const { data, error } = await db
    .from("brain_conversations")
    .insert({ user_id: userId, interface: iface, titulo: titulo.slice(0, 120) })
    .select("id")
    .single();
  checar(error);
  return String(data!.id);
}

/** Conversa do próprio usuário na mesma interface; outra pessoa/interface = não encontrada. */
export async function conversaDoUsuario(userId: string, id: string, iface: BrainInterface) {
  const db = await admin();
  const { data, error } = await db
    .from("brain_conversations")
    .select("id, titulo, interface, updated_at")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("interface", iface)
    .is("deleted_at", null)
    .maybeSingle();
  checar(error);
  return data as BrainConversation | null;
}

export async function listarConversas(
  userId: string,
  iface: BrainInterface,
): Promise<BrainConversation[]> {
  const db = await admin();
  const { data, error } = await db
    .from("brain_conversations")
    .select("id, titulo, interface, updated_at")
    .eq("user_id", userId)
    .eq("interface", iface)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);
  checar(error);
  return (data ?? []) as BrainConversation[];
}

export async function renomearConversa(userId: string, id: string, titulo: string) {
  const db = await admin();
  const { error } = await db
    .from("brain_conversations")
    .update({ titulo: titulo.slice(0, 120) })
    .eq("id", id)
    .eq("user_id", userId);
  checar(error);
}

export async function excluirConversa(userId: string, id: string) {
  const db = await admin();
  const { error } = await db
    .from("brain_conversations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  checar(error);
}

type LinhaMensagem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: BrainSource[] | null;
  attachments: Array<{ name: string; mime: string }> | null;
  clientes_ref: string[] | null;
  created_at: string;
};

/**
 * Mensagens da conversa. Revalidação de escopo: resposta que citou clientes que deixaram de
 * pertencer ao escopo atual (ex.: mudança de carteira) é ocultada.
 */
export async function mensagensDaConversa(
  conversaId: string,
  clientesPermitidos: Set<string> | null,
): Promise<BrainMessage[]> {
  const db = await admin();
  const { data, error } = await db
    .from("brain_messages")
    .select("id, role, content, sources, attachments, clientes_ref, created_at")
    .eq("conversation_id", conversaId)
    .order("created_at", { ascending: true })
    .limit(400);
  checar(error);
  return ((data ?? []) as LinhaMensagem[]).map((m) => {
    const oculto =
      clientesPermitidos != null && (m.clientes_ref ?? []).some((c) => !clientesPermitidos.has(c));
    return {
      id: m.id,
      role: m.role,
      content: oculto ? "Conteúdo não disponível no seu acesso atual." : m.content,
      sources: oculto ? [] : (m.sources ?? []),
      attachments: m.attachments ?? [],
      created_at: m.created_at,
      oculto,
    };
  });
}

/** Contexto das últimas mensagens para o modelo (somente texto). */
export function historicoParaModelo(msgs: BrainMessage[], max = 16): LlmMessage[] {
  return msgs
    .filter((m) => !m.oculto)
    .slice(-max)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
}

export async function salvarMensagem(args: {
  conversaId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  sources?: BrainSource[];
  attachments?: Array<{ name: string; mime: string; size?: number; text?: string }>;
  clientesRef?: string[];
  modelo?: string;
  tokensEntrada?: number;
  tokensSaida?: number;
  retencaoAnexosDias: number;
}) {
  const db = await admin();
  const { data, error } = await db
    .from("brain_messages")
    .insert({
      conversation_id: args.conversaId,
      user_id: args.userId,
      role: args.role,
      content: args.content,
      sources: args.sources ?? [],
      attachments: (args.attachments ?? []).map((a) => ({ name: a.name, mime: a.mime })),
      clientes_ref: args.clientesRef ?? [],
      modelo: args.modelo ?? null,
      tokens_entrada: args.tokensEntrada ?? null,
      tokens_saida: args.tokensSaida ?? null,
    })
    .select("id")
    .single();
  checar(error);
  const messageId = String(data!.id);
  const comTexto = (args.attachments ?? []).filter((a) => a.text);
  if (comTexto.length) {
    const expira = new Date(Date.now() + args.retencaoAnexosDias * 86_400_000).toISOString();
    const { error: eAnexo } = await db.from("brain_attachments").insert(
      comTexto.map((a) => ({
        owner_id: args.userId,
        conversation_id: args.conversaId,
        message_id: messageId,
        nome: a.name.slice(0, 200),
        mime: a.mime.slice(0, 120),
        tamanho: a.size ?? null,
        texto_extraido: (a.text ?? "").slice(0, 200_000),
        expira_em: expira,
      })),
    );
    checar(eAnexo);
  }
  await db
    .from("brain_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", args.conversaId);
  return messageId;
}

export async function mensagensHoje(userId: string): Promise<number> {
  const db = await admin();
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const { count, error } = await db
    .from("brain_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", inicio.toISOString());
  if (error) return 0;
  return count ?? 0;
}

/** Auditoria de cada turno (não bloqueia a resposta se falhar). */
export async function auditar(args: {
  scope: BrainScope;
  iface: BrainInterface;
  conversaId: string | null;
  ferramentas: Array<{ nome: string; ok: boolean }>;
  clientes: string[];
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  status: "ok" | "erro" | "cancelado" | "bloqueado";
  detalhe?: string;
}) {
  try {
    const db = await admin();
    await db.from("brain_audit").insert({
      user_id: args.scope.userId,
      interface: args.iface,
      escopo: args.scope.kind,
      escopo_ref: args.scope.kind === "gestao" ? args.scope.companyId : args.scope.repIds.join(","),
      conversation_id: args.conversaId,
      ferramentas: args.ferramentas,
      clientes: args.clientes.slice(0, 200),
      modelo: args.modelo,
      tokens_entrada: args.tokensEntrada,
      tokens_saida: args.tokensSaida,
      status: args.status,
      detalhe: args.detalhe?.slice(0, 500) ?? null,
    });
  } catch {
    // auditoria indisponível (migration pendente) não interrompe o chat
  }
}
