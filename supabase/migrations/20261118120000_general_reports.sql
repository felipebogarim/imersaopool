-- Relatório Geral (Imersões): representante + data, arquivos de vários tipos lidos por IA
-- e um relatório em capítulos/blocos (JSON) que se adapta ao material enviado.
CREATE TABLE IF NOT EXISTS public.general_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id uuid REFERENCES public.representatives(id) ON DELETE SET NULL,
  report_date date NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'gerando', 'pronto', 'erro')),
  report jsonb,
  error_message text,
  generated_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.general_report_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.general_reports(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  kind text NOT NULL DEFAULT 'outro',
  status text NOT NULL DEFAULT 'enviado'
    CHECK (status IN ('enviado', 'processando', 'lido', 'erro')),
  extracted jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_general_reports_created ON public.general_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_general_report_files_report ON public.general_report_files(report_id);

ALTER TABLE public.general_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_report_files ENABLE ROW LEVEL SECURITY;

-- Dono do relatório ou admin.
CREATE POLICY "general_reports_all" ON public.general_reports FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "general_report_files_all" ON public.general_report_files FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.general_reports r WHERE r.id = report_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.general_reports r WHERE r.id = report_id));

-- Bucket privado; o primeiro segmento do caminho é o id do relatório.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('general-reports', 'general-reports', false, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "general_reports_storage_all" ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'general-reports'
    AND EXISTS (
      SELECT 1 FROM public.general_reports r
      WHERE r.id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'general-reports'
    AND EXISTS (
      SELECT 1 FROM public.general_reports r
      WHERE r.id::text = (storage.foldername(name))[1]
    )
  );

-- Acesso ao menu: mesmo padrão das demais análises (gestor/agente veem, comercial não).
INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT r.role, 'analises.relatorio-geral', CASE WHEN r.role = 'comercial' THEN false ELSE true END
FROM (VALUES ('gestor'::public.app_role), ('agente'::public.app_role), ('comercial'::public.app_role)) AS r(role)
ON CONFLICT (role, nav_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
