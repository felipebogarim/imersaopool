
-- backup_config (singleton)
CREATE TABLE public.backup_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_backup boolean NOT NULL DEFAULT true,
  frequencia text NOT NULL DEFAULT 'diaria' CHECK (frequencia IN ('diaria','semanal','mensal')),
  retencao_dias int NOT NULL DEFAULT 30,
  limite_gb int NOT NULL DEFAULT 100,
  github_repo text,
  github_branch text NOT NULL DEFAULT 'main',
  horario_execucao time NOT NULL DEFAULT '03:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_config TO authenticated;
GRANT ALL ON public.backup_config TO service_role;
ALTER TABLE public.backup_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin full backup_config" ON public.backup_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service role backup_config" ON public.backup_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_backup_config_updated BEFORE UPDATE ON public.backup_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.backup_config DEFAULT VALUES;

-- backup_jobs
CREATE TABLE public.backup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('json','completo','arquivos','codigo')),
  status text NOT NULL DEFAULT 'executando' CHECK (status IN ('executando','ok','erro')),
  tamanho_bytes bigint,
  storage_path text,
  iniciado_por uuid,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','auto')),
  erro text,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_jobs TO authenticated;
GRANT ALL ON public.backup_jobs TO service_role;
ALTER TABLE public.backup_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin full backup_jobs" ON public.backup_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service role backup_jobs" ON public.backup_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_backup_jobs_tipo_status_created ON public.backup_jobs (tipo, status, created_at DESC);

-- backup_historico
CREATE TABLE public.backup_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_label text,
  operacao text NOT NULL,
  resultado text NOT NULL DEFAULT 'ok' CHECK (resultado IN ('ok','atencao','critico')),
  detalhe text,
  job_id uuid REFERENCES public.backup_jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_historico TO authenticated;
GRANT ALL ON public.backup_historico TO service_role;
ALTER TABLE public.backup_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin full backup_historico" ON public.backup_historico FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service role backup_historico" ON public.backup_historico FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_backup_historico_created ON public.backup_historico (created_at DESC);

-- backup_auditoria
CREATE TABLE public.backup_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('ok','atencao','critico')),
  graves int NOT NULL DEFAULT 0,
  medios int NOT NULL DEFAULT 0,
  baixos int NOT NULL DEFAULT 0,
  relatorio jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_auditoria TO authenticated;
GRANT ALL ON public.backup_auditoria TO service_role;
ALTER TABLE public.backup_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin full backup_auditoria" ON public.backup_auditoria FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "service role backup_auditoria" ON public.backup_auditoria FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_backup_auditoria_created ON public.backup_auditoria (created_at DESC);

-- Cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule('backup-json-diario','0 3 * * *', $$
  SELECT net.http_post(
    url:='https://project--0e829ab7-1b02-45eb-9c72-0f5879d5ecad.lovable.app/api/public/backup-run',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmY3ZyY2pieml2dXpmZHBtenFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDM4MjAsImV4cCI6MjA5Nzg3OTgyMH0.lJvxmYKOlaCa0SUNpT4xrIfvwGAL8KiJ-B7Q33Ea2BE"}'::jsonb,
    body:='{"tipo":"json","origem":"auto"}'::jsonb);
$$);

SELECT cron.schedule('backup-auditoria-semanal','0 4 * * 0', $$
  SELECT net.http_post(
    url:='https://project--0e829ab7-1b02-45eb-9c72-0f5879d5ecad.lovable.app/api/public/backup-audit',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmY3ZyY2pieml2dXpmZHBtenFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDM4MjAsImV4cCI6MjA5Nzg3OTgyMH0.lJvxmYKOlaCa0SUNpT4xrIfvwGAL8KiJ-B7Q33Ea2BE"}'::jsonb,
    body:='{}'::jsonb);
$$);
