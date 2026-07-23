CREATE OR REPLACE FUNCTION public.admin_conformidade_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _now timestamptz := now();
  _total_admins int;
  _admins_com_fator int;
  _admins_sem_fator int;
  _avg_hours_enroll numeric;
  _auth_falhas_24h int;
  _admin_rejeitados_24h int;
  _purges_pend int;
  _purges_exec_30d int;
  _terms_total int;
  _terms_aceitos int;
  _terms_pendentes int;
  _terms_nova int;
  _policy record;
  _active_id uuid;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT count(*) INTO _total_admins
  FROM public.user_roles WHERE role = 'admin';

  SELECT count(DISTINCT ur.user_id) INTO _admins_com_fator
  FROM public.user_roles ur
  JOIN auth.mfa_factors f ON f.user_id = ur.user_id
  WHERE ur.role = 'admin' AND f.status = 'verified' AND f.factor_type = 'totp';

  _admins_sem_fator := GREATEST(0, _total_admins - _admins_com_fator);

  WITH pares AS (
    SELECT a.user_id,
      MIN(a.created_at) FILTER (WHERE a.event_type = 'enroll_started') AS ini,
      MIN(a.created_at) FILTER (WHERE a.event_type = 'enroll_completed') AS fim
    FROM public.admin_mfa_audit a
    WHERE a.event_type IN ('enroll_started','enroll_completed')
    GROUP BY a.user_id
  )
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (fim - ini))/3600.0)::numeric, 2)
    INTO _avg_hours_enroll
  FROM pares WHERE ini IS NOT NULL AND fim IS NOT NULL AND fim >= ini;

  SELECT count(*) INTO _auth_falhas_24h
  FROM public.security_events
  WHERE tipo = 'auth.login' AND resultado = 'falha'
    AND ocorrido_em > _now - interval '24 hours';

  SELECT count(*) INTO _admin_rejeitados_24h
  FROM public.admin_mfa_audit
  WHERE event_type = 'admin_op_rejected_aal1'
    AND created_at > _now - interval '24 hours';

  SELECT
    count(*) FILTER (WHERE status IN ('pendente','em_processamento')),
    count(*) FILTER (WHERE status = 'executado' AND created_at > _now - interval '30 days')
    INTO _purges_pend, _purges_exec_30d
  FROM public.data_purge_requests;

  SELECT id INTO _active_id FROM public.terms_versions WHERE is_active LIMIT 1;

  SELECT count(*) INTO _terms_total FROM auth.users;

  WITH last_full AS (
    SELECT DISTINCT ON (user_id) user_id, terms_version_id
    FROM public.terms_acceptances
    WHERE acceptance_type = 'full_terms_acceptance' AND revoked_at IS NULL
    ORDER BY user_id, accepted_at DESC
  )
  SELECT
    count(*) FILTER (WHERE lf.terms_version_id = _active_id),
    count(*) FILTER (WHERE lf.terms_version_id IS NULL),
    count(*) FILTER (WHERE lf.terms_version_id IS NOT NULL AND lf.terms_version_id <> _active_id)
    INTO _terms_aceitos, _terms_pendentes, _terms_nova
  FROM auth.users u LEFT JOIN last_full lf ON lf.user_id = u.id;

  SELECT enforcement_started_at, grace_period_days INTO _policy
  FROM public.admin_mfa_policy WHERE id = true;

  RETURN jsonb_build_object(
    'mfa', jsonb_build_object(
      'total_admins', _total_admins,
      'admins_com_fator', _admins_com_fator,
      'admins_sem_fator', _admins_sem_fator,
      'pct_cobertura', CASE WHEN _total_admins > 0
        THEN ROUND((_admins_com_fator::numeric / _total_admins) * 100, 1) ELSE 0 END,
      'avg_hours_enroll', _avg_hours_enroll,
      'enforcement_started_at', _policy.enforcement_started_at,
      'deadline', CASE WHEN _policy.enforcement_started_at IS NULL THEN NULL
        ELSE _policy.enforcement_started_at + make_interval(days => _policy.grace_period_days) END,
      'grace_days', _policy.grace_period_days
    ),
    'intrusao', jsonb_build_object(
      'auth_falhas_24h', _auth_falhas_24h,
      'admin_op_rejeitadas_24h', _admin_rejeitados_24h
    ),
    'lgpd', jsonb_build_object(
      'purges_pendentes', _purges_pend,
      'purges_executadas_30d', _purges_exec_30d
    ),
    'termos', jsonb_build_object(
      'total_usuarios', _terms_total,
      'aceitos', _terms_aceitos,
      'pendentes', _terms_pendentes,
      'nova_versao_disponivel', _terms_nova
    ),
    'gerado_em', _now
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_conformidade_kpis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_conformidade_kpis() TO authenticated;