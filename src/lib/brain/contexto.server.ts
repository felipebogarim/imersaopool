// Resolução do contexto da tela no servidor. Cada identificador vindo do navegador é conferido:
// gestão lê com o token do próprio usuário (RLS); representante só dentro dos próprios uploads.
// Qualquer falha = contexto descartado (o chat segue normalmente, sem contexto).

import type { ClienteCarteira } from "./carteira";
import { casarCliente, textoDoContexto, type ContextoResolvido } from "./contexto";
import type { ContextoTela } from "./page-context";
import type { ToolContext } from "./tools";
import { userClient } from "./brain.server";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

export async function resolverContextoTela(
  ctx: ToolContext,
  c: ContextoTela | null | undefined,
  jwt: string,
): Promise<ContextoResolvido> {
  if (!c) return { texto: null, rotulo: null };
  const scope = ctx.scope;
  let clientes: ClienteCarteira[] = [];
  let extra: string | null = null;
  try {
    if (c.tipo === "cliente_linha" && c.rowId) {
      const direto = ctx.carteira.find((x) => x.id === c.rowId);
      if (direto) clientes = [direto];
      else {
        // Linha de versão anterior: descobre nome/representante e casa com a versão vigente.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db: any = scope.kind === "gestao" ? userClient(jwt) : await adminClient();
        const { data } = await db
          .from("rep_performance_rows")
          .select("razao_social, rep_performance_uploads!inner(representative_id)")
          .eq("id", c.rowId)
          .maybeSingle();
        const repId = data?.rep_performance_uploads?.representative_id as string | undefined;
        if (data && repId && (scope.kind === "gestao" || scope.repIds.includes(repId))) {
          clientes = casarCliente(ctx.carteira, data.razao_social, repId);
        }
      }
    } else if (c.tipo === "cliente_nome" && c.nome) {
      // Representante: o repId da URL só restringe; a carteira já é a dele.
      clientes = casarCliente(ctx.carteira, c.nome, c.repId);
    } else if (c.tipo === "cliente_cadastro" && c.clientId && scope.kind === "gestao") {
      const { data } = await userClient(jwt)
        .from("clients")
        .select("razao_social")
        .eq("id", c.clientId)
        .maybeSingle();
      clientes = casarCliente(ctx.carteira, data?.razao_social);
    } else if (c.tipo === "imersao" && c.immersionId && scope.kind === "gestao") {
      const db = userClient(jwt);
      const { data: im } = await db
        .from("immersions")
        .select("client_id, partner_name")
        .eq("id", c.immersionId)
        .maybeSingle();
      if (im?.client_id) {
        const { data: cl } = await db
          .from("clients")
          .select("razao_social")
          .eq("id", im.client_id)
          .maybeSingle();
        clientes = casarCliente(ctx.carteira, cl?.razao_social);
        if (!clientes.length && cl?.razao_social) {
          extra = "Imersão de um cliente sem versão de performance vigente no escopo.";
        }
      } else if (im?.partner_name) {
        extra = `Imersão de parceiro (não é cliente da carteira): ${String(im.partner_name).slice(0, 80)}.`;
      }
    }
  } catch (e) {
    console.error("[brain] contexto descartado", e);
    return { texto: null, rotulo: null };
  }
  return textoDoContexto(c, clientes, extra);
}
