-- EMAIL-FIRST: persistência durável de participantes, mensagens, webhooks,
-- relays, sinais derivados, anexos e indicadores objetivos.

CREATE TABLE public.internal_ticket_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.internal_tickets(id) ON DELETE CASCADE,
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  display_name text NULL,
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN (
    'requester', 'primary_recipient', 'configured_cc', 'email_to', 'email_cc', 'email_sender'
  )),
  role text NOT NULL CHECK (role IN ('requester', 'primary', 'cc', 'participant')),
  active boolean NOT NULL DEFAULT true,
  automatic boolean NOT NULL DEFAULT false,
  is_requester boolean NOT NULL DEFAULT false,
  is_current_primary boolean NOT NULL DEFAULT false,
  is_configured_recipient boolean NOT NULL DEFAULT false,
  added_by_email boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internal_ticket_participants_email_not_blank CHECK (btrim(email) <> ''),
  CONSTRAINT internal_ticket_participants_ticket_email_key UNIQUE (ticket_id, email_normalized)
);

CREATE INDEX internal_ticket_participants_ticket_active_idx
  ON public.internal_ticket_participants (ticket_id, active);

CREATE TABLE public.internal_ticket_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'resend',
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  provider_email_id text NULL,
  raw_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'processed', 'quarantined', 'failed'
  )),
  attempt_count integer NOT NULL DEFAULT 0,
  lease_token uuid NULL,
  lease_expires_at timestamptz NULL,
  error_message text NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  CONSTRAINT internal_ticket_webhook_events_provider_event_key
    UNIQUE (provider, provider_event_id)
);

CREATE UNIQUE INDEX internal_ticket_webhook_received_email_key
  ON public.internal_ticket_webhook_events (provider, provider_email_id)
  WHERE event_type = 'email.received' AND provider_email_id IS NOT NULL;

ALTER TABLE public.internal_ticket_messages
  ADD COLUMN provider text NULL,
  ADD COLUMN provider_email_id text NULL,
  ADD COLUMN provider_event_id text NULL,
  ADD COLUMN sender_name text NULL,
  ADD COLUMN sender_email_normalized text GENERATED ALWAYS AS (lower(btrim(sender_email))) STORED,
  ADD COLUMN to_emails text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN cc_emails text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN body_html_original text NULL,
  ADD COLUMN body_html_sanitized text NULL,
  ADD COLUMN clean_text text NULL,
  ADD COLUMN reference_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN raw_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN authentication jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN received_at timestamptz NULL,
  ADD COLUMN processing_status text NOT NULL DEFAULT 'processed' CHECK (processing_status IN (
    'processing', 'processed', 'quarantined', 'failed'
  )),
  ADD COLUMN quarantine_reason text NULL,
  ADD COLUMN relay_parent_message_id uuid NULL
    REFERENCES public.internal_ticket_messages(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX internal_ticket_messages_provider_email_key
  ON public.internal_ticket_messages (provider, provider_email_id)
  WHERE provider IS NOT NULL AND provider_email_id IS NOT NULL;

CREATE UNIQUE INDEX internal_ticket_messages_ticket_rfc_message_key
  ON public.internal_ticket_messages (ticket_id, message_id)
  WHERE message_id IS NOT NULL;

CREATE TABLE public.internal_ticket_relay_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.internal_tickets(id) ON DELETE CASCADE,
  source_message_id uuid NOT NULL REFERENCES public.internal_ticket_messages(id) ON DELETE CASCADE,
  target_email text NOT NULL,
  target_email_normalized text GENERATED ALWAYS AS (lower(btrim(target_email))) STORED,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sending', 'sent', 'delivered', 'failed', 'bounced'
  )),
  attempt_count integer NOT NULL DEFAULT 0,
  lease_token uuid NULL,
  lease_expires_at timestamptz NULL,
  provider_message_id text NULL,
  message_id text NOT NULL,
  last_error text NULL,
  sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internal_ticket_relay_source_target_key
    UNIQUE (source_message_id, target_email_normalized)
);

CREATE INDEX internal_ticket_relay_ticket_status_idx
  ON public.internal_ticket_relay_deliveries (ticket_id, status);
CREATE UNIQUE INDEX internal_ticket_relay_provider_message_key
  ON public.internal_ticket_relay_deliveries (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE public.internal_ticket_message_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.internal_tickets(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.internal_ticket_messages(id) ON DELETE CASCADE,
  signal_type text NOT NULL CHECK (signal_type IN (
    'resposta', 'duvida', 'progresso', 'impedimento', 'cobranca',
    'entrega', 'provavel_conclusao', 'aprovacao'
  )),
  confidence numeric(5,4) NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source text NOT NULL DEFAULT 'regra' CHECK (source IN ('regra', 'ia', 'humano')),
  model text NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internal_ticket_message_signals_unique UNIQUE (message_id, signal_type, source)
);

ALTER TABLE public.internal_tickets
  ADD COLUMN first_response_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN first_response_by_email text NULL,
  ADD COLUMN first_response_sla_met boolean NULL,
  ADD COLUMN last_activity_at timestamptz NULL,
  ADD COLUMN last_activity_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN last_activity_by_email text NULL,
  ADD COLUMN last_message_id uuid NULL REFERENCES public.internal_ticket_messages(id) ON DELETE SET NULL,
  ADD COLUMN resolution_proposed_at timestamptz NULL,
  ADD COLUMN validation_started_at timestamptz NULL,
  ADD COLUMN reopened_at timestamptz NULL,
  ADD COLUMN reopen_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.internal_ticket_attachments
  ALTER COLUMN storage_path DROP NOT NULL,
  ADD COLUMN provider text NULL,
  ADD COLUMN provider_attachment_id text NULL,
  ADD COLUMN content_disposition text NULL,
  ADD COLUMN content_id text NULL,
  ADD COLUMN sha256 text NULL,
  ADD COLUMN scan_status text NOT NULL DEFAULT 'not_scanned' CHECK (scan_status IN (
    'not_scanned', 'pending', 'clean', 'blocked', 'failed'
  )),
  ADD COLUMN download_error text NULL;

ALTER TABLE public.internal_ticket_action_tokens
  ADD COLUMN intended_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN intended_email text NULL,
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.internal_ticket_attachments
  ADD CONSTRAINT internal_ticket_attachments_provider_key
  UNIQUE (provider, provider_attachment_id);

CREATE TRIGGER trg_internal_ticket_participants_updated
  BEFORE UPDATE ON public.internal_ticket_participants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_internal_ticket_relay_deliveries_updated
  BEFORE UPDATE ON public.internal_ticket_relay_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.internal_ticket_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_relay_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_ticket_message_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_ticket_participants_select ON public.internal_ticket_participants
  FOR SELECT TO authenticated USING (public.internal_ticket_can_access(ticket_id, auth.uid()));
CREATE POLICY internal_ticket_message_signals_select ON public.internal_ticket_message_signals
  FOR SELECT TO authenticated USING (public.internal_ticket_can_access(ticket_id, auth.uid()));
-- Webhook events e relay deliveries não possuem policy: somente service_role.

GRANT SELECT ON public.internal_ticket_participants TO authenticated;
GRANT SELECT ON public.internal_ticket_message_signals TO authenticated;
GRANT ALL ON public.internal_ticket_participants TO service_role;
GRANT ALL ON public.internal_ticket_webhook_events TO service_role;
GRANT ALL ON public.internal_ticket_relay_deliveries TO service_role;
GRANT ALL ON public.internal_ticket_message_signals TO service_role;

-- Participantes históricos existentes: solicitante (profiles.email preferencial)
-- e snapshots imutáveis dos destinatários da abertura.
INSERT INTO public.internal_ticket_participants (
  ticket_id, email, display_name, user_id, source, role, automatic,
  is_requester, is_current_primary, is_configured_recipient, added_by_email,
  first_seen_at, last_seen_at
)
SELECT t.id, COALESCE(NULLIF(btrim(p.email), ''), NULLIF(btrim(u.email), '')),
       COALESCE(NULLIF(btrim(p.full_name), ''), NULLIF(btrim(p.email), ''), NULLIF(btrim(u.email), '')),
       t.requester_user_id, 'requester', 'requester', true,
       true, false, false, false, t.created_at, t.updated_at
FROM public.internal_tickets t
LEFT JOIN public.profiles p ON p.id = t.requester_user_id
LEFT JOIN auth.users u ON u.id = t.requester_user_id
WHERE COALESCE(NULLIF(btrim(p.email), ''), NULLIF(btrim(u.email), '')) IS NOT NULL
ON CONFLICT (ticket_id, email_normalized) DO UPDATE SET
  is_requester = true, user_id = EXCLUDED.user_id, active = true,
  last_seen_at = GREATEST(public.internal_ticket_participants.last_seen_at, EXCLUDED.last_seen_at);

INSERT INTO public.internal_ticket_participants (
  ticket_id, email, display_name, source, role, automatic,
  is_current_primary, is_configured_recipient, added_by_email,
  first_seen_at, last_seen_at
)
SELECT r.ticket_id, r.email, r.name_snapshot,
       CASE WHEN r.role = 'principal' THEN 'primary_recipient' ELSE 'configured_cc' END,
       CASE WHEN r.role = 'principal' THEN 'primary' ELSE 'cc' END,
       true, r.role = 'principal', true, false, r.created_at, r.created_at
FROM public.internal_ticket_recipients r
WHERE r.role IN ('principal', 'copia')
ON CONFLICT (ticket_id, email_normalized) DO UPDATE SET
  display_name = COALESCE(EXCLUDED.display_name, public.internal_ticket_participants.display_name),
  is_current_primary = public.internal_ticket_participants.is_current_primary OR EXCLUDED.is_current_primary,
  is_configured_recipient = true,
  active = true,
  last_seen_at = GREATEST(public.internal_ticket_participants.last_seen_at, EXCLUDED.last_seen_at);

COMMENT ON TABLE public.internal_ticket_recipients IS
  'Snapshot imutável dos destinatários no momento da abertura; participantes operacionais vivem em internal_ticket_participants.';
COMMENT ON TABLE public.internal_ticket_messages IS
  'Registro canônico e íntegro das mensagens inbound/outbound; body_html_original nunca deve ser renderizado sem sanitização.';
COMMENT ON TABLE public.internal_ticket_message_signals IS
  'Sinais derivados sem autoridade para alterar status formal ou concluir tickets.';
