-- Solicitações Internas — garante o solicitante no CC do envio inicial.
--
-- A função-base mantém toda a validação, autorização e reivindicação
-- transacional da tentativa. O wrapper enriquece somente o payload de entrega
-- com a identidade do solicitante e o nome do destinatário principal.

ALTER FUNCTION public.internal_ticket_prepare_send_authenticated(uuid)
  RENAME TO internal_ticket_prepare_send_authenticated_base;

REVOKE ALL ON FUNCTION public.internal_ticket_prepare_send_authenticated_base(uuid)
  FROM public, anon, authenticated, service_role;

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
  -- A base valida auth.uid(), empresa, acesso, papel, estado, outbox e lease.
  v_payload := public.internal_ticket_prepare_send_authenticated_base(p_ticket_id);

  IF COALESCE((v_payload->>'already_sent')::boolean, false) THEN
    RETURN v_payload;
  END IF;

  SELECT
    COALESCE(NULLIF(btrim(p.email), ''), NULLIF(btrim(u.email), '')),
    COALESCE(NULLIF(btrim(p.full_name), ''), NULLIF(btrim(p.email), ''),
      NULLIF(btrim(u.email), ''), 'Comercial')
  INTO v_requester_email, v_requester_name
  FROM public.internal_tickets t
  LEFT JOIN public.profiles p ON p.id = t.requester_user_id
  LEFT JOIN auth.users u ON u.id = t.requester_user_id
  WHERE t.id = p_ticket_id;

  IF v_requester_email IS NULL THEN
    RAISE EXCEPTION
      'E-mail corporativo do solicitante não cadastrado em profiles.email nem na conta de autenticação.'
      USING ERRCODE = '23514';
  END IF;

  SELECT string_agg(
    COALESCE(NULLIF(btrim(r.name_snapshot), ''), r.email),
    ', ' ORDER BY r.email
  )
  INTO v_recipient_name
  FROM public.internal_ticket_recipients r
  WHERE r.ticket_id = p_ticket_id
    AND r.role = 'principal';

  -- Mantém as cópias automáticas existentes e inclui o solicitante uma
  -- única vez, comparando endereços sem diferenciar maiúsculas/minúsculas.
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
    GROUP BY lower(btrim(source.email))
  ) d;

  v_payload := jsonb_set(v_payload, '{cc}', v_cc, true)
    || jsonb_build_object(
      'requester_name', v_requester_name,
      'recipient_name', COALESCE(v_recipient_name, 'Destinatário')
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

