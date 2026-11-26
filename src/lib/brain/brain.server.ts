// Camada de servidor do Brain: sessão → escopo → carteira (pelas fontes oficiais) → ferramentas.
// Gestão: lê com o token do próprio usuário (RLS da empresa + RPC get_performance_goals_bi, que
// exige admin/gestor). Representante: padrão do Portal (service role SEMPRE filtrado pelo
// representante vinculado ao login + RPC rep_get_performance_goals com o mesmo representante).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  BRAIN_CAPABILITIES,
  type BrainCapability,
  type BrainInterface,
  type BrainScope,
} from "./types";
import { capacidadesDosPapeis, resolverEscopo, type ResultadoEscopo } from "./scope";
import {
  chaveMetas,
  montarCarteira,
  normalizarNome,
  uploadsVigentes,
  type ClienteCarteira,
  type LinhaBruta,
  type UploadBruto,
  type ValoresBrutos,
} from "./carteira";
import { mediaMensalCompras } from "@/lib/performance-media-cliente";
import { sanitizeRatio } from "@/lib/performance-metrics";
import type { ConhecimentoTrecho, MetaVigente, ToolContext, VersaoHistorica } from "./tools";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

async function adminClient(): Promise<AnyClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyClient;
}

/** Cliente Supabase com o token do usuário (RLS aplicada). */
export function userClient(jwt: string): AnyClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Configuração do Supabase ausente.");
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Valida o JWT no servidor; null = inválido/expirado. */
export async function usuarioDoJwt(jwt: string): Promise<string | null> {
  if (!jwt || jwt.split(".").length !== 3) return null;
  try {
    const { data, error } = await userClient(jwt).auth.getClaims(jwt);
    const sub = data?.claims?.sub;
    return !error && typeof sub === "string" && sub ? sub : null;
  } catch {
    return null;
  }
}

/** Tabela/ função ausente (migration ainda não aplicada). */
export const ehAusente = (e: { code?: string; message?: string } | null | undefined) =>
  !!e &&
  (e.code === "42P01" ||
    e.code === "PGRST205" ||
    e.code === "PGRST202" ||
    /does not exist|schema cache/i.test(e.message ?? ""));

// ------------------------------------ Configuração ------------------------------------

export type BrainSettings = {
  portal_representante_habilitado: boolean;
  modelo_padrao: string;
  modelo_analise: string;
  retencao_conversas_dias: number;
  retencao_anexos_dias: number;
  limite_mensagens_dia: number;
};

export const SETTINGS_PADRAO: BrainSettings = {
  portal_representante_habilitado: false,
  modelo_padrao: "google/gemini-2.5-flash",
  modelo_analise: "google/gemini-2.5-pro",
  retencao_conversas_dias: 365,
  retencao_anexos_dias: 90,
  limite_mensagens_dia: 200,
};

export async function lerSettings(): Promise<BrainSettings & { persistencia: boolean }> {
  const admin = await adminClient();
  const { data, error } = await admin.from("brain_settings").select("chave, valor");
  if (error) return { ...SETTINGS_PADRAO, persistencia: false };
  const out: Record<string, unknown> = { ...SETTINGS_PADRAO };
  for (const r of data ?? []) if (r.chave in SETTINGS_PADRAO) out[r.chave] = r.valor;
  return { ...(out as BrainSettings), persistencia: true };
}

async function capacidadesConfiguradas(admin: AnyClient) {
  const { data, error } = await admin.from("brain_role_capabilities").select("role, capability");
  if (error || !data?.length) return null; // sem tabela/linhas → padrões do código
  const t: Record<string, BrainCapability[]> = {};
  for (const r of data) {
    if (!(BRAIN_CAPABILITIES as readonly string[]).includes(r.capability)) continue;
    (t[r.role] ??= []).push(r.capability as BrainCapability);
  }
  return t;
}

export type AcessoResolvido = ResultadoEscopo & {
  settings: BrainSettings & { persistencia: boolean };
  capacidades: BrainCapability[];
};

/** Escopo do usuário para a interface pedida (falha = bloqueio). */
export async function resolverAcesso(
  userId: string,
  /** Cliente com o token do próprio usuário (para a empresa ativa via RLS/RPC). */
  db: AnyClient,
  iface: BrainInterface,
): Promise<AcessoResolvido> {
  const admin = await adminClient();
  const settings = await lerSettings();
  try {
    const [roles, reps, tabela, company] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", userId),
      admin.from("representatives").select("id").eq("user_id", userId),
      capacidadesConfiguradas(admin),
      db.rpc("current_company_id"),
    ]);
    if (roles.error || reps.error) throw new Error("perfil indisponível");
    const papeis = (roles.data ?? []).map((r) => String(r.role));
    const capacidades = capacidadesDosPapeis(papeis, tabela);
    const res = resolverEscopo({
      userId,
      interface: iface,
      papeis,
      capacidades,
      repIds: (reps.data ?? []).map((r) => String(r.id)),
      companyId: typeof company.data === "string" ? company.data : null,
      portalHabilitado: settings.portal_representante_habilitado,
    });
    return { ...res, settings, capacidades };
  } catch {
    return { ok: false, motivo: "Não foi possível validar seu acesso.", settings, capacidades: [] };
  }
}

// ------------------------------------ Carteira ------------------------------------

async function paginar<T>(
  fn: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await fn(de, de + 999);
    if (error) throw new Error("Falha ao ler a base comercial.");
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

type EstadoMetas = {
  base?: { metas?: unknown; realizado?: unknown; media?: unknown };
  items?: Array<{
    familia: string;
    meta_mensal: number | null;
    vigente_desde?: string | null;
    origem?: string | null;
  }>;
};

export type CarteiraCarregada = {
  clientes: ClienteCarteira[];
  metas: Map<string, MetaVigente[]>;
  /** Cliente para leituras extras (histórico) sempre com o mesmo escopo. */
  db: AnyClient;
};

export async function carregarCarteira(scope: BrainScope, jwt: string): Promise<CarteiraCarregada> {
  // Gestão: token do usuário (RLS da empresa). Representante: service role filtrado.
  const db = scope.kind === "gestao" ? userClient(jwt) : await adminClient();

  let qUploads = db
    .from("rep_performance_uploads")
    .select(
      "id, representative_id, periodo_label, periodo_inicio, periodo_fim, created_at, substituida_em",
    )
    .is("substituida_em", null);
  qUploads =
    scope.kind === "gestao"
      ? qUploads.eq("company_id", scope.companyId)
      : qUploads.in("representative_id", scope.repIds);
  const { data: ups, error: eUps } = await qUploads;
  if (eUps) throw new Error("Falha ao ler as versões de performance.");
  const vigentes = uploadsVigentes((ups ?? []) as UploadBruto[]).filter(
    (u) => scope.kind === "gestao" || scope.repIds.includes(String(u.representative_id)),
  );
  if (!vigentes.length) return { clientes: [], metas: new Map(), db };

  const repIds = [...new Set(vigentes.map((u) => String(u.representative_id)))];
  const [linhas, reps] = await Promise.all([
    paginar<LinhaBruta>((de, ate) =>
      db
        .from("rep_performance_rows")
        .select("id, upload_id, razao_social, categoria, total_pct, familia_pct")
        .in(
          "upload_id",
          vigentes.map((u) => u.id),
        )
        .order("razao_social")
        .range(de, ate),
    ),
    db.from("representatives").select("id, nome").in("id", repIds),
  ]);
  const representantes = new Map((reps.data ?? []).map((r) => [String(r.id), String(r.nome)]));

  const valores: ValoresBrutos[] = [];
  const metas = new Map<string, MetaVigente[]>();
  const guardar = (rowId: string, st: EstadoMetas | null | undefined) => {
    if (!st) return;
    valores.push({
      row_id: rowId,
      metas: st.base?.metas,
      realizado: st.base?.realizado,
      media: st.base?.media,
    });
    metas.set(
      rowId,
      (st.items ?? []).map((i) => ({
        familia: i.familia,
        meta_mensal: i.meta_mensal,
        vigente_desde: i.vigente_desde ?? null,
        origem: i.origem ?? null,
      })),
    );
  };

  if (scope.kind === "gestao") {
    for (let i = 0; i < linhas.length; i += 400) {
      const ids = linhas.slice(i, i + 400).map((l) => l.id);
      const { data, error } = await db.rpc("get_performance_goals_bi", { _row_ids: ids });
      if (error) throw new Error("Falha ao ler os valores da base comercial.");
      for (const r of (data ?? []) as Array<{
        row_id: string;
        metas?: unknown;
        realizado?: unknown;
        media?: unknown;
        items?: EstadoMetas["items"];
      }>) {
        guardar(r.row_id, { base: r, items: r.items });
      }
    }
  } else {
    const repId = scope.repIds[0];
    const doRep = linhas.filter(
      (l) => vigentes.find((u) => u.id === l.upload_id)?.representative_id === repId,
    );
    for (let i = 0; i < doRep.length; i += 12) {
      await Promise.all(
        doRep.slice(i, i + 12).map(async (l) => {
          const { data, error } = await db.rpc("rep_get_performance_goals", {
            _row_id: l.id,
            _representative_id: repId,
          });
          if (!error) guardar(l.id, data as EstadoMetas);
        }),
      );
    }
  }

  const clientes = montarCarteira({ uploads: vigentes, linhas, valores, representantes });
  return { clientes, metas, db };
}

/** Versões anteriores do cliente (mesmo representante, mesmo nome) — dentro do escopo. */
export async function historicoDoCliente(
  scope: BrainScope,
  db: AnyClient,
  c: ClienteCarteira,
): Promise<VersaoHistorica[]> {
  if (scope.kind === "representante" && !scope.repIds.includes(c.representanteId)) return [];
  const { data: ups } = await db
    .from("rep_performance_uploads")
    .select("id, periodo_label, periodo_fim, created_at")
    .eq("representative_id", c.representanteId)
    .is("substituida_em", null)
    .order("periodo_fim", { ascending: true });
  const upIds = (ups ?? []).map((u) => u.id);
  if (!upIds.length) return [];
  const { data: rows } = await db
    .from("rep_performance_rows")
    .select("id, upload_id, razao_social, total_pct, familia_pct")
    .in("upload_id", upIds)
    .ilike("razao_social", c.nome.replace(/[%_]/g, ""));
  const doCliente = (rows ?? []).filter((r) => chaveMetas(r.razao_social) === chaveMetas(c.nome));
  const out: VersaoHistorica[] = [];
  for (const u of ups ?? []) {
    const r = doCliente.find((x) => x.upload_id === u.id);
    if (!r) continue;
    let base: EstadoMetas["base"] | undefined;
    if (scope.kind === "gestao") {
      const { data } = await db.rpc("get_performance_goals_bi", { _row_ids: [r.id] });
      base = (data as Array<EstadoMetas["base"]> | null)?.[0];
    } else {
      const { data } = await db.rpc("rep_get_performance_goals", {
        _row_id: r.id,
        _representative_id: c.representanteId,
      });
      base = (data as EstadoMetas | null)?.base;
    }
    const media = mediaMensalCompras({ ...base, familia_pct: r.familia_pct });
    out.push({
      periodo_label: u.periodo_label,
      periodo_fim: u.periodo_fim,
      atingimento: sanitizeRatio(r.total_pct),
      media_mensal: media.total,
      media_estimada: media.estimado,
    });
  }
  return out;
}

/** Busca textual no Brain respeitando confidencialidade e carteira (fail-closed). */
export async function buscarConhecimento(
  scope: BrainScope,
  consulta: string,
  clientes: string[],
): Promise<ConhecimentoTrecho[]> {
  const admin = await adminClient();
  let q = admin
    .from("brain_knowledge")
    .select("id, titulo, tipo, conteudo, fonte, data_referencia, cliente_norm, confidencialidade")
    .eq("status", "validado")
    .textSearch("busca", consulta, { type: "websearch", config: "portuguese" })
    .limit(8);
  if (scope.kind === "gestao") {
    q = q.eq("company_id", scope.companyId);
    if (!scope.capabilities.includes("confidencialidade"))
      q = q.neq("confidencialidade", "restrito");
  } else {
    q = q.eq("confidencialidade", "representantes");
  }
  const { data, error } = await q;
  if (error) return [];
  const permitidos = new Set(clientes);
  return (data ?? [])
    .filter((k) => {
      if (!k.cliente_norm) return true; // conhecimento geral/institucional
      return permitidos.has(String(k.cliente_norm)); // vinculado a cliente: só dentro do escopo
    })
    .map((k) => ({
      id: String(k.id),
      titulo: String(k.titulo),
      tipo: String(k.tipo),
      conteudo: String(k.conteudo ?? ""),
      fonte: k.fonte ?? null,
      data_referencia: k.data_referencia ?? null,
    }));
}

export async function montarContexto(scope: BrainScope, jwt: string): Promise<ToolContext> {
  const cart = await carregarCarteira(scope, jwt);
  return {
    scope,
    carteira: cart.clientes,
    metasDoCliente: async (c) => cart.metas.get(c.id) ?? null,
    historicoDoCliente: (c) => historicoDoCliente(scope, cart.db, c),
    buscarConhecimento: (consulta, clientes) => buscarConhecimento(scope, consulta, clientes),
    fontes: [],
    clientesAcessados: new Set(),
  };
}

/** Nomes normalizados da carteira vigente do escopo (leve; usado na revalidação do histórico). */
export async function nomesDaCarteira(scope: BrainScope, jwt: string | null): Promise<Set<string>> {
  const db = scope.kind === "gestao" && jwt ? userClient(jwt) : await adminClient();
  let q = db
    .from("rep_performance_uploads")
    .select(
      "id, representative_id, periodo_label, periodo_inicio, periodo_fim, created_at, substituida_em",
    )
    .is("substituida_em", null);
  q =
    scope.kind === "gestao"
      ? q.eq("company_id", scope.companyId)
      : q.in("representative_id", scope.repIds);
  const { data: ups, error } = await q;
  if (error) throw new Error("Falha ao validar a carteira.");
  const vigentes = uploadsVigentes((ups ?? []) as UploadBruto[]);
  if (!vigentes.length) return new Set();
  const linhas = await paginar<{ razao_social: string | null }>((de, ate) =>
    db
      .from("rep_performance_rows")
      .select("razao_social")
      .in(
        "upload_id",
        vigentes.map((u) => u.id),
      )
      .range(de, ate),
  );
  return new Set(linhas.map((l) => normalizarNome(l.razao_social)).filter(Boolean));
}
