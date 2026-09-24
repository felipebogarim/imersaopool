import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createTicketSchema } from "@/lib/internal-tickets/create-ticket.schema";

// ── Criar ticket ─────────────────────────────────────────────────────────

export const createInternalTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => createTicketSchema.parse(raw))
  .handler(async ({ data, context }) => {
    console.info("[INTERNAL_TICKETS_ATOMIC] createInternalTicket delegating to createTicketAtomic");
    const { createTicketAtomic } = await import("@/lib/internal-tickets/create-ticket.server");
    return createTicketAtomic(context, data);
  });

// ── Enviar ticket (aberto -> enviado, dispara e-mail) ───────────────────

const sendTicketSchema = z.object({ ticketId: z.string().uuid() });

export const sendInternalTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => sendTicketSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { sendTicketAuthenticated } = await import("@/lib/internal-tickets/send-ticket.server");
    return sendTicketAuthenticated(context, data.ticketId);
  });
