/**
 * Máquina de status do ticket. Espelha o enum internal_ticket_status do banco
 * (migration 20260923090100) — os dois precisam evoluir juntos.
 */

export const TICKET_STATUSES = [
  "rascunho",
  "aberto",
  "enviado",
  "recebido_pelo_setor",
  "em_analise",
  "aguardando_info_comercial",
  "respondido",
  "concluido",
  "cancelado",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  rascunho: "Rascunho",
  aberto: "Aberto",
  enviado: "Enviado",
  recebido_pelo_setor: "Recebido pelo setor",
  em_analise: "Em análise",
  aguardando_info_comercial: "Aguardando informações do Comercial",
  respondido: "Respondido",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

// done (concluido) permite reabertura para em_analise — por isso não é um
// estado sem saída, mesmo sendo considerado "terminal" para fins de lembrete.
const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  rascunho: ["aberto", "cancelado"],
  aberto: ["enviado", "cancelado"],
  enviado: ["recebido_pelo_setor", "cancelado"],
  recebido_pelo_setor: ["em_analise", "cancelado"],
  em_analise: ["aguardando_info_comercial", "respondido", "concluido", "cancelado"],
  aguardando_info_comercial: ["em_analise", "cancelado"],
  respondido: ["em_analise", "concluido", "cancelado"],
  concluido: ["em_analise", "cancelado"], // reabertura
  cancelado: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

export function allowedNextStatuses(from: TicketStatus): readonly TicketStatus[] {
  return TRANSITIONS[from];
}

/** Concluído ou cancelado: ponto em que lembretes/escalonamentos devem parar. */
export function isTerminalStatus(status: TicketStatus): boolean {
  return status === "concluido" || status === "cancelado";
}

/**
 * As ações públicas do e-mail (Fase 4b) são botões independentes — quem
 * recebe pode clicar "Marcar em análise" sem antes ter clicado "Confirmar
 * recebimento". canReach() permite o pulo (BFS pelo grafo de transições) sem
 * exigir que cada hop intermediário seja aplicado/logado separadamente;
 * canTransition() continua sendo a regra estrita para transições diretas.
 */
export function canReach(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return false;
  const visited = new Set<TicketStatus>([from]);
  const queue: TicketStatus[] = [from];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of TRANSITIONS[current]) {
      if (next === to) return true;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/**
 * Campos de timestamp que a chegada a um status deve preencher (snapshot do
 * "primeiro" momento — sobrescreve em reaberturas, semântica aceita como
 * simplificação do MVP; ver PROJECT_BRAIN). Compartilhado entre as ações
 * públicas do e-mail e a mudança manual de status na tela de Detalhe.
 */
export function timestampFieldsForStatus(
  status: TicketStatus,
  now: Date = new Date(),
): Record<string, string> {
  const iso = now.toISOString();
  if (status === "recebido_pelo_setor") return { received_by_sector_at: iso };
  if (status === "respondido") return { first_response_at: iso };
  if (status === "concluido") return { resolved_at: iso };
  return {};
}
