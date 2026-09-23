-- Módulo "Solicitações Internas" — Fase 10: revisão de segurança.
--
-- Achado: as policies de INSERT de internal_ticket_events e
-- internal_ticket_messages (migration 20260923090100) só checavam
-- internal_ticket_can_access(ticket_id) — qualquer usuário com acesso de
-- leitura/escrita ao ticket podia inserir uma linha com QUALQUER origin
-- (ex.: origin='email' fingindo ser uma resposta inbound real, ou
-- to_status='concluido' sem o ticket de fato ter mudado de status — o
-- INSERT na tabela de eventos não altera internal_tickets.status, só
-- forjaria a timeline). Todo o código deste módulo que insere evento/
-- mensagem pelo caminho autenticado sempre usa origin='comercial'
-- (eventos) ou origin IN ('manual_presencial','manual_telefone')
-- (mensagens) com author_user_id = auth.uid() — os origins 'sistema'/
-- 'email'/'acao_publica' só são gravados via service_role (supabaseAdmin),
-- que ignora RLS. Portanto essa restrição não quebra nenhum fluxo legítimo.

DROP POLICY IF EXISTS internal_ticket_events_insert ON public.internal_ticket_events;
CREATE POLICY internal_ticket_events_insert
  ON public.internal_ticket_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.internal_ticket_can_access(ticket_id, auth.uid())
    AND origin = 'comercial'
    AND author_user_id = auth.uid()
  );

DROP POLICY IF EXISTS internal_ticket_messages_insert ON public.internal_ticket_messages;
CREATE POLICY internal_ticket_messages_insert
  ON public.internal_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.internal_ticket_can_access(ticket_id, auth.uid())
    AND origin IN ('manual_presencial', 'manual_telefone')
    AND direction = 'inbound'
    AND author_user_id = auth.uid()
  );

-- Mesmo raciocínio pros anexos: exigir que quem sobe o arquivo seja quem
-- assina a linha (evita um usuário com acesso ao ticket criar uma linha de
-- anexo atribuída a outra pessoa).
DROP POLICY IF EXISTS internal_ticket_attachments_insert ON public.internal_ticket_attachments;
CREATE POLICY internal_ticket_attachments_insert
  ON public.internal_ticket_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.internal_ticket_can_access(ticket_id, auth.uid())
    AND uploaded_by = auth.uid()
  );
