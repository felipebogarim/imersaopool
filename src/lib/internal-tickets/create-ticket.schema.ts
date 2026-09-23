import { z } from "zod";
import { TICKET_PRIORITIES } from "@/lib/internal-tickets/priority";

export const createTicketSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().min(1),
  clientId: z.string().uuid().nullable().optional(),
  productIds: z.array(z.string().uuid()).optional().default([]),
  categoryId: z.string().uuid(),
  sectorId: z.string().uuid(),
  commercialOwnerUserId: z.string().uuid().nullable().optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
});
