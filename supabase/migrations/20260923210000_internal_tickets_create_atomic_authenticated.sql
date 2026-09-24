-- Solicitações Internas — criação atômica com a sessão authenticated.
--
-- Identidade, empresa, autorização, SLA e metadados internos são derivados no
-- banco. A função não aceita p_user_id/p_company_id nem valores de SLA/outbox.
-- SECURITY DEFINER é necessário porque recipients, sector_stops e outbox não
-- expõem INSERT direto a authenticated; todas as validações acontecem antes do
-- primeiro INSERT e qualquer erro posterior aborta a transação inteira.

-- A RPC service-role anterior, public.internal_ticket_create_atomic(...),
-- permanece intocada nesta etapa para que o código já publicado continue
-- funcionando durante a implantação. Uma migration posterior poderá removê-la
-- somente depois que todos os runtimes usarem esta RPC autenticada.
CREATE OR REPLACE FUNCTION public.internal_ticket_create_atomic_authenticated(
  p_title text,
  p_description text,
  p_client_id uuid,
  p_category_id uuid,
  p_sector_id uuid,
  p_commercial_owner_user_id uuid,
  p_priority public.internal_ticket_priority,
  p_product_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_commercial_owner_user_id uuid;
  v_created_at timestamptz := now();
  v_category_first_response_minutes integer;
  v_category_resolution_minutes integer;
  v_sector_first_response_minutes integer;
  v_sector_resolution_minutes integer;
  v_first_response_minutes integer;
  v_resolution_minutes integer;
  v_ticket public.internal_tickets;
  v_to jsonb;
  v_cc jsonb;
  v_all_emails text;
  v_message_id text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '28000';
  END IF;

  -- A função canônica do módulo inclui diretoria (leitura). A segunda
  -- condição preserva a regra canônica de criação da policy de tickets:
  -- somente comercial, gestor_comercial ou admin podem criar.
  IF NOT public.internal_ticket_module_role(v_user_id) THEN
    RAISE EXCEPTION 'Acesso negado: sem papel no módulo de Solicitações Internas.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT (
    public.has_role(v_user_id, 'comercial')
    OR public.has_role(v_user_id, 'gestor_comercial')
    OR public.has_role(v_user_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: seu papel não permite criar solicitações.'
      USING ERRCODE = '42501';
  END IF;

  v_company_id := public.current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa ativa selecionada.' USING ERRCODE = '23514';
  END IF;

  IF char_length(btrim(COALESCE(p_title, ''))) < 3 THEN
    RAISE EXCEPTION 'Título deve ter pelo menos 3 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(COALESCE(p_description, ''))) < 1 THEN
    RAISE EXCEPTION 'Descrição obrigatória.' USING ERRCODE = '22023';
  END IF;

  SELECT
    c.sla_first_response_minutes,
    c.sla_resolution_minutes
  INTO
    v_category_first_response_minutes,
    v_category_resolution_minutes
  FROM public.internal_ticket_categories c
  WHERE c.id = p_category_id AND c.active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoria inexistente ou inativa.' USING ERRCODE = '23503';
  END IF;

  SELECT
    s.default_sla_first_response_minutes,
    s.default_sla_resolution_minutes
  INTO
    v_sector_first_response_minutes,
    v_sector_resolution_minutes
  FROM public.internal_ticket_sectors s
  WHERE s.id = p_sector_id AND s.active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Setor inexistente ou inativo.' USING ERRCODE = '23503';
  END IF;

  IF p_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = p_client_id AND c.company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Cliente inexistente ou não pertence à empresa ativa.'
      USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_product_ids, ARRAY[]::uuid[])) AS requested(product_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.own_products product
      WHERE product.id = requested.product_id
        AND product.company_id = v_company_id
    )
  ) THEN
    RAISE EXCEPTION 'Um ou mais produtos não existem ou não pertencem à empresa ativa.'
      USING ERRCODE = '23503';
  END IF;

  v_commercial_owner_user_id := COALESCE(p_commercial_owner_user_id, v_user_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles owner_profile
    WHERE owner_profile.id = v_commercial_owner_user_id
      AND owner_profile.active_company_id = v_company_id
      AND owner_profile.status = 'ativo'
  ) OR NOT (
    public.has_role(v_commercial_owner_user_id, 'comercial')
    OR public.has_role(v_commercial_owner_user_id, 'gestor_comercial')
    OR public.has_role(v_commercial_owner_user_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Responsável comercial inválido para a empresa ativa.'
      USING ERRCODE = '23503';
  END IF;

  -- Mesma precedência de src/lib/internal-tickets/sla.ts: categoria
  -- sobrepõe setor; NULL na categoria herda o padrão do setor.
  v_first_response_minutes := COALESCE(
    v_category_first_response_minutes,
    v_sector_first_response_minutes
  );
  v_resolution_minutes := COALESCE(
    v_category_resolution_minutes,
    v_sector_resolution_minutes
  );
  IF v_first_response_minutes < 0 OR v_resolution_minutes < 0 THEN
    RAISE EXCEPTION 'Configuração de SLA inválida: minutos não podem ser negativos.'
      USING ERRCODE = '23514';
  END IF;

  -- Destinatários são globais por setor, conforme o schema do módulo.
  IF NOT EXISTS (
    SELECT 1 FROM public.internal_ticket_sector_people sp
    WHERE sp.sector_id = p_sector_id
      AND sp.active
      AND sp.receives_new_tickets
      AND sp.is_primary_recipient
  ) THEN
    RAISE EXCEPTION 'Este setor não possui um destinatário principal configurado para receber novos tickets.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.internal_tickets (
    company_id, title, description, client_id, category_id, sector_id,
    requester_user_id, commercial_owner_user_id, priority, status,
    sla_first_response_minutes, sla_resolution_minutes,
    sla_first_response_due_at, sla_resolution_due_at, created_at
  ) VALUES (
    v_company_id, btrim(p_title), btrim(p_description), p_client_id, p_category_id, p_sector_id,
    v_user_id, v_commercial_owner_user_id, COALESCE(p_priority, 'normal'), 'aberto',
    v_first_response_minutes, v_resolution_minutes,
    CASE WHEN v_first_response_minutes IS NULL THEN NULL
         ELSE v_created_at + make_interval(mins => v_first_response_minutes) END,
    CASE WHEN v_resolution_minutes IS NULL THEN NULL
         ELSE v_created_at + make_interval(mins => v_resolution_minutes) END,
    v_created_at
  ) RETURNING * INTO v_ticket;

  INSERT INTO public.internal_ticket_products (ticket_id, product_id)
  SELECT v_ticket.id, requested.product_id
  FROM (
    SELECT DISTINCT unnest(COALESCE(p_product_ids, ARRAY[]::uuid[])) AS product_id
  ) AS requested;

  INSERT INTO public.internal_ticket_sector_stops (ticket_id, sector_id, moved_by)
  VALUES (v_ticket.id, p_sector_id, v_user_id);

  INSERT INTO public.internal_ticket_recipients (
    ticket_id, sector_person_id, email, name_snapshot, role
  )
  SELECT
    v_ticket.id,
    sp.id,
    sp.email,
    sp.name,
    CASE
      WHEN sp.is_primary_recipient THEN 'principal'::public.internal_ticket_recipient_role
      ELSE 'copia'::public.internal_ticket_recipient_role
    END
  FROM public.internal_ticket_sector_people sp
  WHERE sp.sector_id = p_sector_id
    AND sp.active
    AND sp.receives_new_tickets
    AND (sp.is_primary_recipient OR sp.is_cc);

  INSERT INTO public.internal_ticket_events (
    ticket_id, from_status, to_status, origin, author_user_id, observation
  ) VALUES (
    v_ticket.id, NULL, 'aberto', 'comercial', v_user_id, 'Ticket criado'
  );

  SELECT COALESCE(jsonb_agg(r.email ORDER BY r.email), '[]'::jsonb)
  INTO v_to
  FROM public.internal_ticket_recipients r
  WHERE r.ticket_id = v_ticket.id AND r.role = 'principal';

  SELECT COALESCE(jsonb_agg(r.email ORDER BY r.email), '[]'::jsonb)
  INTO v_cc
  FROM public.internal_ticket_recipients r
  WHERE r.ticket_id = v_ticket.id AND r.role = 'copia';

  SELECT string_agg(r.email, ', ' ORDER BY r.role, r.email)
  INTO v_all_emails
  FROM public.internal_ticket_recipients r
  WHERE r.ticket_id = v_ticket.id;

  -- O remetente real depende da configuração server-side do provider e é
  -- definido somente na etapa de envio. A criação gera correlação e
  -- idempotência sem aceitar metadados controlados pelo chamador.
  v_message_id := format('<%s@internal-tickets.local>', gen_random_uuid());
  INSERT INTO public.internal_ticket_email_outbox (
    idempotency_key, direction, ticket_id, template_name,
    recipient_email, sender_email, subject, message_id, status, raw_payload
  ) VALUES (
    'ticket-opened:' || v_ticket.id,
    'outbound',
    v_ticket.id,
    'ticket-opened',
    v_all_emails,
    NULL,
    '[' || v_ticket.ticket_number || '] ' || v_ticket.title,
    v_message_id,
    'pending',
    jsonb_build_object('to', v_to, 'cc', v_cc)
  );

  RETURN jsonb_build_object('ticket', to_jsonb(v_ticket), 'to', v_to, 'cc', v_cc);
END;
$$;

REVOKE ALL ON FUNCTION public.internal_ticket_create_atomic_authenticated(
  text, text, uuid, uuid, uuid, uuid, public.internal_ticket_priority, uuid[]
) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.internal_ticket_create_atomic_authenticated(
  text, text, uuid, uuid, uuid, uuid, public.internal_ticket_priority, uuid[]
) TO authenticated;
