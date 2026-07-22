
DO $$ BEGIN
  CREATE TYPE public.admin_mfa_event AS ENUM (
    'enroll_started','enroll_completed','enroll_abandoned','verify_failed',
    'challenge_completed','admin_blocked_no_mfa','factor_removed_admin',
    'recovery_executed','enroll_after_recovery','deadline_changed',
    'policy_changed','admin_op_rejected_aal1'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.admin_mfa_policy (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enforcement_started_at timestamptz,
  grace_period_days integer NOT NULL DEFAULT 7,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_mfa_policy TO authenticated;
GRANT ALL ON public.admin_mfa_policy TO service_role;
ALTER TABLE public.admin_mfa_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_mfa_policy_read_authenticated ON public.admin_mfa_policy;
CREATE POLICY admin_mfa_policy_read_authenticated ON public.admin_mfa_policy
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.admin_mfa_policy (id) VALUES (true) ON CONFLICT DO NOTHING;

DROP TRIGGER IF EXISTS admin_mfa_policy_touch ON public.admin_mfa_policy;
CREATE TRIGGER admin_mfa_policy_touch BEFORE UPDATE ON public.admin_mfa_policy
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.admin_mfa_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  actor_id uuid,
  event_type public.admin_mfa_event NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_mfa_audit TO authenticated;
GRANT ALL ON public.admin_mfa_audit TO service_role;
ALTER TABLE public.admin_mfa_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_mfa_audit_admin_read ON public.admin_mfa_audit;
CREATE POLICY admin_mfa_audit_admin_read ON public.admin_mfa_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS admin_mfa_audit_no_mutate ON public.admin_mfa_audit;
CREATE POLICY admin_mfa_audit_no_mutate ON public.admin_mfa_audit
  FOR UPDATE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_admin_mfa_audit_user ON public.admin_mfa_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_audit_event ON public.admin_mfa_audit(event_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.assert_aal2()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'aal') = 'aal2',
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.assert_aal2() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_mfa_event(
  _event public.admin_mfa_event, _target_user uuid DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _actor uuid := auth.uid();
BEGIN
  _metadata := COALESCE(_metadata, '{}'::jsonb)
    - 'secret' - 'totp_secret' - 'code' - 'qr' - 'qr_code'
    - 'access_token' - 'refresh_token' - 'password' - 'service_role_key';
  INSERT INTO public.admin_mfa_audit(user_id, actor_id, event_type, metadata)
  VALUES (COALESCE(_target_user, _actor), _actor, _event, _metadata)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.log_mfa_event(public.admin_mfa_event, uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_admin_mfa_status()
RETURNS TABLE(
  is_admin boolean, has_verified_factor boolean,
  enforcement_started_at timestamptz, deadline timestamptz,
  days_left integer, grace_active boolean, must_enroll_now boolean, current_aal text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean; _has_factor boolean;
  _started timestamptz; _grace int; _deadline timestamptz;
  _now timestamptz := now(); _aal text;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  _is_admin := public.has_role(_uid, 'admin');
  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors
    WHERE user_id = _uid AND status = 'verified' AND factor_type = 'totp'
  ) INTO _has_factor;
  SELECT p.enforcement_started_at, p.grace_period_days
    INTO _started, _grace
    FROM public.admin_mfa_policy p WHERE p.id = true;
  IF _started IS NOT NULL THEN
    _deadline := _started + make_interval(days => _grace);
  END IF;
  _aal := current_setting('request.jwt.claims', true)::jsonb ->> 'aal';
  is_admin := _is_admin;
  has_verified_factor := _has_factor;
  enforcement_started_at := _started;
  deadline := _deadline;
  days_left := CASE WHEN _deadline IS NULL THEN NULL
    ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (_deadline - _now))/86400)::int) END;
  grace_active := _started IS NOT NULL AND _deadline > _now;
  must_enroll_now := _is_admin AND NOT _has_factor AND _started IS NOT NULL AND _deadline <= _now;
  current_aal := _aal;
  RETURN NEXT;
END $$;
GRANT EXECUTE ON FUNCTION public.get_admin_mfa_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.require_admin_aal2()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _started timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_role(_uid, 'admin') THEN RETURN; END IF;
  SELECT enforcement_started_at INTO _started FROM public.admin_mfa_policy WHERE id = true;
  IF _started IS NULL THEN RETURN; END IF;
  IF NOT public.assert_aal2() THEN
    PERFORM public.log_mfa_event('admin_op_rejected_aal1'::public.admin_mfa_event, _uid,
      jsonb_build_object('reason','aal2_required'));
    RAISE EXCEPTION 'MFA (aal2) obrigatório para esta operação administrativa';
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.require_admin_aal2() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_anonymize_profile(_target_user_id uuid, _justificativa text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  PERFORM public.require_admin_aal2();
  UPDATE public.profiles
    SET full_name = 'Usuário anonimizado',
        email = 'anon-' || substr(md5(id::text || now()::text), 1, 12) || '@anonimizado.local'
    WHERE id = _target_user_id;
  PERFORM admin_log_purge_action(_target_user_id, 'anonymize', _justificativa, 'executado', NULL, '{}'::jsonb);
END $function$;

CREATE OR REPLACE FUNCTION public.admin_log_purge_action(
  _target_user_id uuid, _request_type text, _justificativa text,
  _status text DEFAULT 'executado'::text, _error text DEFAULT NULL::text,
  _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _id uuid; _target_email text; _requester_email text; _uid uuid := auth.uid();
BEGIN
  IF NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  PERFORM public.require_admin_aal2();
  IF length(coalesce(_justificativa,'')) < 10 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres)';
  END IF;
  SELECT email INTO _target_email FROM auth.users WHERE id = _target_user_id;
  SELECT email INTO _requester_email FROM auth.users WHERE id = _uid;
  INSERT INTO public.data_purge_requests(
    target_user_id, target_email, request_type,
    requested_by, requester_email, justificativa,
    status, error_message, metadata
  ) VALUES (
    _target_user_id, COALESCE(_target_email,'desconhecido'), _request_type,
    _uid, COALESCE(_requester_email,'desconhecido'), _justificativa,
    _status, _error, COALESCE(_metadata,'{}'::jsonb)
  ) RETURNING id INTO _id;
  PERFORM log_security_event(
    'lgpd_purge', _request_type, _target_email, _status,
    CASE WHEN _request_type='delete' THEN 'alto' ELSE 'medio' END,
    jsonb_build_object('target_user_id', _target_user_id, 'purge_id', _id)
  );
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_mfa_policy_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF NEW.enforcement_started_at IS DISTINCT FROM OLD.enforcement_started_at
     OR NEW.grace_period_days IS DISTINCT FROM OLD.grace_period_days THEN
    IF EXISTS (
      SELECT 1 FROM auth.mfa_factors
      WHERE user_id = auth.uid() AND status='verified' AND factor_type='totp'
    ) THEN
      IF NOT public.assert_aal2() THEN
        RAISE EXCEPTION 'MFA (aal2) obrigatório para alterar a política de MFA';
      END IF;
    END IF;
    PERFORM public.log_mfa_event('policy_changed'::public.admin_mfa_event, auth.uid(),
      jsonb_build_object(
        'old_started', OLD.enforcement_started_at,
        'new_started', NEW.enforcement_started_at,
        'old_grace', OLD.grace_period_days,
        'new_grace', NEW.grace_period_days
      ));
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS admin_mfa_policy_guard_trg ON public.admin_mfa_policy;
CREATE TRIGGER admin_mfa_policy_guard_trg
  BEFORE UPDATE ON public.admin_mfa_policy
  FOR EACH ROW EXECUTE FUNCTION public.admin_mfa_policy_guard();

DROP POLICY IF EXISTS admin_mfa_policy_update ON public.admin_mfa_policy;
CREATE POLICY admin_mfa_policy_update ON public.admin_mfa_policy
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
