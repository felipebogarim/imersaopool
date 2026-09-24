-- EMAIL-FIRST: operações atômicas do Receiving. Todas são exclusivas do
-- service_role; o cliente nunca escolhe identidade, destinatários ou ticket.

CREATE OR REPLACE FUNCTION public.internal_ticket_claim_webhook(
  p_provider_event_id text,
  p_event_type text,
  p_provider_email_id text,
  p_raw_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_lease uuid := gen_random_uuid();
  v_status text;
BEGIN
  IF btrim(COALESCE(p_provider_event_id, '')) = '' THEN
    RAISE EXCEPTION 'provider_event_id obrigatório' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.internal_ticket_webhook_events (
    provider, provider_event_id, event_type, provider_email_id, raw_payload
  ) VALUES ('resend', p_provider_event_id, p_event_type, p_provider_email_id, p_raw_payload)
  ON CONFLICT DO NOTHING;

  UPDATE public.internal_ticket_webhook_events
  SET status = 'processing', lease_token = v_lease,
      lease_expires_at = now() + interval '5 minutes',
      attempt_count = attempt_count + 1, error_message = NULL
  WHERE provider = 'resend'
    AND (
      provider_event_id = p_provider_event_id
      OR (p_event_type = 'email.received' AND p_provider_email_id IS NOT NULL
          AND provider_email_id = p_provider_email_id AND event_type = 'email.received')
    )
    AND (status IN ('pending', 'failed') OR (status = 'processing' AND lease_expires_at < now()))
  RETURNING id, status INTO v_id, v_status;

  IF v_id IS NULL THEN
    SELECT id, status INTO v_id, v_status
    FROM public.internal_ticket_webhook_events
    WHERE provider = 'resend'
      AND (provider_event_id = p_provider_event_id
        OR (p_event_type = 'email.received' AND p_provider_email_id IS NOT NULL
            AND provider_email_id = p_provider_email_id AND event_type = 'email.received'))
    ORDER BY received_at LIMIT 1;
    RETURN jsonb_build_object('claimed', false, 'event_id', v_id, 'status', v_status);
  END IF;

  RETURN jsonb_build_object('claimed', true, 'event_id', v_id, 'lease_token', v_lease);
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_ticket_fail_webhook(
  p_event_id uuid, p_lease_token uuid, p_error text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.internal_ticket_webhook_events
  SET status = 'failed', error_message = left(p_error, 1000),
      lease_token = NULL, lease_expires_at = NULL
  WHERE id = p_event_id AND lease_token = p_lease_token AND status = 'processing';
$$;

CREATE OR REPLACE FUNCTION public.internal_ticket_quarantine_webhook(
  p_event_id uuid, p_lease_token uuid, p_reason text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.internal_ticket_webhook_events
  SET status = 'quarantined', error_message = left(p_reason, 1000),
      processed_at = now(), lease_token = NULL, lease_expires_at = NULL
  WHERE id = p_event_id AND lease_token = p_lease_token AND status = 'processing';
$$;

CREATE OR REPLACE FUNCTION public.internal_ticket_process_inbound(
  p_event_id uuid,
  p_lease_token uuid,
  p_ticket_id uuid,
  p_provider_email_id text,
  p_message_id text,
  p_in_reply_to text,
  p_references text[],
  p_sender_email text,
  p_sender_name text,
  p_to text[],
  p_cc text[],
  p_direct_participants jsonb,
  p_subject text,
  p_text text,
  p_clean_text text,
  p_html_original text,
  p_html_sanitized text,
  p_headers jsonb,
  p_authentication jsonb,
  p_received_at timestamptz,
  p_quarantine_reason text,
  p_reply_domain text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event public.internal_ticket_webhook_events;
  v_ticket public.internal_tickets;
  v_message_id uuid;
  v_sender text := lower(btrim(p_sender_email));
  v_known boolean := false;
  v_sender_user_id uuid;
  v_is_primary boolean := false;
  v_first_response boolean := false;
  v_status public.internal_ticket_status;
  v_item jsonb;
  v_email text;
  v_relays jsonb;
  v_now timestamptz := COALESCE(p_received_at, now());
BEGIN
  SELECT * INTO v_event FROM public.internal_ticket_webhook_events
  WHERE id = p_event_id AND lease_token = p_lease_token AND status = 'processing'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('processed', false, 'duplicate', true);
  END IF;

  SELECT * INTO v_ticket FROM public.internal_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.internal_ticket_webhook_events
    SET status = 'quarantined', error_message = 'ticket_not_found', processed_at = now(),
        lease_token = NULL, lease_expires_at = NULL
    WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', true, 'quarantined', true, 'reason', 'ticket_not_found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.internal_ticket_participants p
    WHERE p.ticket_id = p_ticket_id AND p.email_normalized = v_sender
  ), (
    SELECT p.user_id FROM public.internal_ticket_participants p
    WHERE p.ticket_id = p_ticket_id AND p.email_normalized = v_sender
    ORDER BY p.is_current_primary DESC, p.is_requester DESC LIMIT 1
  ), EXISTS (
    SELECT 1 FROM public.internal_ticket_participants p
    WHERE p.ticket_id = p_ticket_id AND p.email_normalized = v_sender
      AND p.active AND p.is_current_primary
  ) INTO v_known, v_sender_user_id, v_is_primary;

  INSERT INTO public.internal_ticket_messages (
    ticket_id, direction, origin, author_user_id, sender_email, sender_name,
    subject, body_html, body_html_original, body_html_sanitized, body_text, clean_text,
    message_id, in_reply_to, reference_ids, to_emails, cc_emails,
    provider, provider_email_id, provider_event_id, raw_headers, authentication,
    received_at, processing_status, quarantine_reason
  ) VALUES (
    p_ticket_id, 'inbound', 'email', v_sender_user_id, p_sender_email, p_sender_name,
    p_subject, p_html_sanitized, p_html_original, p_html_sanitized, p_text, p_clean_text,
    NULLIF(btrim(p_message_id), ''), NULLIF(btrim(p_in_reply_to), ''), COALESCE(p_references, ARRAY[]::text[]),
    COALESCE(p_to, ARRAY[]::text[]), COALESCE(p_cc, ARRAY[]::text[]),
    'resend', p_provider_email_id, v_event.provider_event_id, COALESCE(p_headers, '{}'::jsonb),
    COALESCE(p_authentication, '{}'::jsonb), v_now,
    CASE WHEN NOT v_known OR p_quarantine_reason IS NOT NULL THEN 'quarantined' ELSE 'processed' END,
    COALESCE(p_quarantine_reason, CASE WHEN NOT v_known THEN 'unknown_sender' END)
  )
  ON CONFLICT (provider, provider_email_id) WHERE provider IS NOT NULL AND provider_email_id IS NOT NULL
  DO NOTHING RETURNING id INTO v_message_id;

  IF v_message_id IS NULL THEN
    UPDATE public.internal_ticket_webhook_events
    SET status = 'processed', processed_at = now(), lease_token = NULL, lease_expires_at = NULL
    WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'duplicate', true);
  END IF;

  IF NOT v_known OR p_quarantine_reason IS NOT NULL THEN
    UPDATE public.internal_ticket_webhook_events
    SET status = 'quarantined', processed_at = now(),
        error_message = COALESCE(p_quarantine_reason, 'unknown_sender'),
        lease_token = NULL, lease_expires_at = NULL
    WHERE id = p_event_id;
    INSERT INTO public.internal_ticket_events (ticket_id, origin, observation, metadata)
    VALUES (p_ticket_id, 'email', 'Mensagem inbound em quarentena',
      jsonb_build_object('message_id', v_message_id, 'reason', COALESCE(p_quarantine_reason, 'unknown_sender')));
    RETURN jsonb_build_object('processed', true, 'quarantined', true,
      'reason', COALESCE(p_quarantine_reason, 'unknown_sender'), 'message_id', v_message_id);
  END IF;

  UPDATE public.internal_ticket_participants
  SET last_seen_at = v_now
  WHERE ticket_id = p_ticket_id AND email_normalized = v_sender;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_direct_participants, '[]'::jsonb))
  LOOP
    v_email := lower(btrim(v_item->>'email'));
    IF v_email <> '' AND v_email <> v_sender THEN
      INSERT INTO public.internal_ticket_participants (
        ticket_id, email, display_name, source, role, active, automatic,
        added_by_email, first_seen_at, last_seen_at
      ) VALUES (
        p_ticket_id, v_email, NULLIF(btrim(v_item->>'name'), ''),
        CASE WHEN v_item->>'source' = 'email_to' THEN 'email_to' ELSE 'email_cc' END,
        'participant', true, false, true, v_now, v_now
      ) ON CONFLICT (ticket_id, email_normalized) DO UPDATE SET
        display_name = COALESCE(public.internal_ticket_participants.display_name, EXCLUDED.display_name),
        last_seen_at = GREATEST(public.internal_ticket_participants.last_seen_at, EXCLUDED.last_seen_at),
        added_by_email = true,
        active = true;
    END IF;
  END LOOP;

  IF v_is_primary AND v_ticket.first_response_at IS NULL THEN
    v_first_response := true;
    v_status := CASE WHEN v_ticket.status IN ('enviado', 'recebido_pelo_setor')
                     THEN 'em_analise' ELSE v_ticket.status END;
  ELSE
    v_status := v_ticket.status;
  END IF;

  UPDATE public.internal_tickets SET
    status = v_status,
    first_response_at = CASE WHEN v_first_response THEN v_now ELSE first_response_at END,
    first_response_by = CASE WHEN v_first_response THEN v_sender_user_id ELSE first_response_by END,
    first_response_by_email = CASE WHEN v_first_response THEN v_sender ELSE first_response_by_email END,
    first_response_sla_met = CASE WHEN v_first_response THEN
      (sla_first_response_due_at IS NULL OR v_now <= sla_first_response_due_at)
      ELSE first_response_sla_met END,
    last_activity_at = v_now,
    last_activity_by = v_sender_user_id,
    last_activity_by_email = v_sender,
    last_message_id = v_message_id
  WHERE id = p_ticket_id;

  INSERT INTO public.internal_ticket_events (
    ticket_id, from_status, to_status, origin, author_user_id, observation, metadata
  ) VALUES (
    p_ticket_id,
    CASE WHEN v_status IS DISTINCT FROM v_ticket.status THEN v_ticket.status ELSE NULL END,
    CASE WHEN v_status IS DISTINCT FROM v_ticket.status THEN v_status ELSE NULL END,
    'email', v_sender_user_id, 'Resposta recebida por e-mail de ' || p_sender_email,
    jsonb_build_object('message_id', v_message_id, 'first_response', v_first_response)
  );

  INSERT INTO public.internal_ticket_relay_deliveries (
    ticket_id, source_message_id, target_email, idempotency_key, message_id
  )
  SELECT p_ticket_id, v_message_id, participant.email,
         'ticket-relay:' || v_message_id || ':' || participant.email_normalized,
         '<' || gen_random_uuid() || '@' || lower(btrim(p_reply_domain)) || '>'
  FROM public.internal_ticket_participants participant
  WHERE participant.ticket_id = p_ticket_id AND participant.active
    AND participant.email_normalized <> v_sender
  ON CONFLICT (source_message_id, target_email_normalized) DO NOTHING;

  -- A expressão acima não é usada para exclusão final porque direct_participants
  -- é um array de objetos. Remove defensivamente qualquer relay para destinatário direto.
  DELETE FROM public.internal_ticket_relay_deliveries relay
  USING jsonb_array_elements(COALESCE(p_direct_participants, '[]'::jsonb)) direct
  WHERE relay.source_message_id = v_message_id
    AND relay.target_email_normalized = lower(btrim(direct->>'email'));

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', relay.id, 'target_email', relay.target_email,
    'idempotency_key', relay.idempotency_key, 'message_id', relay.message_id
  ) ORDER BY relay.target_email_normalized), '[]'::jsonb)
  INTO v_relays FROM public.internal_ticket_relay_deliveries relay
  WHERE relay.source_message_id = v_message_id;

  UPDATE public.internal_ticket_webhook_events
  SET status = 'processed', processed_at = now(), lease_token = NULL, lease_expires_at = NULL
  WHERE id = p_event_id;

  RETURN jsonb_build_object('processed', true, 'quarantined', false,
    'message_id', v_message_id, 'first_response', v_first_response, 'relays', v_relays);
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_ticket_claim_relay(p_relay_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.internal_ticket_relay_deliveries; v_lease uuid := gen_random_uuid();
BEGIN
  -- O Resend preserva a idempotency key por 24 horas. Depois de 23 horas a
  -- entrega fica para reconciliação manual: reenviar automaticamente já não
  -- oferece garantia contra duplicidade após um crash de resultado ambíguo.
  UPDATE public.internal_ticket_relay_deliveries
  SET status = 'failed', last_error = 'provider_reconciliation_required',
      lease_token = NULL, lease_expires_at = NULL
  WHERE id = p_relay_id AND status <> 'sent' AND status <> 'delivered'
    AND first_attempt_at IS NOT NULL
    AND first_attempt_at <= now() - interval '23 hours';

  UPDATE public.internal_ticket_relay_deliveries
  SET status = 'sending', lease_token = v_lease, lease_expires_at = now() + interval '5 minutes',
      attempt_count = attempt_count + 1, first_attempt_at = COALESCE(first_attempt_at, now()),
      last_error = NULL
  WHERE id = p_relay_id
    AND (first_attempt_at IS NULL OR first_attempt_at > now() - interval '23 hours')
    AND (status IN ('pending', 'failed') OR (status = 'sending' AND lease_expires_at < now()))
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', COALESCE((
        SELECT CASE WHEN last_error = 'provider_reconciliation_required'
          THEN 'provider_reconciliation_required' ELSE 'busy_or_finished' END
        FROM public.internal_ticket_relay_deliveries WHERE id = p_relay_id
      ), 'not_found')
    );
  END IF;
  RETURN jsonb_build_object('claimed', true, 'lease_token', v_lease,
    'target_email', v_row.target_email, 'idempotency_key', v_row.idempotency_key,
    'message_id', v_row.message_id, 'source_message_id', v_row.source_message_id,
    'ticket_id', v_row.ticket_id);
END; $$;

CREATE OR REPLACE FUNCTION public.internal_ticket_finish_relay(
  p_relay_id uuid, p_lease_token uuid, p_provider_message_id text, p_error text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.internal_ticket_relay_deliveries;
BEGIN
  UPDATE public.internal_ticket_relay_deliveries SET
    status = CASE WHEN p_error IS NULL THEN 'sent' ELSE 'failed' END,
    provider_message_id = CASE WHEN p_error IS NULL THEN p_provider_message_id ELSE provider_message_id END,
    sent_at = CASE WHEN p_error IS NULL THEN now() ELSE sent_at END,
    last_error = CASE WHEN p_error IS NULL THEN NULL ELSE left(p_error, 1000) END,
    lease_token = NULL, lease_expires_at = NULL
  WHERE id = p_relay_id AND lease_token = p_lease_token AND status = 'sending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('finished', false, 'reason', 'stale_lease');
  END IF;

  SELECT * INTO v_row FROM public.internal_ticket_relay_deliveries WHERE id = p_relay_id;

  IF p_error IS NULL THEN
    INSERT INTO public.internal_ticket_messages (
      ticket_id, direction, origin, sender_email, subject, body_html, body_text,
      message_id, in_reply_to, reference_ids, to_emails, provider,
      provider_email_id, processing_status, relay_parent_message_id
    )
    SELECT r.ticket_id, 'outbound', 'sistema', NULL,
      source.subject, source.body_html_sanitized, source.body_text,
      r.message_id, source.message_id,
      array_append(COALESCE(source.reference_ids, ARRAY[]::text[]), source.message_id),
      ARRAY[r.target_email], 'resend', p_provider_message_id, 'processed', source.id
    FROM public.internal_ticket_relay_deliveries r
    JOIN public.internal_ticket_messages source ON source.id = r.source_message_id
    WHERE r.id = p_relay_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object(
    'finished', true,
    'status', CASE WHEN p_error IS NULL THEN 'sent' ELSE 'failed' END,
    'relay_id', v_row.id
  );
END; $$;

-- Mudança manual de status sem liberar UPDATE direto nas colunas operacionais.
CREATE OR REPLACE FUNCTION public.internal_ticket_update_status_authenticated(
  p_ticket_id uuid,
  p_to_status public.internal_ticket_status,
  p_observation text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ticket public.internal_tickets;
  v_allowed boolean := false;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_ticket FROM public.internal_tickets
  WHERE id = p_ticket_id AND company_id = public.current_company_id() FOR UPDATE;
  IF NOT FOUND OR NOT (
    v_ticket.requester_user_id = v_user_id
    OR v_ticket.commercial_owner_user_id = v_user_id
    OR public.has_role(v_user_id, 'gestor_comercial')
    OR public.has_role(v_user_id, 'admin')
  ) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501'; END IF;

  v_allowed := CASE v_ticket.status
    WHEN 'rascunho' THEN p_to_status IN ('aberto', 'cancelado')
    WHEN 'aberto' THEN p_to_status IN ('enviado', 'cancelado')
    WHEN 'enviado' THEN p_to_status IN ('recebido_pelo_setor', 'cancelado')
    WHEN 'recebido_pelo_setor' THEN p_to_status IN ('em_analise', 'cancelado')
    WHEN 'em_analise' THEN p_to_status IN ('aguardando_info_comercial', 'respondido', 'aguardando_validacao', 'cancelado')
    WHEN 'aguardando_info_comercial' THEN p_to_status IN ('em_analise', 'cancelado')
    WHEN 'respondido' THEN p_to_status IN ('em_analise', 'aguardando_validacao', 'cancelado')
    WHEN 'aguardando_validacao' THEN p_to_status IN ('concluido', 'reaberto', 'cancelado')
    WHEN 'concluido' THEN p_to_status IN ('reaberto', 'cancelado')
    WHEN 'reaberto' THEN p_to_status IN ('em_analise', 'aguardando_validacao', 'cancelado')
    ELSE false
  END;
  IF NOT v_allowed THEN RAISE EXCEPTION 'Transição de status inválida' USING ERRCODE = '23514'; END IF;

  UPDATE public.internal_tickets SET
    status = p_to_status,
    received_by_sector_at = CASE WHEN p_to_status = 'recebido_pelo_setor' THEN now() ELSE received_by_sector_at END,
    resolution_proposed_at = CASE WHEN p_to_status = 'aguardando_validacao' THEN now() ELSE resolution_proposed_at END,
    validation_started_at = CASE WHEN p_to_status = 'aguardando_validacao' THEN now() ELSE validation_started_at END,
    resolved_at = CASE WHEN p_to_status = 'concluido' THEN now() ELSE resolved_at END,
    reopened_at = CASE WHEN p_to_status = 'reaberto' THEN now() ELSE reopened_at END,
    reopen_count = reopen_count + CASE WHEN p_to_status = 'reaberto' THEN 1 ELSE 0 END,
    cancelled_at = CASE WHEN p_to_status = 'cancelado' THEN now() ELSE cancelled_at END
  WHERE id = p_ticket_id;

  INSERT INTO public.internal_ticket_events (
    ticket_id, from_status, to_status, origin, author_user_id, observation
  ) VALUES (p_ticket_id, v_ticket.status, p_to_status, 'comercial', v_user_id, left(p_observation, 2000));
  RETURN jsonb_build_object('ok', true, 'status', p_to_status);
END; $$;

-- Reatribuição completa: cache do setor, participantes automáticos, parada
-- histórica e evento são confirmados na mesma transação.
CREATE OR REPLACE FUNCTION public.internal_ticket_reassign_authenticated(
  p_ticket_id uuid,
  p_to_sector_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ticket public.internal_tickets;
  v_from_name text;
  v_to_name text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_ticket FROM public.internal_tickets
  WHERE id = p_ticket_id AND company_id = public.current_company_id() FOR UPDATE;
  IF NOT FOUND OR NOT (
    v_ticket.requester_user_id = v_user_id
    OR v_ticket.commercial_owner_user_id = v_user_id
    OR public.has_role(v_user_id, 'gestor_comercial')
    OR public.has_role(v_user_id, 'admin')
  ) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501'; END IF;
  IF v_ticket.sector_id = p_to_sector_id THEN
    RAISE EXCEPTION 'O ticket já está neste setor' USING ERRCODE = '23514';
  END IF;
  SELECT name INTO v_from_name FROM public.internal_ticket_sectors WHERE id = v_ticket.sector_id;
  SELECT name INTO v_to_name FROM public.internal_ticket_sectors
  WHERE id = p_to_sector_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Setor de destino inválido ou inativo' USING ERRCODE = '23514'; END IF;

  UPDATE public.internal_tickets SET sector_id = p_to_sector_id WHERE id = p_ticket_id;
  PERFORM public.internal_ticket_sync_sector_participants(p_ticket_id, p_to_sector_id);
  UPDATE public.internal_ticket_sector_stops SET left_at = now()
  WHERE ticket_id = p_ticket_id AND left_at IS NULL;
  INSERT INTO public.internal_ticket_sector_stops (ticket_id, sector_id, moved_by, reason)
  VALUES (p_ticket_id, p_to_sector_id, v_user_id, left(p_reason, 500));
  INSERT INTO public.internal_ticket_events (
    ticket_id, origin, author_user_id, observation
  ) VALUES (
    p_ticket_id, 'comercial', v_user_id,
    'Encaminhado de ' || COALESCE(v_from_name, '—') || ' para ' || v_to_name ||
      CASE WHEN NULLIF(btrim(p_reason), '') IS NULL THEN '' ELSE ': ' || left(btrim(p_reason), 500) END
  );
  RETURN jsonb_build_object('ok', true, 'sector_id', p_to_sector_id);
END; $$;

CREATE OR REPLACE FUNCTION public.internal_ticket_sync_sector_participants(
  p_ticket_id uuid, p_sector_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.internal_tickets WHERE id = p_ticket_id AND sector_id = p_sector_id) THEN
    RAISE EXCEPTION 'Ticket/setor inválido para sincronização' USING ERRCODE = '23514';
  END IF;

  UPDATE public.internal_ticket_participants SET is_current_primary = false
  WHERE ticket_id = p_ticket_id AND automatic AND NOT is_requester
    AND source IN ('primary_recipient', 'configured_cc');

  UPDATE public.internal_ticket_participants SET active = false
  WHERE ticket_id = p_ticket_id AND automatic AND NOT is_requester
    AND NOT added_by_email AND source IN ('primary_recipient', 'configured_cc');

  INSERT INTO public.internal_ticket_participants (
    ticket_id, email, display_name, source, role, active, automatic,
    is_current_primary, is_configured_recipient
  )
  SELECT p_ticket_id, sp.email, sp.name,
    CASE WHEN sp.is_primary_recipient THEN 'primary_recipient' ELSE 'configured_cc' END,
    CASE WHEN sp.is_primary_recipient THEN 'primary' ELSE 'cc' END,
    true, true, sp.is_primary_recipient, true
  FROM public.internal_ticket_sector_people sp
  WHERE sp.sector_id = p_sector_id AND sp.active AND sp.receives_new_tickets
    AND (sp.is_primary_recipient OR sp.is_cc)
  ON CONFLICT (ticket_id, email_normalized) DO UPDATE SET
    display_name = EXCLUDED.display_name, source = EXCLUDED.source, role = EXCLUDED.role,
    active = true, automatic = true, is_current_primary = EXCLUDED.is_current_primary,
    is_configured_recipient = true, last_seen_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.internal_ticket_seed_participants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'internal_tickets' THEN
    INSERT INTO public.internal_ticket_participants (
      ticket_id, email, display_name, user_id, source, role, automatic, is_requester
    )
    SELECT NEW.id, COALESCE(NULLIF(btrim(p.email), ''), NULLIF(btrim(u.email), '')),
      COALESCE(NULLIF(btrim(p.full_name), ''), NULLIF(btrim(p.email), ''), NULLIF(btrim(u.email), '')),
      NEW.requester_user_id, 'requester', 'requester', true, true
    FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.id = NEW.requester_user_id
      AND COALESCE(NULLIF(btrim(p.email), ''), NULLIF(btrim(u.email), '')) IS NOT NULL
    ON CONFLICT (ticket_id, email_normalized) DO UPDATE SET is_requester = true, active = true;
  ELSE
    INSERT INTO public.internal_ticket_participants (
      ticket_id, email, display_name, source, role, automatic,
      is_current_primary, is_configured_recipient
    ) VALUES (
      NEW.ticket_id, NEW.email, NEW.name_snapshot,
      CASE WHEN NEW.role = 'principal' THEN 'primary_recipient' ELSE 'configured_cc' END,
      CASE WHEN NEW.role = 'principal' THEN 'primary' ELSE 'cc' END,
      true, NEW.role = 'principal', true
    ) ON CONFLICT (ticket_id, email_normalized) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, public.internal_ticket_participants.display_name),
      active = true,
      is_current_primary = public.internal_ticket_participants.is_current_primary OR EXCLUDED.is_current_primary,
      is_configured_recipient = true;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_internal_tickets_seed_requester_participant
  AFTER INSERT ON public.internal_tickets FOR EACH ROW
  EXECUTE FUNCTION public.internal_ticket_seed_participants();
CREATE TRIGGER trg_internal_ticket_recipients_seed_participant
  AFTER INSERT ON public.internal_ticket_recipients FOR EACH ROW
  EXECUTE FUNCTION public.internal_ticket_seed_participants();

REVOKE ALL ON FUNCTION public.internal_ticket_claim_webhook(text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.internal_ticket_fail_webhook(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.internal_ticket_quarantine_webhook(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.internal_ticket_process_inbound(uuid,uuid,uuid,text,text,text,text[],text,text,text[],text[],jsonb,text,text,text,text,text,jsonb,jsonb,timestamptz,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.internal_ticket_claim_relay(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.internal_ticket_finish_relay(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.internal_ticket_sync_sector_participants(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.internal_ticket_seed_participants() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.internal_ticket_update_status_authenticated(uuid,public.internal_ticket_status,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.internal_ticket_reassign_authenticated(uuid,uuid,text) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.internal_ticket_claim_webhook(text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_fail_webhook(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_quarantine_webhook(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_process_inbound(uuid,uuid,uuid,text,text,text,text[],text,text,text[],text[],jsonb,text,text,text,text,text,jsonb,jsonb,timestamptz,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_claim_relay(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_finish_relay(uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_sync_sector_participants(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_update_status_authenticated(uuid,public.internal_ticket_status,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.internal_ticket_reassign_authenticated(uuid,uuid,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
