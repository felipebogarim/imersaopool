-- Registra o disparo inicial também no modelo canônico de mensagens, depois
-- que o provider e a outbox já confirmaram o envio.

CREATE OR REPLACE FUNCTION public.internal_ticket_record_opening_message_authenticated(
  p_ticket_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_outbox public.internal_ticket_email_outbox;
BEGIN
  IF v_user_id IS NULL OR NOT public.internal_ticket_can_access(p_ticket_id, v_user_id) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_outbox FROM public.internal_ticket_email_outbox
  WHERE ticket_id = p_ticket_id AND direction = 'outbound'
    AND template_name = 'ticket-opened'
    AND status IN ('sent', 'delivered')
  ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envio inicial confirmado não encontrado.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.internal_ticket_messages (
    ticket_id, direction, origin, author_user_id, sender_email, subject,
    outbox_id, message_id, to_emails, cc_emails, provider,
    provider_email_id, processing_status
  ) VALUES (
    p_ticket_id, 'outbound', 'sistema', v_user_id,
    COALESCE(v_outbox.sender_email, 'chamados@chamados.poolflux.app'),
    v_outbox.subject, v_outbox.id, v_outbox.message_id,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_outbox.raw_payload->'to', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_outbox.raw_payload->'cc', '[]'::jsonb))),
    v_outbox.provider, v_outbox.provider_message_id, 'processed'
  )
  ON CONFLICT (ticket_id, message_id) WHERE message_id IS NOT NULL DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_ticket_record_opening_message_authenticated(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_record_opening_message_authenticated(uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Consumo transacional dos dois magic links do solicitante. O lock do ticket
-- garante que Confirmar e Não resolvido não possam vencer simultaneamente.
CREATE OR REPLACE FUNCTION public.internal_ticket_apply_requester_validation(
  p_token_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token public.internal_ticket_action_tokens;
  v_ticket public.internal_tickets;
  v_target public.internal_ticket_status;
BEGIN
  SELECT * INTO v_token FROM public.internal_ticket_action_tokens
  WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023'; END IF;
  IF v_token.used_at IS NOT NULL THEN RAISE EXCEPTION 'Este link já foi usado' USING ERRCODE = '23514'; END IF;
  IF v_token.expires_at < now() THEN RAISE EXCEPTION 'Este link expirou' USING ERRCODE = '23514'; END IF;
  IF v_token.action NOT IN ('confirmar_conclusao', 'nao_resolvido') THEN
    RAISE EXCEPTION 'Ação incompatível com validação do solicitante' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_ticket FROM public.internal_tickets
  WHERE id = v_token.ticket_id FOR UPDATE;
  IF NOT FOUND OR v_token.intended_user_id IS DISTINCT FROM v_ticket.requester_user_id THEN
    RAISE EXCEPTION 'Este link não pertence ao solicitante deste ticket' USING ERRCODE = '42501';
  END IF;
  IF v_ticket.status <> 'aguardando_validacao' THEN
    RAISE EXCEPTION 'O ticket não está aguardando validação' USING ERRCODE = '23514';
  END IF;

  v_target := CASE WHEN v_token.action = 'confirmar_conclusao'
    THEN 'concluido'::public.internal_ticket_status
    ELSE 'reaberto'::public.internal_ticket_status END;

  UPDATE public.internal_ticket_action_tokens SET used_at = now()
  WHERE ticket_id = v_ticket.id AND action IN ('confirmar_conclusao', 'nao_resolvido')
    AND used_at IS NULL;

  UPDATE public.internal_tickets SET
    status = v_target,
    resolved_at = CASE WHEN v_target = 'concluido' THEN now() ELSE resolved_at END,
    reopened_at = CASE WHEN v_target = 'reaberto' THEN now() ELSE reopened_at END,
    reopen_count = reopen_count + CASE WHEN v_target = 'reaberto' THEN 1 ELSE 0 END
  WHERE id = v_ticket.id;

  INSERT INTO public.internal_ticket_events (
    ticket_id, from_status, to_status, origin, observation, metadata
  ) VALUES (
    v_ticket.id, v_ticket.status, v_target, 'acao_publica',
    CASE WHEN v_target = 'concluido' THEN 'Conclusão confirmada pelo solicitante'
         ELSE 'Solicitante informou que a demanda ainda não foi resolvida' END,
    jsonb_build_object('action_token_id', v_token.id)
  );

  RETURN jsonb_build_object('ok', true, 'ticket_number', v_ticket.ticket_number, 'status', v_target);
END;
$$;

REVOKE ALL ON FUNCTION public.internal_ticket_apply_requester_validation(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.internal_ticket_apply_requester_validation(text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
