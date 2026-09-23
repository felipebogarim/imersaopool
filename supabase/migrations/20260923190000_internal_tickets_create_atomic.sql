-- Módulo "Solicitações Internas" — criação local atômica do ticket.
--
-- Antes: createInternalTicket fazia ticket → evento → sector_stop → produtos em
-- chamadas independentes (sem transação) e sendInternalTicket gravava os
-- recipients depois do e-mail. Qualquer falha no meio deixava um ticket
-- parcial "Aberto" na lista.
--
-- Agora: esta função grava TUDO o que é obrigatório localmente numa única
-- transação (corpo de função plpgsql = uma transação; qualquer RAISE/erro dá
-- rollback de tudo):
--   ticket → produtos → sector_stop inicial → recipients (snapshot) →
--   evento inicial → outbox 'pending'
-- A chamada ao provedor de e-mail NÃO faz parte disto (é feita depois do commit).
--
-- Dependências (já aplicadas): migrations 090100 (core), 080000 (outbox),
-- 160000 (sector_stops), 170000 (products), 180000 (principal único).
-- Execução: somente service_role — o servidor valida papel/empresa/entradas
-- com o cliente do usuário antes de chamar, e passa p_user_id já autenticado.

CREATE OR REPLACE FUNCTION public.internal_ticket_create_atomic(
  p_user_id uuid,
  p_company_id uuid,
  p_title text,
  p_description text,
  p_client_id uuid,
  p_category_id uuid,
  p_sector_id uuid,
  p_commercial_owner_user_id uuid,
  p_priority public.internal_ticket_priority,
  p_product_ids uuid[],
  p_sla_first_response_minutes integer,
  p_sla_resolution_minutes integer,
  p_sla_first_response_due_at timestamptz,
  p_sla_resolution_due_at timestamptz,
  p_outbox_idempotency_key_prefix text,
  p_outbox_sender text,
  p_outbox_message_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.internal_tickets;
  v_to jsonb;
  v_cc jsonb;
  v_all_emails text;
BEGIN
  -- Destinatários efetivos (mesma regra de src/lib/internal-tickets/recipients.ts).
  IF NOT EXISTS (
    SELECT 1 FROM public.internal_ticket_sector_people
    WHERE sector_id = p_sector_id AND active AND receives_new_tickets AND is_primary_recipient
  ) THEN
    RAISE EXCEPTION 'Este setor não possui um destinatário principal configurado para receber novos tickets.';
  END IF;

  INSERT INTO public.internal_tickets (
    company_id, title, description, client_id, category_id, sector_id,
    requester_user_id, commercial_owner_user_id, priority, status,
    sla_first_response_minutes, sla_resolution_minutes,
    sla_first_response_due_at, sla_resolution_due_at
  ) VALUES (
    p_company_id, p_title, p_description, p_client_id, p_category_id, p_sector_id,
    p_user_id, COALESCE(p_commercial_owner_user_id, p_user_id), p_priority, 'aberto',
    p_sla_first_response_minutes, p_sla_resolution_minutes,
    p_sla_first_response_due_at, p_sla_resolution_due_at
  ) RETURNING * INTO v_ticket;

  IF COALESCE(array_length(p_product_ids, 1), 0) > 0 THEN
    INSERT INTO public.internal_ticket_products (ticket_id, product_id)
    SELECT v_ticket.id, ids.product_id
    FROM (SELECT DISTINCT unnest(p_product_ids) AS product_id) AS ids;
  END IF;

  INSERT INTO public.internal_ticket_sector_stops (ticket_id, sector_id, moved_by)
  VALUES (v_ticket.id, p_sector_id, p_user_id);

  INSERT INTO public.internal_ticket_recipients (ticket_id, sector_person_id, email, name_snapshot, role)
  SELECT v_ticket.id, sp.id, sp.email, sp.name,
         CASE WHEN sp.is_primary_recipient THEN 'principal'::public.internal_ticket_recipient_role
              ELSE 'copia'::public.internal_ticket_recipient_role END
  FROM public.internal_ticket_sector_people sp
  WHERE sp.sector_id = p_sector_id AND sp.active AND sp.receives_new_tickets
    AND (sp.is_primary_recipient OR sp.is_cc);

  INSERT INTO public.internal_ticket_events (ticket_id, from_status, to_status, origin, author_user_id, observation)
  VALUES (v_ticket.id, NULL, 'aberto', 'comercial', p_user_id, 'Ticket criado');

  SELECT COALESCE(jsonb_agg(email), '[]'::jsonb) INTO v_to
    FROM public.internal_ticket_recipients WHERE ticket_id = v_ticket.id AND role = 'principal';
  SELECT COALESCE(jsonb_agg(email), '[]'::jsonb) INTO v_cc
    FROM public.internal_ticket_recipients WHERE ticket_id = v_ticket.id AND role = 'copia';
  SELECT string_agg(email, ', ' ORDER BY role, email) INTO v_all_emails
    FROM public.internal_ticket_recipients WHERE ticket_id = v_ticket.id;

  INSERT INTO public.internal_ticket_email_outbox (
    idempotency_key, direction, ticket_id, template_name,
    recipient_email, sender_email, subject, message_id, status, raw_payload
  ) VALUES (
    p_outbox_idempotency_key_prefix || v_ticket.id, 'outbound', v_ticket.id, 'ticket-opened',
    v_all_emails, p_outbox_sender, '[' || v_ticket.ticket_number || '] ' || v_ticket.title,
    p_outbox_message_id, 'pending',
    jsonb_build_object('to', v_to, 'cc', v_cc)
  );

  RETURN jsonb_build_object('ticket', to_jsonb(v_ticket), 'to', v_to, 'cc', v_cc);
END;
$$;

REVOKE ALL ON FUNCTION public.internal_ticket_create_atomic(
  uuid, uuid, text, text, uuid, uuid, uuid, uuid, public.internal_ticket_priority, uuid[],
  integer, integer, timestamptz, timestamptz, text, text, text
) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.internal_ticket_create_atomic(
  uuid, uuid, text, text, uuid, uuid, uuid, uuid, public.internal_ticket_priority, uuid[],
  integer, integer, timestamptz, timestamptz, text, text, text
) TO service_role;
