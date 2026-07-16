
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.client_bi_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id uuid NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  razao_social text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('bi','familias')),
  periodo_label text,
  filename text,
  data jsonb NOT NULL,
  substituida_em timestamptz,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_bi_lookup
  ON public.client_bi_uploads (representative_id, razao_social, kind, substituida_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_bi_uploads TO authenticated;
GRANT ALL ON public.client_bi_uploads TO service_role;

ALTER TABLE public.client_bi_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_bi_uploads_company_scope"
  ON public.client_bi_uploads
  FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

CREATE TRIGGER trg_client_bi_uploads_updated_at
  BEFORE UPDATE ON public.client_bi_uploads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
