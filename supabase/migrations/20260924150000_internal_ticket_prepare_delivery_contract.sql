-- Solicitações Internas — consolida o contrato server-side do envio inicial.
-- Depende da migration 20260924140000, que preserva a implementação original
-- como internal_ticket_prepare_send_authenticated_base(uuid).

CREATE OR REPLACE FUNCTION public.internal_ticket_prepare_send_authenticated(
  p_ticket_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
  v_requester_email text;
  v_requester_name text;
  v_recipient_name text;
  v_cc jsonb;
  v_all_emails text;
BEGIN
  -- A base preserva auth.uid(), tenant, papéis, acesso, estado, idempotência,
  -- outbox e lease. Nenhuma identidade de entrega vem do frontend.
  v_payload := public.internal_ticket_prepare_send_authenticated_base(p_ticket_id);

  IF COALESCE((v_payload->>'already_sent')::boolean, false) THEN
    RETURN v_payload;
  END IF;

  -- profiles.email é a fonte preferencial do e-mail corporativo cadastrado na
  -- plataforma. auth.users.email serve como fallback.
  SELECT
    COALESCE(NULLIF(btrim(p.email), ''), NULLIF(btrim(u.email), '')),
    COALESCE(
      NULLIF(btrim(p.full_name), ''),
      NULLIF(btrim(u.email), ''),
      NULLIF(btrim(p.email), ''),
      'Comercial'
    )
  INTO v_requester_email, v_requester_name
  FROM public.internal_tickets t
  LEFT JOIN auth.users u ON u.id = t.requester_user_id
  LEFT JOIN public.profiles p ON p.id = t.requester_user_id
  WHERE t.id = p_ticket_id;

  IF v_requester_email IS NULL THEN
    RAISE EXCEPTION
      'E-mail corporativo do solicitante não cadastrado na conta de autenticação nem em profiles.email.'
      USING ERRCODE = '23514';
  END IF;

  -- O nome é o snapshot histórico do destinatário principal no momento da
  -- criação do ticket, não a configuração atual do setor.
  SELECT NULLIF(btrim(r.name_snapshot), '')
  INTO v_recipient_name
  FROM public.internal_ticket_recipients r
  WHERE r.ticket_id = p_ticket_id
    AND r.role = 'principal'
  ORDER BY r.created_at, r.id
  LIMIT 1;

  IF v_recipient_name IS NULL THEN
    RAISE EXCEPTION
      'Nome do destinatário principal não encontrado no snapshot do ticket.'
      USING ERRCODE = '23514';
  END IF;

  -- CC final = cópias persistidas no ticket + solicitante. A consolidação é
  -- case-insensitive e remove qualquer endereço que já esteja em TO.
  SELECT COALESCE(jsonb_agg(d.email ORDER BY d.email), '[]'::jsonb)
  INTO v_cc
  FROM (
    SELECT min(btrim(source.email)) AS email
    FROM (
      SELECT value AS email
      FROM jsonb_array_elements_text(COALESCE(v_payload->'cc', '[]'::jsonb))
      UNION ALL
      SELECT v_requester_email
    ) source
    WHERE NULLIF(btrim(source.email), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(v_payload->'to', '[]'::jsonb)) recipient
        WHERE lower(btrim(recipient.value)) = lower(btrim(source.email))
      )
    GROUP BY lower(btrim(source.email))
  ) d;

  v_payload := jsonb_set(v_payload, '{cc}', v_cc, true)
    || jsonb_build_object(
      'requester_name', v_requester_name,
      'requester_email', v_requester_email,
      'recipient_name', v_recipient_name
    );

  SELECT string_agg(d.email, ', ' ORDER BY d.email)
  INTO v_all_emails
  FROM (
    SELECT min(btrim(source.email)) AS email
    FROM (
      SELECT value AS email
      FROM jsonb_array_elements_text(COALESCE(v_payload->'to', '[]'::jsonb))
      UNION ALL
      SELECT value AS email
      FROM jsonb_array_elements_text(v_cc)
    ) source
    WHERE NULLIF(btrim(source.email), '') IS NOT NULL
    GROUP BY lower(btrim(source.email))
  ) d;

  UPDATE public.internal_ticket_email_outbox
  SET subject = 'Solicitação interna Newline',
      recipient_email = v_all_emails,
      raw_payload = jsonb_set(COALESCE(raw_payload, '{}'::jsonb), '{cc}', v_cc, true)
  WHERE ticket_id = p_ticket_id
    AND idempotency_key = 'ticket-opened:' || p_ticket_id
    AND direction = 'outbound'
    AND template_name = 'ticket-opened';

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_ticket_prepare_send_authenticated(uuid)
  FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_prepare_send_authenticated(uuid)
  TO authenticated;

