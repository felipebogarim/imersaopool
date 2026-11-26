// Resolução de escopo e capacidades do Brain (função pura, testável). O servidor alimenta com
// dados da sessão; nada aqui confia em parâmetros do cliente.

import type { BrainCapability, BrainInterface, BrainScope } from "./types";

/**
 * Capacidades padrão por papel (D2/D8). A tabela brain_role_capabilities, quando existir,
 * substitui estes padrões — a regra não depende do nome do papel no código além do fallback.
 * Perfis não listados (comercial, agente…) ficam bloqueados por padrão.
 */
const GESTAO: BrainCapability[] = [
  "chat",
  "base_integral",
  "conhecimento_cadastrar",
  "conhecimento_importar",
  "conhecimento_aprovar",
  "auditoria",
];

export const CAPACIDADES_PADRAO: Record<string, BrainCapability[]> = {
  admin: [
    "chat",
    "base_integral",
    "conhecimento_cadastrar",
    "conhecimento_importar",
    "conhecimento_aprovar",
    "confidencialidade",
    "modelos",
    "custos_limites",
    "auditoria",
  ],
  // Gestão do Brain para gestores: conhecimento e auditoria. Flag do portal, modelos, custos e
  // confidencialidade restrita ficam com o administrador.
  gestor: GESTAO,
  gestor_comercial: GESTAO,
  representante: ["chat"],
};

export function capacidadesDosPapeis(
  papeis: readonly string[],
  tabela: Record<string, BrainCapability[]> | null,
): BrainCapability[] {
  const fonte = tabela ?? CAPACIDADES_PADRAO;
  const out = new Set<BrainCapability>();
  for (const p of papeis) for (const c of fonte[p] ?? []) out.add(c);
  return [...out];
}

export type EntradaEscopo = {
  userId: string;
  interface: BrainInterface;
  papeis: readonly string[];
  capacidades: BrainCapability[];
  /** Representantes vinculados ao login (representatives.user_id). */
  repIds: readonly string[];
  /** Empresa ativa do usuário (current_company_id). */
  companyId: string | null;
  /** Feature flag do portal do representante. */
  portalHabilitado: boolean;
};

export type ResultadoEscopo = { ok: true; scope: BrainScope } | { ok: false; motivo: string };

/**
 * Plataforma: exige "chat" + "base_integral" e empresa ativa; login vinculado a representante
 * nunca usa a plataforma (inconsistência → bloqueio).
 * Portal: exige vínculo com exatamente um representante, "chat" e a flag habilitada.
 */
export function resolverEscopo(e: EntradaEscopo): ResultadoEscopo {
  if (!e.userId) return { ok: false, motivo: "Sessão inválida." };
  if (e.interface === "plataforma") {
    if (e.repIds.length > 0) {
      return { ok: false, motivo: "Login de representante não acessa a plataforma." };
    }
    if (!e.capacidades.includes("chat") || !e.capacidades.includes("base_integral")) {
      return { ok: false, motivo: "Seu perfil não tem acesso à Inteligência Comercial." };
    }
    if (!e.companyId) return { ok: false, motivo: "Nenhuma empresa ativa selecionada." };
    return {
      ok: true,
      scope: {
        kind: "gestao",
        userId: e.userId,
        companyId: e.companyId,
        capabilities: e.capacidades,
      },
    };
  }
  if (!e.portalHabilitado) {
    return { ok: false, motivo: "A Inteligência Comercial ainda não está liberada no portal." };
  }
  if (e.repIds.length !== 1) {
    return { ok: false, motivo: "Vínculo de representante ausente ou ambíguo." };
  }
  if (!e.capacidades.includes("chat")) {
    return { ok: false, motivo: "Seu perfil não tem acesso à Inteligência Comercial." };
  }
  // Representante nunca recebe base integral, mesmo que a tabela de capacidades a conceda.
  return {
    ok: true,
    scope: {
      kind: "representante",
      userId: e.userId,
      repIds: [...e.repIds],
      capabilities: e.capacidades.filter((c) => c === "chat"),
    },
  };
}
