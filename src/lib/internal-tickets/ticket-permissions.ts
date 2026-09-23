export type FnContext = { supabase: unknown; userId: string };

// internal_ticket_* ainda não está no types.ts gerado — mesma ressalva do
// resto do módulo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: unknown): any {
  return supabase;
}

/**
 * Confere se quem chama tem permissão de movimentar o ticket (mesma regra
 * da policy internal_tickets_update: requester, responsável comercial,
 * gestor_comercial ou admin). RLS já barraria um UPDATE fora dessa lista,
 * mas silenciosamente (0 linhas afetadas, sem erro) — sem este check,
 * ações com efeito colateral (enviar e-mail, etc.) rodariam mesmo assim
 * antes do UPDATE final falhar sem avisar ninguém.
 */
export async function requireCanManageTicket(
  context: FnContext,
  ticket: { requester_user_id: string; commercial_owner_user_id: string },
): Promise<void> {
  if (ticket.requester_user_id === context.userId) return;
  if (ticket.commercial_owner_user_id === context.userId) return;
  const supabase = db(context.supabase);
  const [{ data: isGestorComercial }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: context.userId, _role: "gestor_comercial" }),
    supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
  ]);
  if (!isGestorComercial && !isAdmin) {
    throw new Error("Acesso negado: você não pode alterar este ticket");
  }
}
