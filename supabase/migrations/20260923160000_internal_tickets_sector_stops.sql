-- Módulo "Solicitações Internas" — histórico de setor por ticket.
--
-- internal_tickets.sector_id continua sendo o setor ATUAL (cache, usado por
-- filtros/dashboard sem precisar de join). Esta tabela é o histórico: uma
-- linha por "parada" em um setor, com entered_at/left_at — left_at NULL
-- significa que o ticket ainda está lá. Permite responder "por onde passou,
-- quanto tempo ficou" sem inferir isso da linha de eventos (que mistura
-- status com movimentação de setor).

CREATE TABLE public.internal_ticket_sector_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.internal_tickets(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.internal_ticket_sectors(id),
  entered_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz NULL,
  moved_by uuid NULL REFERENCES public.profiles(id),
  reason text NULL
);

CREATE INDEX internal_ticket_sector_stops_ticket_id_idx ON public.internal_ticket_sector_stops (ticket_id);
-- No máximo uma parada aberta (left_at IS NULL) por ticket — garante que
-- "encaminhar" sempre fecha a anterior antes de abrir a próxima.
CREATE UNIQUE INDEX internal_ticket_sector_stops_one_open_idx
  ON public.internal_ticket_sector_stops (ticket_id)
  WHERE left_at IS NULL;

ALTER TABLE public.internal_ticket_sector_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_ticket_sector_stops_select ON public.internal_ticket_sector_stops
  FOR SELECT TO authenticated
  USING (public.internal_ticket_can_access(ticket_id, auth.uid()));

-- Sem policy de INSERT/UPDATE para authenticated: a movimentação sempre
-- passa por reassignInternalTicketSector (tickets.functions.ts), que grava
-- via service role — mesma razão da correção de segurança da Fase 10 pros
-- eventos/mensagens (evitar que qualquer usuário com acesso ao ticket forje
-- uma parada de setor com duração inventada).
