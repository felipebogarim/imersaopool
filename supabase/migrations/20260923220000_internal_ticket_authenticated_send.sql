-- Solicitações Internas — envio iniciado por usuário autenticado, sem service role.
--
-- O provider continua fora da transação PostgreSQL. Estas RPCs formam uma
-- interface estreita ao redor dele:
--   prepare: valida/autoriza, devolve somente o payload necessário e reivindica
--            uma tentativa com token e lease;
--   success: confirma outbox + ticket + evento na mesma transação;
--   failure: registra a falha na outbox sem invalidar/apagar o ticket.

ALTER TABLE public.internal_ticket_email_outbox
  ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS send_attempt_token uuid NULL,
  ADD COLUMN IF NOT EXISTS send_lease_expires_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.internal_ticket_prepare_send_authenticated(
  p_ticket_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_ticket public.internal_tickets;
  v_outbox public.internal_ticket_email_outbox;
  v_attempt_token uuid;
  v_message_id text;
  v_to jsonb;
  v_cc jsonb;
  v_sector_name text;
  v_category_name text;
  v_requester_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '28000';
  END IF;

  v_company_id := public.current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa ativa selecionada.' USING ERRCODE = '23514';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'comercial')
    OR public.has_role(v_user_id, 'gestor_comercial')
    OR public.has_role(v_user_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: seu papel não permite enviar solicitações.'
      USING ERRCODE = '42501';
  END IF;

  SELECT t.* INTO v_ticket
  FROM public.internal_tickets t
  WHERE t.id = p_ticket_id
    AND t.company_id = v_company_id
    AND public.internal_ticket_can_access(t.id, v_user_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket não encontrado ou acesso negado.' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    v_ticket.requester_user_id = v_user_id
    OR v_ticket.commercial_owner_user_id = v_user_id
    OR public.has_role(v_user_id, 'gestor_comercial')
    OR public.has_role(v_user_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não pode enviar este ticket.'
      USING ERRCODE = '42501';
  END IF;

  SELECT o.* INTO v_outbox
  FROM public.internal_ticket_email_outbox o
  WHERE o.ticket_id = v_ticket.id
    AND o.idempotency_key = 'ticket-opened:' || v_ticket.id
    AND o.direction = 'outbound'
    AND o.template_name = 'ticket-opened'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outbox de abertura não encontrada para o ticket.'
      USING ERRCODE = '23514';
  END IF;

  -- Retry idempotente: se o envio já foi confirmado, não reivindica nova
  -- tentativa. Repara o raro estado legado outbox sent + ticket aberto.
  IF v_outbox.status IN ('sent', 'delivered') THEN
    IF v_ticket.status = 'aberto' THEN
      UPDATE public.internal_tickets
      SET status = 'enviado', sent_at = COALESCE(sent_at, now())
      WHERE id = v_ticket.id;

      INSERT INTO public.internal_ticket_events (
        ticket_id, from_status, to_status, origin, author_user_id, observation
      ) VALUES (
        v_ticket.id, 'aberto', 'enviado', 'sistema', v_user_id,
        'Envio já confirmado pela outbox; estado do ticket reconciliado'
      );
    ELSIF v_ticket.status <> 'enviado' THEN
      RAISE EXCEPTION 'Estado inconsistente: outbox enviada para ticket em status %.', v_ticket.status;
    END IF;

    RETURN jsonb_build_object(
      'already_sent', true,
      'ticket_id', v_ticket.id,
      'ticket_number', v_ticket.ticket_number,
      'provider_message_id', v_outbox.provider_message_id,
      'message_id', v_outbox.message_id
    );
  END IF;

  IF v_ticket.status <> 'aberto' THEN
    RAISE EXCEPTION 'Ticket não está em Aberto (status atual: %).', v_ticket.status
      USING ERRCODE = '23514';
  END IF;

  IF v_outbox.send_attempt_token IS NOT NULL
     AND v_outbox.send_lease_expires_at > now() THEN
    RAISE EXCEPTION 'Já existe uma tentativa de envio em andamento para este ticket.'
      USING ERRCODE = '55000';
  END IF;

  SELECT COALESCE(jsonb_agg(r.email ORDER BY r.email), '[]'::jsonb)
  INTO v_to
  FROM public.internal_ticket_recipients r
  WHERE r.ticket_id = v_ticket.id AND r.role = 'principal';
  IF jsonb_array_length(v_to) = 0 THEN
    RAISE EXCEPTION 'Nenhum destinatário principal registrado para o ticket.'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(jsonb_agg(r.email ORDER BY r.email), '[]'::jsonb)
  INTO v_cc
  FROM public.internal_ticket_recipients r
  WHERE r.ticket_id = v_ticket.id AND r.role = 'copia';

  SELECT s.name INTO v_sector_name
  FROM public.internal_ticket_sectors s WHERE s.id = v_ticket.sector_id;
  SELECT c.name INTO v_category_name
  FROM public.internal_ticket_categories c WHERE c.id = v_ticket.category_id;
  SELECT COALESCE(p.full_name, p.email, 'Comercial') INTO v_requester_name
  FROM public.profiles p WHERE p.id = v_ticket.requester_user_id;

  v_attempt_token := gen_random_uuid();
  v_message_id := COALESCE(
    v_outbox.message_id,
    format('<%s@internal-tickets.local>', gen_random_uuid())
  );

  UPDATE public.internal_ticket_email_outbox
  SET send_attempt_token = v_attempt_token,
      send_lease_expires_at = now() + interval '5 minutes',
      attempt_count = attempt_count + 1,
      last_attempted_at = now(),
      error_message = NULL,
      message_id = v_message_id
  WHERE id = v_outbox.id;

  RETURN jsonb_build_object(
    'already_sent', false,
    'attempt_token', v_attempt_token,
    'idempotency_key', v_outbox.idempotency_key,
    'message_id', v_message_id,
    'ticket_id', v_ticket.id,
    'ticket_number', v_ticket.ticket_number,
    'title', v_ticket.title,
    'description', v_ticket.description,
    'priority', v_ticket.priority,
    'sla_first_response_due_at', v_ticket.sla_first_response_due_at,
    'sector_name', v_sector_name,
    'category_name', COALESCE(v_category_name, '—'),
    'requester_name', COALESCE(v_requester_name, 'Comercial'),
    'to', v_to,
    'cc', v_cc
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_ticket_mark_send_success_authenticated(
  p_ticket_id uuid,
  p_attempt_token uuid,
  p_provider_message_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_ticket public.internal_tickets;
  v_outbox public.internal_ticket_email_outbox;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '28000';
  END IF;

  v_company_id := public.current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa ativa selecionada.' USING ERRCODE = '23514';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'comercial')
    OR public.has_role(v_user_id, 'gestor_comercial')
    OR public.has_role(v_user_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: seu papel não permite enviar solicitações.'
      USING ERRCODE = '42501';
  END IF;

  SELECT t.* INTO v_ticket
  FROM public.internal_tickets t
  WHERE t.id = p_ticket_id
    AND t.company_id = v_company_id
    AND public.internal_ticket_can_access(t.id, v_user_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket não encontrado ou acesso negado.' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    v_ticket.requester_user_id = v_user_id
    OR v_ticket.commercial_owner_user_id = v_user_id
    OR public.has_role(v_user_id, 'gestor_comercial')
    OR public.has_role(v_user_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não pode enviar este ticket.'
      USING ERRCODE = '42501';
  END IF;

  SELECT o.* INTO v_outbox
  FROM public.internal_ticket_email_outbox o
  WHERE o.ticket_id = v_ticket.id
    AND o.idempotency_key = 'ticket-opened:' || v_ticket.id
    AND o.direction = 'outbound'
    AND o.template_name = 'ticket-opened'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outbox de abertura não encontrada para o ticket.'
      USING ERRCODE = '23514';
  END IF;

  IF v_outbox.status IN ('sent', 'delivered') AND v_ticket.status = 'enviado' THEN
    RETURN jsonb_build_object('ok', true, 'already_sent', true, 'ticket_id', v_ticket.id);
  END IF;
  IF v_ticket.status <> 'aberto' THEN
    RAISE EXCEPTION 'Ticket não está em Aberto (status atual: %).', v_ticket.status
      USING ERRCODE = '23514';
  END IF;
  IF p_attempt_token IS NULL OR v_outbox.send_attempt_token IS DISTINCT FROM p_attempt_token THEN
    RAISE EXCEPTION 'Tentativa de envio inválida ou expirada.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.internal_ticket_email_outbox
  SET status = 'sent',
      sent_at = COALESCE(sent_at, now()),
      provider_message_id = NULLIF(left(btrim(p_provider_message_id), 500), ''),
      error_message = NULL,
      send_attempt_token = NULL,
      send_lease_expires_at = NULL
  WHERE id = v_outbox.id;

  UPDATE public.internal_tickets
  SET status = 'enviado', sent_at = now()
  WHERE id = v_ticket.id;

  INSERT INTO public.internal_ticket_events (
    ticket_id, from_status, to_status, origin, author_user_id, observation
  ) VALUES (
    v_ticket.id, 'aberto', 'enviado', 'sistema', v_user_id,
    'E-mail de abertura enviado'
  );

  RETURN jsonb_build_object('ok', true, 'already_sent', false, 'ticket_id', v_ticket.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_ticket_mark_send_failure_authenticated(
  p_ticket_id uuid,
  p_attempt_token uuid,
  p_error_message text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_ticket public.internal_tickets;
  v_outbox public.internal_ticket_email_outbox;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '28000';
  END IF;

  v_company_id := public.current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa ativa selecionada.' USING ERRCODE = '23514';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'comercial')
    OR public.has_role(v_user_id, 'gestor_comercial')
    OR public.has_role(v_user_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: seu papel não permite enviar solicitações.'
      USING ERRCODE = '42501';
  END IF;

  SELECT t.* INTO v_ticket
  FROM public.internal_tickets t
  WHERE t.id = p_ticket_id
    AND t.company_id = v_company_id
    AND public.internal_ticket_can_access(t.id, v_user_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket não encontrado ou acesso negado.' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    v_ticket.requester_user_id = v_user_id
    OR v_ticket.commercial_owner_user_id = v_user_id
    OR public.has_role(v_user_id, 'gestor_comercial')
    OR public.has_role(v_user_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não pode enviar este ticket.'
      USING ERRCODE = '42501';
  END IF;

  SELECT o.* INTO v_outbox
  FROM public.internal_ticket_email_outbox o
  WHERE o.ticket_id = v_ticket.id
    AND o.idempotency_key = 'ticket-opened:' || v_ticket.id
    AND o.direction = 'outbound'
    AND o.template_name = 'ticket-opened'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outbox de abertura não encontrada para o ticket.'
      USING ERRCODE = '23514';
  END IF;

  -- Uma resposta tardia de falha nunca pode rebaixar um envio já confirmado.
  IF v_outbox.status IN ('sent', 'delivered') THEN
    RETURN jsonb_build_object('ok', true, 'already_sent', true, 'ticket_id', v_ticket.id);
  END IF;
  IF p_attempt_token IS NULL OR v_outbox.send_attempt_token IS DISTINCT FROM p_attempt_token THEN
    RAISE EXCEPTION 'Tentativa de envio inválida ou expirada.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.internal_ticket_email_outbox
  SET status = 'failed',
      error_message = left(COALESCE(NULLIF(btrim(p_error_message), ''), 'Falha sem detalhe'), 1000),
      send_attempt_token = NULL,
      send_lease_expires_at = NULL
  WHERE id = v_outbox.id;

  RETURN jsonb_build_object('ok', true, 'already_sent', false, 'ticket_id', v_ticket.id);
END;
$$;

REVOKE ALL ON FUNCTION public.internal_ticket_prepare_send_authenticated(uuid)
  FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_prepare_send_authenticated(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.internal_ticket_mark_send_success_authenticated(uuid, uuid, text)
  FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_mark_send_success_authenticated(uuid, uuid, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.internal_ticket_mark_send_failure_authenticated(uuid, uuid, text)
  FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_mark_send_failure_authenticated(uuid, uuid, text)
  TO authenticated;
