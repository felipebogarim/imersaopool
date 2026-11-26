// Cache curto da carteira por USUÁRIO + ESCOPO (nunca compartilhado entre usuários/escopos).
// Evita recarregar a base a cada pergunta da mesma conversa. Instâncias serverless podem não
// reaproveitar o cache — é só otimização.

import { montarContexto } from "./brain.server";
import type { ToolContext } from "./tools";
import type { BrainScope } from "./types";

const TTL_MS = 120_000;
const cache = new Map<
  string,
  { em: number; ctx: Omit<ToolContext, "fontes" | "clientesAcessados"> }
>();

export function chaveEscopo(scope: BrainScope) {
  return scope.kind === "gestao"
    ? `${scope.userId}|gestao|${scope.companyId}|${[...scope.capabilities].sort().join(",")}`
    : `${scope.userId}|rep|${[...scope.repIds].sort().join(",")}`;
}

export async function obterContexto(scope: BrainScope, jwt: string): Promise<ToolContext> {
  const k = chaveEscopo(scope);
  const hit = cache.get(k);
  let base = hit && Date.now() - hit.em < TTL_MS ? hit.ctx : null;
  if (!base) {
    const { fontes: _f, clientesAcessados: _c, ...resto } = await montarContexto(scope, jwt);
    base = resto;
    cache.set(k, { em: Date.now(), ctx: base });
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  }
  // Estado do turno sempre novo.
  return { ...base, fontes: [], clientesAcessados: new Set() };
}
