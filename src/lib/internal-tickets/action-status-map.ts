import type { TicketAction } from "./action-tokens";
import type { TicketStatus } from "./status";

/** Status que cada uma das 5 ações públicas do e-mail leva o ticket a atingir. */
export const ACTION_TARGET_STATUS: Record<TicketAction, TicketStatus> = {
  confirmar_recebimento: "recebido_pelo_setor",
  marcar_em_analise: "em_analise",
  solicitar_informacao: "aguardando_info_comercial",
  responder: "respondido",
  marcar_concluido: "aguardando_validacao",
  indicar_conclusao: "aguardando_validacao",
  confirmar_conclusao: "concluido",
  nao_resolvido: "reaberto",
};
