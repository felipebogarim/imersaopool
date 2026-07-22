
-- 1) Hardening require_admin_aal2: adiciona checagem de conta não banida
CREATE OR REPLACE FUNCTION public.require_admin_aal2()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _started timestamptz;
  _banned timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_role(_uid, 'admin') THEN RETURN; END IF;

  SELECT banned_until INTO _banned FROM auth.users WHERE id = _uid;
  IF _banned IS NOT NULL AND _banned > now() THEN
    PERFORM public.log_mfa_event('admin_op_rejected_aal1'::public.admin_mfa_event, _uid,
      jsonb_build_object('reason','account_banned'));
    RAISE EXCEPTION 'Conta administrativa bloqueada';
  END IF;

  SELECT enforcement_started_at INTO _started FROM public.admin_mfa_policy WHERE id = true;
  IF _started IS NULL THEN RETURN; END IF;

  IF NOT public.assert_aal2() THEN
    PERFORM public.log_mfa_event('admin_op_rejected_aal1'::public.admin_mfa_event, _uid,
      jsonb_build_object('reason','aal2_required'));
    RAISE EXCEPTION 'MFA (aal2) obrigatório para esta operação administrativa';
  END IF;
END $function$;

-- 2) Proteger RPCs administrativas existentes que hoje só checam has_role
CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, email text, full_name text, role app_role, last_sign_in_at timestamp with time zone, created_at timestamp with time zone, banned_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  PERFORM public.require_admin_aal2();
  RETURN QUERY
  SELECT u.id, u.email::text,
    COALESCE(p.full_name, u.raw_user_meta_data->>'full_name')::text,
    ur.role, u.last_sign_in_at, u.created_at, u.banned_until
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  ORDER BY u.created_at DESC;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_list_terms_conformidade()
 RETURNS TABLE(user_id uuid, email text, full_name text, role app_role, active_version text, accepted_version text, accepted_at timestamp with time zone, last_login_ack_at timestamp with time zone, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _active_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  PERFORM public.require_admin_aal2();
  SELECT id INTO _active_id FROM public.terms_versions WHERE is_active LIMIT 1;

  RETURN QUERY
  WITH last_full AS (
    SELECT DISTINCT ON (a.user_id) a.user_id, a.terms_version_id, a.accepted_at, v.version
    FROM public.terms_acceptances a
    JOIN public.terms_versions v ON v.id = a.terms_version_id
    WHERE a.acceptance_type = 'full_terms_acceptance' AND a.revoked_at IS NULL
    ORDER BY a.user_id, a.accepted_at DESC
  ),
  last_ack AS (
    SELECT DISTINCT ON (user_id) user_id, accepted_at
    FROM public.terms_acceptances
    WHERE acceptance_type = 'login_confidentiality_acknowledgement'
    ORDER BY user_id, accepted_at DESC
  ),
  active AS (SELECT version FROM public.terms_versions WHERE id = _active_id)
  SELECT
    u.id, u.email::text,
    COALESCE(p.full_name, u.raw_user_meta_data->>'full_name')::text,
    ur.role, (SELECT version FROM active),
    lf.version, lf.accepted_at, la.accepted_at,
    CASE
      WHEN lf.terms_version_id IS NULL THEN 'aceite_pendente'
      WHEN lf.terms_version_id = _active_id THEN 'aceito'
      ELSE 'nova_versao_disponivel'
    END
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN last_full lf ON lf.user_id = u.id
  LEFT JOIN last_ack la ON la.user_id = u.id
  ORDER BY u.created_at DESC;
END $function$;

-- 3) Trigger de aal2 em terms_versions (publicação/edição exige MFA)
CREATE OR REPLACE FUNCTION public.terms_versions_require_aal2()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  PERFORM public.require_admin_aal2();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_terms_versions_aal2 ON public.terms_versions;
CREATE TRIGGER trg_terms_versions_aal2
BEFORE INSERT OR UPDATE OR DELETE ON public.terms_versions
FOR EACH ROW EXECUTE FUNCTION public.terms_versions_require_aal2();

-- 4) Auditoria imutável: negar UPDATE/DELETE em admin_mfa_audit
REVOKE UPDATE, DELETE ON public.admin_mfa_audit FROM PUBLIC, authenticated, anon;
DROP POLICY IF EXISTS admin_mfa_audit_no_update ON public.admin_mfa_audit;
DROP POLICY IF EXISTS admin_mfa_audit_no_delete ON public.admin_mfa_audit;
CREATE POLICY admin_mfa_audit_no_update ON public.admin_mfa_audit FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY admin_mfa_audit_no_delete ON public.admin_mfa_audit FOR DELETE USING (false);

-- 5) RPC oficial de início do enforcement (7 dias por padrão)
CREATE OR REPLACE FUNCTION public.admin_mfa_start_enforcement(_grace_days int DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _now timestamptz := now(); _deadline timestamptz; _grace int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  PERFORM public.require_admin_aal2();
  _grace := GREATEST(1, LEAST(30, COALESCE(_grace_days, 7)));
  _deadline := _now + make_interval(days => _grace);

  UPDATE public.admin_mfa_policy
    SET enforcement_started_at = _now,
        grace_period_days = _grace,
        updated_by = auth.uid(),
        updated_at = _now
    WHERE id = true;

  PERFORM public.log_mfa_event('policy_changed'::public.admin_mfa_event, auth.uid(),
    jsonb_build_object('action','enforcement_started',
      'started_at', _now, 'deadline', _deadline, 'grace_days', _grace));

  RETURN jsonb_build_object('started_at', _now, 'deadline', _deadline, 'grace_days', _grace);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_mfa_start_enforcement(int) TO authenticated;

-- 6) RPC de revogação de sessões (registro em audit; a revogação real acontece
--    numa server function usando supabaseAdmin.auth.admin.signOut)
CREATE OR REPLACE FUNCTION public.admin_log_session_revocation(_target_user_id uuid, _justificativa text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  PERFORM public.require_admin_aal2();
  IF length(coalesce(_justificativa,'')) < 10 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres)';
  END IF;
  INSERT INTO public.admin_mfa_audit(user_id, actor_id, event_type, metadata)
  VALUES (_target_user_id, auth.uid(), 'recovery_executed',
    jsonb_build_object('action','sessions_revoked','justificativa',_justificativa))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_log_session_revocation(uuid, text) TO authenticated;
