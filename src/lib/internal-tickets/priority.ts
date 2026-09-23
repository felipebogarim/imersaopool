export const TICKET_PRIORITIES = ["baixa", "normal", "alta", "urgente"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};
