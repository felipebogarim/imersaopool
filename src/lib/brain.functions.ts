// Server functions da Inteligência Comercial: acesso, histórico de conversas e Gestão do Brain.
// Toda checagem de permissão é feita aqui, no servidor (capacidades resolvidas por papel).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  BrainAccess,
  BrainCapability,
  BrainConversation,
  BrainInterface,
  BrainMessage,
} from "@/lib/brain/types";

const iface = z.enum(["plataforma", "portal"]);

type Ctx = { userId: string; supabase: unknown };

async function acesso(ctx: Ctx, i: BrainInterface) {
  const brain = await import("@/lib/brain/brain.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return brain.resolverAcesso(ctx.userId, ctx.supabase as any, i);
}

/** Exige uma capacidade de administração do Brain (avaliada na interface da plataforma). */
async function exigir(ctx: Ctx, cap: BrainCapability) {
  const a = await acesso(ctx, "plataforma");
  if (!a.capacidades.includes(cap)) throw new Error("Sem permissão.");
  return a;
}

export const getBrainAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BrainAccess> => {
    const [p, r] = await Promise.all([acesso(context, "plataforma"), acesso(context, "portal")]);
    return {
      plataforma: p.ok,
      portal: r.ok,
      persistencia: p.settings.persistencia,
      capabilities: p.capacidades,
      motivo: p.ok ? undefined : p.motivo,
    };
  });

export const listBrainConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ interface: iface }))
  .handler(async ({ data, context }): Promise<BrainConversation[]> => {
    const a = await acesso(context, data.interface);
    if (!a.ok) throw new Error(a.motivo);
    const store = await import("@/lib/brain/store.server");
    try {
      return await store.listarConversas(context.userId, data.interface);
    } catch (e) {
      if (e instanceof store.StoreIndisponivel) return [];
      throw e;
    }
  });

export const getBrainConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ interface: iface, id: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<BrainMessage[]> => {
    const a = await acesso(context, data.interface);
    if (!a.ok) throw new Error(a.motivo);
    const store = await import("@/lib/brain/store.server");
    const brain = await import("@/lib/brain/brain.server");
    const conv = await store.conversaDoUsuario(context.userId, data.id, data.interface);
    if (!conv) throw new Error("Conversa não encontrada.");
    // Representante: revalida o histórico contra a carteira ATUAL.
    const permitidos =
      a.scope.kind === "representante" ? await brain.nomesDaCarteira(a.scope, null) : null;
    return store.mensagensDaConversa(conv.id, permitidos);
  });

export const renameBrainConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      interface: iface,
      id: z.string().uuid(),
      titulo: z.string().trim().min(1).max(120),
    }),
  )
  .handler(async ({ data, context }) => {
    const a = await acesso(context, data.interface);
    if (!a.ok) throw new Error(a.motivo);
    const store = await import("@/lib/brain/store.server");
    await store.renomearConversa(context.userId, data.id, data.titulo);
    return { ok: true };
  });

export const deleteBrainConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ interface: iface, id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const a = await acesso(context, data.interface);
    if (!a.ok) throw new Error(a.motivo);
    const store = await import("@/lib/brain/store.server");
    await store.excluirConversa(context.userId, data.id);
    return { ok: true };
  });

// ------------------------------------ Gestão do Brain ------------------------------------

export type BrainAuditRow = {
  created_at: string;
  user_id: string;
  interface: string;
  escopo: string;
  ferramentas: Array<{ nome: string; ok: boolean }>;
  clientes: string[];
  modelo: string | null;
  status: string;
  detalhe: string | null;
};

export type BrainKnowledgeRow = {
  id: string;
  titulo: string;
  tipo: string;
  camada: string;
  cliente_nome: string | null;
  regiao: string | null;
  portfolio: string | null;
  fonte: string | null;
  data_referencia: string | null;
  confidencialidade: string;
  status: string;
  versao: number;
  valido_ate: string | null;
  updated_at: string;
};

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

export const getBrainAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const a = await acesso(context, "plataforma");
    const caps = a.capacidades;
    const pode = (c: BrainCapability) => caps.includes(c);
    if (!caps.some((c) => c !== "chat" && c !== "base_integral")) throw new Error("Sem permissão.");
    const db = await adminDb();
    const brain = await import("@/lib/brain/brain.server");
    const settings = await brain.lerSettings();
    const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const [uso, audit, caps2, adminRole] = await Promise.all([
      pode("custos_limites") || pode("auditoria")
        ? db
            .from("brain_audit")
            .select("user_id, tokens_entrada, tokens_saida, modelo, status, created_at")
            .gte("created_at", desde)
            .limit(5000)
        : { data: null },
      pode("auditoria")
        ? db
            .from("brain_audit")
            .select(
              "created_at, user_id, interface, escopo, ferramentas, clientes, modelo, status, detalhe",
            )
            .order("created_at", { ascending: false })
            .limit(100)
        : { data: null },
      db.from("brain_role_capabilities").select("role, capability"),
      sb.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    const linhas = (uso.data ?? []) as Array<{
      tokens_entrada: number | null;
      tokens_saida: number | null;
      modelo: string;
      status: string;
      user_id: string;
    }>;
    return {
      isAdmin: adminRole?.data === true,
      capabilities: caps,
      settings,
      uso30d: {
        turnos: linhas.length,
        usuarios: new Set(linhas.map((l) => l.user_id)).size,
        tokensEntrada: linhas.reduce((s, l) => s + (l.tokens_entrada ?? 0), 0),
        tokensSaida: linhas.reduce((s, l) => s + (l.tokens_saida ?? 0), 0),
        erros: linhas.filter((l) => l.status === "erro").length,
        porModelo: Object.entries(
          linhas.reduce<Record<string, number>>(
            (acc, l) => ((acc[l.modelo] = (acc[l.modelo] ?? 0) + 1), acc),
            {},
          ),
        ).map(([modelo, turnos]) => ({ modelo, turnos })),
      },
      auditoria: (audit.data ?? []) as BrainAuditRow[],
      papeis: (caps2.data ?? []) as Array<{ role: string; capability: string }>,
    };
  });

export const saveBrainSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      portal_representante_habilitado: z.boolean().optional(),
      modelo_padrao: z.string().min(3).max(80).optional(),
      modelo_analise: z.string().min(3).max(80).optional(),
      retencao_conversas_dias: z.number().int().min(1).max(3650).optional(),
      retencao_anexos_dias: z.number().int().min(1).max(3650).optional(),
      limite_mensagens_dia: z.number().int().min(1).max(10000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    // Flag do portal e retenção: custos_limites; modelos: modelos.
    const a = await acesso(context, "plataforma");
    const precisa: BrainCapability[] = [];
    if (data.modelo_padrao || data.modelo_analise) precisa.push("modelos");
    if (
      data.portal_representante_habilitado !== undefined ||
      data.retencao_conversas_dias ||
      data.retencao_anexos_dias ||
      data.limite_mensagens_dia
    )
      precisa.push("custos_limites");
    if (precisa.some((c) => !a.capacidades.includes(c))) throw new Error("Sem permissão.");
    const db = await adminDb();
    const linhas = Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([chave, valor]) => ({
        chave,
        valor,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      }));
    const { error } = await db.from("brain_settings").upsert(linhas, { onConflict: "chave" });
    if (error) throw new Error("Não foi possível salvar (migration do Brain aplicada?).");
    return { ok: true };
  });

const conhecimento = z.object({
  titulo: z.string().trim().min(3).max(200),
  conteudo: z.string().trim().min(10).max(100_000),
  tipo: z.enum([
    "imersao",
    "percepcao",
    "concorrencia",
    "decisao",
    "diagnostico",
    "institucional",
    "regra",
    "glossario",
    "outro",
  ]),
  camada: z.enum(["memoria", "institucional"]),
  cliente: z.string().max(200).optional(),
  regiao: z.string().max(80).optional(),
  portfolio: z.string().max(80).optional(),
  fonte: z.string().max(300).optional(),
  data_referencia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  confidencialidade: z.enum(["representantes", "gestao", "restrito"]),
  valido_ate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const listBrainKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ busca: z.string().max(200).optional(), status: z.string().max(20).optional() }),
  )
  .handler(async ({ data, context }) => {
    const a = await acesso(context, "plataforma");
    if (
      !a.ok ||
      !a.capacidades.some((c) => c.startsWith("conhecimento_") || c === "confidencialidade")
    )
      throw new Error("Sem permissão.");
    if (a.scope.kind !== "gestao") throw new Error("Sem permissão.");
    const db = await adminDb();
    let q = db
      .from("brain_knowledge")
      .select(
        "id, titulo, tipo, camada, cliente_nome, regiao, portfolio, fonte, data_referencia, confidencialidade, status, versao, valido_ate, updated_at",
      )
      .eq("company_id", a.scope.companyId)
      .order("updated_at", { ascending: false })
      .limit(300);
    if (!a.capacidades.includes("confidencialidade")) q = q.neq("confidencialidade", "restrito");
    if (data.status) q = q.eq("status", data.status);
    if (data.busca?.trim()) q = q.ilike("titulo", `%${data.busca.trim().replace(/[%_]/g, "")}%`);
    const { data: rows, error } = await q;
    if (error) return { available: false as const, itens: [] as BrainKnowledgeRow[] };
    return { available: true as const, itens: rows as BrainKnowledgeRow[] };
  });

export const saveBrainKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ itens: z.array(conhecimento).min(1).max(200), importacao: z.boolean().optional() }),
  )
  .handler(async ({ data, context }) => {
    const a = await exigir(
      context,
      data.importacao ? "conhecimento_importar" : "conhecimento_cadastrar",
    );
    if (!a.ok || a.scope.kind !== "gestao") throw new Error("Sem permissão.");
    if (
      data.itens.some((i) => i.confidencialidade === "restrito") &&
      !a.capacidades.includes("confidencialidade")
    )
      throw new Error("Sem permissão para conhecimento restrito.");
    const { normalizarNome } = await import("@/lib/brain/carteira");
    const aprova = a.capacidades.includes("conhecimento_aprovar");
    const db = await adminDb();
    const { error } = await db.from("brain_knowledge").insert(
      data.itens.map((i) => ({
        company_id: a.scope.kind === "gestao" ? a.scope.companyId : null,
        titulo: i.titulo,
        conteudo: i.conteudo,
        tipo: i.tipo,
        camada: i.camada,
        cliente_nome: i.cliente?.trim() || null,
        cliente_norm: i.cliente?.trim() ? normalizarNome(i.cliente) : null,
        regiao: i.regiao || null,
        portfolio: i.portfolio || null,
        fonte: i.fonte || null,
        data_referencia: i.data_referencia || null,
        confidencialidade: i.confidencialidade,
        valido_ate: i.valido_ate || null,
        // Sem permissão de aprovação, entra como sugestão (não é usado pelo chat até aprovar).
        status: aprova ? "validado" : "sugerido",
        autor_id: context.userId,
        aprovado_por: aprova ? context.userId : null,
      })),
    );
    if (error) throw new Error("Não foi possível salvar (migration do Brain aplicada?).");
    return { ok: true, status: aprova ? "validado" : "sugerido", quantidade: data.itens.length };
  });

export const setBrainKnowledgeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ id: z.string().uuid(), status: z.enum(["validado", "rejeitado", "inativo"]) }),
  )
  .handler(async ({ data, context }) => {
    const a = await exigir(context, "conhecimento_aprovar");
    if (!a.ok || a.scope.kind !== "gestao") throw new Error("Sem permissão.");
    const db = await adminDb();
    const { error } = await db
      .from("brain_knowledge")
      .update({
        status: data.status,
        aprovado_por: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("company_id", a.scope.companyId);
    if (error) throw new Error("Não foi possível atualizar.");
    return { ok: true };
  });

/** Capacidades por papel (D8). Somente administradores (has_role admin). */
export const setBrainRoleCapability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      role: z.enum(["admin", "gestor", "agente", "comercial", "gestor_comercial", "representante"]),
      capability: z.enum([
        "chat",
        "base_integral",
        "conhecimento_cadastrar",
        "conhecimento_importar",
        "conhecimento_aprovar",
        "confidencialidade",
        "modelos",
        "custos_limites",
        "auditoria",
      ]),
      ativo: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sem permissão.");
    // Representante nunca recebe base integral nem capacidades administrativas.
    if (data.role === "representante" && data.capability !== "chat" && data.ativo)
      throw new Error("Representantes só podem ter a capacidade de chat.");
    // Admin sempre mantém tudo (evita auto-bloqueio).
    if (data.role === "admin" && !data.ativo)
      throw new Error("O administrador mantém todas as capacidades.");
    const db = await adminDb();
    const q = data.ativo
      ? db.from("brain_role_capabilities").upsert({ role: data.role, capability: data.capability })
      : db
          .from("brain_role_capabilities")
          .delete()
          .eq("role", data.role)
          .eq("capability", data.capability);
    const { error } = await q;
    if (error) throw new Error("Não foi possível salvar (migration do Brain aplicada?).");
    return { ok: true };
  });
