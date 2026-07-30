CREATE TABLE public.visao_rep_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  representative_id uuid REFERENCES public.representatives(id) ON DELETE SET NULL,
  representative_name text NOT NULL,
  region text,
  creation_mode text NOT NULL DEFAULT 'ai_generated' CHECK (creation_mode IN ('ai_generated','imported_ready')),
  schema_version text NOT NULL DEFAULT 'visao_rep.v2',
  titulo text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_file_name text,
  source_file_kept boolean NOT NULL DEFAULT false,
  content_hash text,
  created_by uuid,
  imported_by uuid,
  import_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visao_rep_reports TO authenticated;
GRANT ALL ON public.visao_rep_reports TO service_role;

ALTER TABLE public.visao_rep_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visao_rep_reports_company" ON public.visao_rep_reports
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

CREATE INDEX idx_visao_rep_reports_lookup ON public.visao_rep_reports (company_id, representative_id, created_at DESC);

CREATE TRIGGER visao_rep_reports_company_default BEFORE INSERT ON public.visao_rep_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER visao_rep_reports_touch BEFORE UPDATE ON public.visao_rep_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();