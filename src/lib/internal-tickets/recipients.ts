/**
 * Resolução de destinatários de um setor — mesma regra usada no servidor
 * (tickets.functions.ts, createInternalTicket/sendInternalTicket): setor +
 * active + receives_new_tickets, daí separado em principal (is_primary_recipient)
 * e cópia (is_cc, exceto quem já é principal). Escalonamento não participa
 * do envio inicial (fica reservado pra lógica futura de SLA).
 *
 * Aqui só serve pra pré-visualização no client (Novo Ticket) — a fonte da
 * verdade de quem efetivamente recebe é sempre a consulta do servidor no
 * momento do envio; se as duas divergirem, ajustar as duas juntas.
 */

export type SectorPersonForRecipients = {
  id: string;
  sector_id: string;
  name: string;
  role_title: string | null;
  email: string;
  active: boolean;
  is_primary_recipient: boolean;
  is_cc: boolean;
  receives_new_tickets: boolean;
};

export type ResolvedRecipients = {
  principal: SectorPersonForRecipients | null;
  cc: SectorPersonForRecipients[];
};

export function resolveSectorRecipients(
  people: SectorPersonForRecipients[],
  sectorId: string,
): ResolvedRecipients {
  const eligible = people.filter(
    (p) => p.sector_id === sectorId && p.active && p.receives_new_tickets,
  );
  const principal = eligible.find((p) => p.is_primary_recipient) ?? null;
  const cc = eligible.filter((p) => p.is_cc && !p.is_primary_recipient);
  return { principal, cc };
}
