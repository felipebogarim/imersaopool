
ALTER TABLE public.rep_performance_rows
  ADD COLUMN IF NOT EXISTS metas_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metas_cores  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS realizado    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS observacao   text,
  ADD COLUMN IF NOT EXISTS acompanhar   boolean NOT NULL DEFAULT false;

ALTER TABLE public.rep_performance_uploads
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS substituida_em timestamptz,
  ADD COLUMN IF NOT EXISTS substituida_por uuid REFERENCES public.rep_performance_uploads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'import';

CREATE INDEX IF NOT EXISTS idx_rep_perf_uploads_ativa
  ON public.rep_performance_uploads (representative_id, periodo_label)
  WHERE substituida_em IS NULL;
