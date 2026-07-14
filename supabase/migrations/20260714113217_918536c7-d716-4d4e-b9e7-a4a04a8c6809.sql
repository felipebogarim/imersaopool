
CREATE TABLE public.rep_performance_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  representative_id UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  periodo_label TEXT NOT NULL,
  periodo_inicio DATE,
  periodo_fim DATE,
  familias TEXT[] NOT NULL DEFAULT '{}',
  categoria_metas JSONB NOT NULL DEFAULT '{}'::jsonb,
  escala_percentual JSONB NOT NULL DEFAULT '[]'::jsonb,
  filename TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rep_perf_uploads_company_idx ON public.rep_performance_uploads(company_id);
CREATE INDEX rep_perf_uploads_rep_idx ON public.rep_performance_uploads(representative_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_performance_uploads TO authenticated;
GRANT ALL ON public.rep_performance_uploads TO service_role;
ALTER TABLE public.rep_performance_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rep_perf_uploads_company_scope"
  ON public.rep_performance_uploads
  FOR ALL
  TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

CREATE TRIGGER trg_rep_perf_uploads_updated_at
  BEFORE UPDATE ON public.rep_performance_uploads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_rep_perf_uploads_company
  BEFORE INSERT ON public.rep_performance_uploads
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();


CREATE TABLE public.rep_performance_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  upload_id UUID NOT NULL REFERENCES public.rep_performance_uploads(id) ON DELETE CASCADE,
  ordem INT NOT NULL DEFAULT 0,
  razao_social TEXT NOT NULL,
  categoria TEXT,
  metas JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_meta NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rep_perf_rows_upload_idx ON public.rep_performance_rows(upload_id);
CREATE INDEX rep_perf_rows_company_idx ON public.rep_performance_rows(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_performance_rows TO authenticated;
GRANT ALL ON public.rep_performance_rows TO service_role;
ALTER TABLE public.rep_performance_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rep_perf_rows_company_scope"
  ON public.rep_performance_rows
  FOR ALL
  TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

CREATE OR REPLACE FUNCTION public.set_rep_perf_row_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.rep_performance_uploads WHERE id = NEW.upload_id;
  END IF;
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Upload sem empresa vinculada.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rep_perf_rows_company
  BEFORE INSERT ON public.rep_performance_rows
  FOR EACH ROW EXECUTE FUNCTION public.set_rep_perf_row_company();
