
-- ============ SECURITY AUDITS ============
CREATE TABLE public.security_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  iniciado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  escopo text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'executando' CHECK (status IN ('executando','concluida','erro')),
  indice_seguranca int,
  total_checks int DEFAULT 0,
  checks_ok int DEFAULT 0,
  checks_atencao int DEFAULT 0,
  checks_critico int DEFAULT 0,
  checks_nao_verificado int DEFAULT 0,
  duracao_ms int,
  resultado jsonb DEFAULT '{}'::jsonb,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_audits TO authenticated;
GRANT ALL ON public.security_audits TO service_role;
ALTER TABLE public.security_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all security_audits" ON public.security_audits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service_role security_audits" ON public.security_audits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_security_audits_iniciado_em ON public.security_audits(iniciado_em DESC);

-- ============ SECURITY AUDIT CHECKS ============
CREATE TABLE public.security_audit_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.security_audits(id) ON DELETE CASCADE,
  chave text NOT NULL,
  categoria text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL CHECK (status IN ('ok','atencao','critico','nao_verificado','nao_implementado')),
  severidade text NOT NULL DEFAULT 'info' CHECK (severidade IN ('critico','alto','medio','baixo','info')),
  evidencia jsonb DEFAULT '{}'::jsonb,
  recomendacao text,
  peso int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_audit_checks TO authenticated;
GRANT ALL ON public.security_audit_checks TO service_role;
ALTER TABLE public.security_audit_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all security_audit_checks" ON public.security_audit_checks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service_role security_audit_checks" ON public.security_audit_checks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_security_audit_checks_audit_id ON public.security_audit_checks(audit_id);

-- ============ SECURITY EVENTS (log) ============
CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL,
  categoria text,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_email text,
  recurso text,
  acao text,
  resultado text CHECK (resultado IS NULL OR resultado IN ('sucesso','falha','bloqueado','suspeito')),
  ip text,
  user_agent text,
  sessao_id text,
  correlation_id uuid,
  nivel_risco text DEFAULT 'info' CHECK (nivel_risco IN ('critico','alto','medio','baixo','info')),
  metadata jsonb DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
-- admin lê tudo
CREATE POLICY "admin select security_events" ON public.security_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
-- usuário autenticado só pode inserir eventos com seu próprio user_id (ou NULL para eventos anônimos do sistema)
CREATE POLICY "auth insert own security_events" ON public.security_events FOR INSERT TO authenticated
  WITH CHECK (usuario_id IS NULL OR usuario_id = auth.uid());
CREATE POLICY "service_role security_events" ON public.security_events FOR ALL TO service_role USING (true) WITH CHECK (true);
-- ninguém (exceto service_role) pode atualizar ou deletar → log protegido
CREATE INDEX idx_security_events_ocorrido_em ON public.security_events(ocorrido_em DESC);
CREATE INDEX idx_security_events_tipo ON public.security_events(tipo);
CREATE INDEX idx_security_events_usuario_id ON public.security_events(usuario_id);
CREATE INDEX idx_security_events_nivel_risco ON public.security_events(nivel_risco);

-- função utilitária para gravar eventos (definer para permitir insert padronizado)
CREATE OR REPLACE FUNCTION public.log_security_event(
  _tipo text,
  _acao text DEFAULT NULL,
  _recurso text DEFAULT NULL,
  _resultado text DEFAULT 'sucesso',
  _nivel_risco text DEFAULT 'info',
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _uid uuid;
  _email text;
BEGIN
  _uid := auth.uid();
  IF _uid IS NOT NULL THEN
    SELECT email INTO _email FROM auth.users WHERE id = _uid;
  END IF;
  INSERT INTO public.security_events (tipo, acao, recurso, resultado, nivel_risco, usuario_id, usuario_email, metadata)
  VALUES (_tipo, _acao, _recurso, _resultado, _nivel_risco, _uid, _email, COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.log_security_event(text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_event(text,text,text,text,text,jsonb) TO authenticated, service_role;

-- ============ SECURITY RISKS ============
CREATE TABLE public.security_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  categoria text NOT NULL,
  origem text,
  sistema_afetado text,
  dados_afetados text,
  probabilidade text CHECK (probabilidade IN ('rara','baixa','media','alta','muito_alta')),
  impacto text CHECK (impacto IN ('insignificante','baixo','medio','alto','critico')),
  gravidade text NOT NULL DEFAULT 'medio' CHECK (gravidade IN ('critico','alto','medio','baixo','info')),
  evidencias jsonb DEFAULT '[]'::jsonb,
  recomendacao text,
  responsavel uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prazo date,
  status text NOT NULL DEFAULT 'identificado' CHECK (status IN ('identificado','em_analise','correcao_planejada','em_correcao','aguardando_validacao','corrigido','risco_aceito','nao_aplicavel')),
  data_identificacao timestamptz NOT NULL DEFAULT now(),
  data_correcao timestamptz,
  validacao_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  validacao_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_risks TO authenticated;
GRANT ALL ON public.security_risks TO service_role;
ALTER TABLE public.security_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all security_risks" ON public.security_risks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service_role security_risks" ON public.security_risks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_security_risks_updated BEFORE UPDATE ON public.security_risks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SECURITY INCIDENTS ============
CREATE SEQUENCE IF NOT EXISTS public.security_incident_num_seq;
CREATE TABLE public.security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero int NOT NULL DEFAULT nextval('public.security_incident_num_seq') UNIQUE,
  titulo text NOT NULL,
  descricao text,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  origem text,
  categoria text,
  gravidade text NOT NULL DEFAULT 'medio' CHECK (gravidade IN ('critico','alto','medio','baixo','info')),
  usuarios_afetados jsonb DEFAULT '[]'::jsonb,
  organizacoes_afetadas jsonb DEFAULT '[]'::jsonb,
  dados_afetados text,
  sistemas_afetados text,
  evidencias jsonb DEFAULT '[]'::jsonb,
  responsavel uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contencao text,
  causa text,
  plano_correcao text,
  comunicacoes text,
  status text NOT NULL DEFAULT 'detectado' CHECK (status IN ('detectado','em_investigacao','contido','em_correcao','em_monitoramento','encerrado')),
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_incidents TO authenticated;
GRANT ALL ON public.security_incidents TO service_role;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all security_incidents" ON public.security_incidents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service_role security_incidents" ON public.security_incidents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_security_incidents_updated BEFORE UPDATE ON public.security_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SECURITY SETTINGS (singleton) ============
CREATE TABLE public.security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_timeout_minutes int NOT NULL DEFAULT 60,
  max_upload_mb int NOT NULL DEFAULT 20,
  extensoes_permitidas text[] NOT NULL DEFAULT ARRAY['xlsx','xls','csv','pdf','png','jpg','jpeg']::text[],
  link_expiration_seconds int NOT NULL DEFAULT 60,
  retention_days int NOT NULL DEFAULT 365,
  max_login_attempts int NOT NULL DEFAULT 5,
  mfa_required_admin boolean NOT NULL DEFAULT false,
  min_password_length int NOT NULL DEFAULT 8,
  alert_emails text[] NOT NULL DEFAULT ARRAY[]::text[],
  log_retention_days int NOT NULL DEFAULT 365,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_settings TO authenticated;
GRANT ALL ON public.security_settings TO service_role;
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all security_settings" ON public.security_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service_role security_settings" ON public.security_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_security_settings_updated BEFORE UPDATE ON public.security_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- linha default
INSERT INTO public.security_settings DEFAULT VALUES;
