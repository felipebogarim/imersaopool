// Server functions das solicitações de apoio do representante.
// Representante: service role escopado ao representante do usuário logado (padrão do portal).
// Gestão: cliente do usuário (RLS: admin/gestor da empresa ativa).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  SOLICITACAO_STATUS,
  SOLICITACAO_TIPOS,
  limparItens,
  validarSolicitacao,
  type Solicitacao,
} from "@/lib/rep-solicitacoes";

const NOT_MIGRATED = new Set(["PGRST202", "PGRST205", "42883", "42P01"]);
const COLS =
  "id, tipo, titulo, cliente, card_id, acao_trade_tipo, data_evento, data_necessaria, local, publico_estimado, itens, descricao, status, resposta, respondido_em, created_at";

export type SolicitacoesResult = { available: false } | { available: true; items: Solicitacao[] };

type Raw = Omit<Solicitacao, "itens"> & { itens: unknown; representatives?: { nome?: string } };

function normalizar(r: Raw): Solicitacao {
  const itens = Array.isArray(r.itens)
    ? limparItens(r.itens as Array<{ item: string; quantidade: number }>)
    : [];
  const { representatives, ...rest } = r;
  return { ...rest, itens, rep: representatives?.nome };
}

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

/** Pedidos do próprio representante (mais recentes primeiro). */
export const repListSolicitacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SolicitacoesResult> => {
    const { repForUser } = await import("@/lib/rep-portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rep = await repForUser(context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from("rep_support_requests")
      .select(COLS)
      .eq("representative_id", rep.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      if (NOT_MIGRATED.has(error.code ?? "")) return { available: false };
      throw new Error(error.message);
    }
    return { available: true, items: ((data ?? []) as Raw[]).map(normalizar) };
  });

export const repCreateSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      tipo: z.enum(SOLICITACAO_TIPOS),
      titulo: z.string().trim().min(3).max(200),
      cliente: z.string().trim().max(200).nullable().optional(),
      cardId: z.string().uuid().nullable().optional(),
      acaoTradeTipo: z.string().trim().max(120).nullable().optional(),
      dataEvento: dataIso,
      dataNecessaria: dataIso,
      local: z.string().trim().max(200).nullable().optional(),
      publicoEstimado: z.number().int().min(0).max(100000).nullable().optional(),
      itens: z
        .array(
          z.object({ item: z.string().max(200), quantidade: z.number().int().min(0).max(100000) }),
        )
        .max(30),
      descricao: z.string().trim().max(4000).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { repForUser, ownedAction } = await import("@/lib/rep-portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const rep = await repForUser(context.userId);
    const itens = limparItens(data.itens);
    const erro = validarSolicitacao({
      tipo: data.tipo,
      titulo: data.titulo,
      itens,
      acao_trade_tipo: data.acaoTradeTipo,
      data_evento: data.dataEvento,
      data_necessaria: data.dataNecessaria,
    });
    if (erro) throw new Error(erro);
    // Vínculo com uma ação sugerida só se ela for do próprio representante.
    if (data.cardId) await ownedAction(rep, data.cardId);

    const { data: repRow } = await admin
      .from("representatives")
      .select("company_id")
      .eq("id", rep.id)
      .maybeSingle();
    const { data: row, error } = await admin
      .from("rep_support_requests")
      .insert({
        company_id: repRow?.company_id ?? null,
        representative_id: rep.id,
        card_id: data.cardId ?? null,
        tipo: data.tipo,
        titulo: data.titulo,
        cliente: data.cliente || null,
        acao_trade_tipo: data.tipo === "acao_trade" ? data.acaoTradeTipo || null : null,
        data_evento: data.dataEvento || null,
        data_necessaria: data.dataNecessaria || null,
        local: data.local || null,
        publico_estimado: data.publicoEstimado ?? null,
        itens,
        descricao: data.descricao || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      if (NOT_MIGRATED.has(error.code ?? ""))
        throw new Error("Solicitações ainda não disponíveis. Avise a gestão.");
      throw new Error(error.message);
    }
    // Registro no histórico da ação sugerida vinculada (aparece para a gestão no card).
    if (data.cardId) {
      await admin.from("kanban_action_updates").insert({
        card_id: data.cardId,
        source: "representante",
        author_name: rep.nome,
        note: `Solicitou apoio: ${data.titulo}`,
        created_by: context.userId,
      });
    }
    return { ok: true as const, id: row.id as string };
  });

/** Gestão: pedidos da empresa ativa (RLS). */
export const staffListSolicitacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SolicitacoesResult> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from("rep_support_requests")
      .select(`${COLS}, representatives(nome)`)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      if (NOT_MIGRATED.has(error.code ?? "")) return { available: false };
      throw new Error(error.message);
    }
    return { available: true, items: ((data ?? []) as Raw[]).map(normalizar) };
  });

export const staffResponderSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(SOLICITACAO_STATUS),
      resposta: z.string().trim().max(2000).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (context.supabase as any)
      .from("rep_support_requests")
      .update({
        status: data.status,
        resposta: data.resposta || null,
        respondido_por: context.userId,
        respondido_em: now,
        updated_at: now,
      })
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Pedido não encontrado ou sem permissão.");
    return { ok: true as const };
  });
