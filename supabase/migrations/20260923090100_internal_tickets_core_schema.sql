-- Módulo "Solicitações Internas" — Fase 1: schema núcleo.
--
-- Setores/pessoas/categorias são GLOBAIS (não escopados por company_id):
-- são departamentos internos da própria PoolFlux (Engenharia, Produção...),
-- compartilhados por todas as empresas/marcas atendidas no sistema.
-- Tickets são escopados por company_id, como o resto do sistema.

-- ── Enums ────────────────────────────────────────────────────────────────

CREATE TYPE public.internal_ticket_status AS ENUM (
  'rascunho',
  'aberto',
  'enviado',
  'recebido_pelo_setor',
  'em_analise',
  'aguardando_info_comercial',
  'respondido',
  'concluido',
  'cancelado'
);

CREATE TYPE public.internal_ticket_priority AS ENUM ('baixa', 'normal', 'alta', 'urgente');

CREATE TYPE public.internal_ticket_event_origin AS ENUM ('comercial', 'email', 'sistema', 'acao_publica');

CREATE TYPE public.internal_ticket_message_origin AS ENUM (
  'sistema',
  'email',
  'manual_presencial',
  'manual_telefone'
);

CREATE TYPE public.internal_ticket_recipient_role AS ENUM ('principal', 'copia', 'escalonamento');

CREATE TYPE public.internal_ticket_action AS ENUM (
  'confirmar_recebimento',
  'marcar_em_analise',
  'solicitar_informacao',
  'responder',
  'marcar_concluido'
);

-- ── Setores, pessoas, categorias ────────────────────────────────────────

CREATE TABLE public.internal_ticket_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  manager_person_id uuid NULL, -- FK adicionada após internal_ticket_sector_people existir
  default_sla_first_response_minutes integer NULL,
  default_sla_resolution_minutes integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.internal_ticket_sector_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.internal_ticket_sectors(id) ON DELETE CASCADE,
  name text NOT NULL,
  role_title text NULL,
  email text NOT NULL,
  is_primary_recipient boolean NOT NULL DEFAULT false,
  is_cc boolean NOT NULL DEFAULT false,
  is_escalation_contact boolean NOT NULL DEFAULT false,
  receives_new_tickets boolean NOT NULL DEFAULT true,
  receives_reminders boolean NOT NULL DEFAULT true,
  receives_escalations boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_ticket_sectors
  ADD CONSTRAINT internal_ticket_sectors_manager_person_id_fkey
  FOREIGN KEY (manager_person_id) REFERENCES public.internal_ticket_sector_people(id) ON DELETE SET NULL;

CREATE TABLE public.internal_ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  default_sector_id uuid NULL REFERENCES public.internal_ticket_sectors(id) ON DELETE SET NULL,
  sla_first_response_minutes integer NULL, -- sobrepõe o padrão do setor quando presente
  sla_resolution_minutes integer NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Ticket ───────────────────────────────────────────────────────────────

CREATE TABLE public.internal_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_number bigint GENERATED ALWAYS AS IDENTITY,
  ticket_number text GENERATED ALWAYS AS ('SOL-' || lpad(sequence_number::text, 6, '0')) STORED,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  title text NOT NULL,
  description text NOT NULL,
  client_id uuid NULL REFERENCES public.clients(id),
  product_id uuid NULL REFERENCES public.own_products(id),
  category_id uuid NOT NULL REFERENCES public.internal_ticket_categories(id),
  sector_id uuid NOT NULL REFERENCES public.internal_ticket_sectors(id),
  requester_user_id uuid NOT NULL REFERENCES public.profiles(id),
  commercial_owner_user_id uuid NOT NULL REFERENCES public.profiles(id),
  priority public.internal_ticket_priority NOT NULL DEFAULT 'normal',
  status public.internal_ticket_status NOT NULL DEFAULT 'rascunho',
  -- Snapshot do SLA resolvido (categoria substitui setor) no momento do envio —
  -- preserva o prazo combinado mesmo que a configuração mude depois.
  sla_first_response_minutes integer NULL,
  sla_resolution_minutes integer NULL,
  sla_first_response_due_at timestamptz NULL,
  sla_resolution_due_at timestamptz NULL,
  sent_at timestamptz NULL,
  received_by_sector_at timestamptz NULL,
  first_response_at timestamptz NULL,
  resolved_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  cancel_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX internal_tickets_company_status_idx ON public.internal_tickets (company_id, status);
CREATE INDEX internal_tickets_sector_id_idx ON public.internal_tickets (sector_id);
CREATE INDEX internal_tickets_category_id_idx ON public.internal_tickets (category_id);
CREATE INDEX internal_tickets_requester_idx ON public.internal_tickets (requester_user_id);

CREATE TABLE public.internal_ticket_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.internal_tickets(id) ON DELETE CASCADE,
  sector_person_id uuid NULL REFERENCES public.internal_ticket_sector_people(id) ON DELETE SET NULL,
  email text NOT NULL,
  name_snapshot text NULL,
  role public.internal_ticket_recipient_role NOT NULL DEFAULT 'principal',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX internal_ticket_recipients_ticket_id_idx ON public.internal_ticket_recipients (ticket_id);

-- Log de eventos: imutável (sem UPDATE/DELETE previstos) — é a trilha de auditoria do ticket.
CREATE TABLE public.internal_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.internal_tickets(id) ON DELETE CASCADE,
  from_status public.internal_ticket_status NULL,
  to_status public.internal_ticket_status NULL,
  origin public.internal_ticket_event_origin NOT NULL,
  author_user_id uuid NULL REFERENCES public.profiles(id),
  observation text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX internal_ticket_events_ticket_id_idx ON public.internal_ticket_events (ticket_id);

CREATE TABLE public.internal_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.internal_tickets(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound', 'nota_interna')),
  origin public.internal_ticket_message_origin NOT NULL DEFAULT 'sistema',
  author_user_id uuid NULL REFERENCES public.profiles(id),
  sender_email text NULL,
  subject text NULL,
  body_html text NULL,
  body_text text NULL,
  outbox_id uuid NULL REFERENCES public.internal_ticket_email_outbox(id) ON DELETE SET NULL,
  message_id text NULL,
  in_reply_to text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX internal_ticket_messages_ticket_id_idx ON public.internal_ticket_messages (ticket_id);
CREATE INDEX internal_ticket_messages_message_id_idx ON public.internal_ticket_messages (message_id);

CREATE TABLE public.internal_ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.internal_tickets(id) ON DELETE CASCADE,
  message_id uuid NULL REFERENCES public.internal_ticket_messages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NULL,
  size_bytes bigint NULL,
  uploaded_by uuid NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX internal_ticket_attachments_ticket_id_idx ON public.internal_ticket_attachments (ticket_id);

-- Tokens de ação pública: nenhuma política para authenticated/anon — só
-- service_role (que ignora RLS) lê/escreve, a partir das rotas da Fase 4.
CREATE TABLE public.internal_ticket_action_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.internal_tickets(id) ON DELETE CASCADE,
  action public.internal_ticket_action NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX internal_ticket_action_tokens_ticket_id_idx ON public.internal_ticket_action_tokens (ticket_id);

-- ── updated_at ───────────────────────────────────────────────────────────

CREATE TRIGGER trg_internal_ticket_sectors_updated BEFORE UPDATE ON public.internal_ticket_sectors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_internal_ticket_sector_people_updated BEFORE UPDATE ON public.internal_ticket_sector_people
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_internal_ticket_categories_updated BEFORE UPDATE ON public.internal_ticket_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_internal_tickets_updated BEFORE UPDATE ON public.internal_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.internal_ticket_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_sector_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_action_tokens ENABLE ROW LEVEL SECURITY;

-- Quem tem algum papel do módulo (independente de empresa — setores/categorias são globais).
CREATE OR REPLACE FUNCTION public.internal_ticket_module_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'comercial')
      OR public.has_role(_user_id, 'gestor_comercial')
      OR public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'diretoria');
$$;

-- Visibilidade de um ticket: mesma empresa ativa + (autor, responsável comercial,
-- gestor comercial, admin ou diretoria). Regras finas de quem pode mudar QUAL
-- status ficam no domínio (Fase 2) + funções server (Fase 4), não aqui.
CREATE OR REPLACE FUNCTION public.internal_ticket_can_access(_ticket_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_tickets t
    WHERE t.id = _ticket_id
      AND t.company_id = public.current_company_id()
      AND (
        t.requester_user_id = _user_id
        OR t.commercial_owner_user_id = _user_id
        OR public.has_role(_user_id, 'gestor_comercial')
        OR public.has_role(_user_id, 'admin')
        OR public.has_role(_user_id, 'diretoria')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.internal_ticket_module_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.internal_ticket_can_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_ticket_module_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.internal_ticket_can_access(uuid, uuid) TO authenticated;

-- Setores / pessoas / categorias: leitura para qualquer papel do módulo, escrita só admin.
CREATE POLICY internal_ticket_sectors_select ON public.internal_ticket_sectors
  FOR SELECT TO authenticated USING (public.internal_ticket_module_role(auth.uid()));
CREATE POLICY internal_ticket_sectors_admin_write ON public.internal_ticket_sectors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY internal_ticket_sector_people_select ON public.internal_ticket_sector_people
  FOR SELECT TO authenticated USING (public.internal_ticket_module_role(auth.uid()));
CREATE POLICY internal_ticket_sector_people_admin_write ON public.internal_ticket_sector_people
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY internal_ticket_categories_select ON public.internal_ticket_categories
  FOR SELECT TO authenticated USING (public.internal_ticket_module_role(auth.uid()));
CREATE POLICY internal_ticket_categories_admin_write ON public.internal_ticket_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tickets
CREATE POLICY internal_tickets_select ON public.internal_tickets
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      requester_user_id = auth.uid()
      OR commercial_owner_user_id = auth.uid()
      OR public.has_role(auth.uid(), 'gestor_comercial')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'diretoria')
    )
  );

CREATE POLICY internal_tickets_insert ON public.internal_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND requester_user_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'comercial')
      OR public.has_role(auth.uid(), 'gestor_comercial')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY internal_tickets_update ON public.internal_tickets
  FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      requester_user_id = auth.uid()
      OR commercial_owner_user_id = auth.uid()
      OR public.has_role(auth.uid(), 'gestor_comercial')
      OR public.has_role(auth.uid(), 'admin')
    )
  )
  WITH CHECK (company_id = public.current_company_id());

-- Filhos do ticket: visibilidade herdada via internal_ticket_can_access().
-- Eventos e mensagens são só-inserção (trilha de auditoria imutável); anexos
-- também aceitam insert; destinatários são escritos apenas pelo service role
-- (snapshot feito no envio, Fase 4) — só leitura aqui.
CREATE POLICY internal_ticket_recipients_select ON public.internal_ticket_recipients
  FOR SELECT TO authenticated USING (public.internal_ticket_can_access(ticket_id, auth.uid()));

CREATE POLICY internal_ticket_events_select ON public.internal_ticket_events
  FOR SELECT TO authenticated USING (public.internal_ticket_can_access(ticket_id, auth.uid()));
CREATE POLICY internal_ticket_events_insert ON public.internal_ticket_events
  FOR INSERT TO authenticated WITH CHECK (public.internal_ticket_can_access(ticket_id, auth.uid()));

CREATE POLICY internal_ticket_messages_select ON public.internal_ticket_messages
  FOR SELECT TO authenticated USING (public.internal_ticket_can_access(ticket_id, auth.uid()));
CREATE POLICY internal_ticket_messages_insert ON public.internal_ticket_messages
  FOR INSERT TO authenticated WITH CHECK (public.internal_ticket_can_access(ticket_id, auth.uid()));

CREATE POLICY internal_ticket_attachments_select ON public.internal_ticket_attachments
  FOR SELECT TO authenticated USING (public.internal_ticket_can_access(ticket_id, auth.uid()));
CREATE POLICY internal_ticket_attachments_insert ON public.internal_ticket_attachments
  FOR INSERT TO authenticated WITH CHECK (public.internal_ticket_can_access(ticket_id, auth.uid()));

-- internal_ticket_action_tokens: RLS habilitada, nenhuma política para
-- authenticated/anon — acesso exclusivo do service role.

-- ── Seed dos setores (sem pessoas vinculadas — cadastro fica para a tela de Admin) ─

INSERT INTO public.internal_ticket_sectors (name) VALUES
  ('Engenharia'),
  ('Produção'),
  ('Expedição'),
  ('Cadastro'),
  ('Financeiro'),
  ('Trade'),
  ('Diretoria')
ON CONFLICT (name) DO NOTHING;
