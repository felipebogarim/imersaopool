
-- RPC to log auth failures (callable by anon)
CREATE OR REPLACE FUNCTION public.log_auth_failure(_email text, _reason text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _recent int;
  _nivel text := 'medio';
BEGIN
  -- Heurística: >5 falhas do mesmo e-mail em 15min => suspeito/alto
  SELECT count(*) INTO _recent
  FROM public.security_events
  WHERE tipo = 'auth.login'
    AND resultado = 'falha'
    AND usuario_email = _email
    AND ocorrido_em > now() - interval '15 minutes';

  IF _recent >= 10 THEN _nivel := 'critico';
  ELSIF _recent >= 5 THEN _nivel := 'alto';
  END IF;

  INSERT INTO public.security_events (tipo, categoria, usuario_email, acao, resultado, nivel_risco, metadata)
  VALUES (
    'auth.login',
    'autenticacao',
    _email,
    'signin',
    'falha',
    _nivel,
    coalesce(_metadata, '{}'::jsonb) || jsonb_build_object('reason', _reason, 'recent_15min', _recent)
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_auth_failure(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_auth_failure(text, text, jsonb) TO anon, authenticated;

-- RPC to log sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_access(
  _recurso text,
  _acao text,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _nivel_risco text DEFAULT 'medio'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.security_events (tipo, categoria, usuario_id, usuario_email, recurso, acao, resultado, nivel_risco, metadata)
  VALUES (
    'data.sensitive_access',
    'dados_sensiveis',
    auth.uid(),
    _email,
    _recurso,
    _acao,
    'sucesso',
    coalesce(_nivel_risco, 'medio'),
    coalesce(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_sensitive_access(text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_sensitive_access(text, text, jsonb, text) TO authenticated, service_role;

-- Aggregation for intrusion monitor (admin-only)
CREATE OR REPLACE FUNCTION public.sec_intrusion_summary(_hours int DEFAULT 24)
RETURNS TABLE(
  bucket text,
  chave text,
  total bigint,
  ultimo timestamptz,
  nivel_max text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT 'email'::text AS bucket,
         coalesce(usuario_email, '(anônimo)') AS chave,
         count(*)::bigint AS total,
         max(ocorrido_em) AS ultimo,
         (ARRAY_AGG(nivel_risco ORDER BY
            CASE nivel_risco WHEN 'critico' THEN 1 WHEN 'alto' THEN 2 WHEN 'medio' THEN 3 WHEN 'baixo' THEN 4 ELSE 5 END
         ))[1] AS nivel_max
  FROM public.security_events
  WHERE ocorrido_em > now() - make_interval(hours => _hours)
    AND (resultado IN ('falha','bloqueado','suspeito') OR nivel_risco IN ('alto','critico'))
  GROUP BY coalesce(usuario_email, '(anônimo)')
  ORDER BY total DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.sec_intrusion_summary(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sec_intrusion_summary(int) TO authenticated;
