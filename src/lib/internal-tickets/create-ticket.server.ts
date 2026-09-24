import type { FnContext } from "@/lib/internal-tickets/ticket-permissions";
import type { z } from "zod";
import type { createTicketSchema } from "@/lib/internal-tickets/create-ticket.schema";

type CreateTicketInput = z.infer<typeof createTicketSchema>;

// internal_ticket_* ainda não está no types.ts gerado — ver admin.functions.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: unknown): any {
  return supabase;
}

/**
 * Cria o ticket pela RPC transacional usando o cliente autenticado. Identidade,
 * empresa, autorização, referências tenant-scoped, SLA e outbox são validados
 * ou derivados no PostgreSQL a partir de auth.uid().
 */
export async function createTicketAtomic(context: FnContext, data: CreateTicketInput) {
  // Config de e-mail inválida (modo ausente/errado) é erro local: falha antes de gravar.
  const { getEmailMode } = await import("@/lib/internal-tickets/email/email-mode.server");
  getEmailMode();

  const supabase = db(context.supabase);
  console.info("[INTERNAL_TICKETS_ATOMIC] calling RPC internal_ticket_create_atomic_authenticated");
  const { data: created, error: createError } = await supabase.rpc(
    "internal_ticket_create_atomic_authenticated",
    {
      p_title: data.title,
      p_description: data.description,
      p_client_id: data.clientId ?? null,
      p_category_id: data.categoryId,
      p_sector_id: data.sectorId,
      p_commercial_owner_user_id: data.commercialOwnerUserId ?? null,
      p_priority: data.priority ?? "normal",
      p_product_ids: data.productIds,
    },
  );
  if (createError) {
    throw new Error(
      `Não foi possível criar a solicitação. Nenhum ticket foi registrado. (${createError.message})`,
    );
  }
  if (!created?.ticket?.id || !created.ticket.ticket_number) {
    throw new Error("A criação da solicitação retornou uma resposta inválida.");
  }
  console.info(`[INTERNAL_TICKETS_ATOMIC] RPC success ticket=${created.ticket.id}`);
  return created.ticket as { id: string; ticket_number: string };
}
