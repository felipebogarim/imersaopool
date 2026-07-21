ALTER TABLE public.gerador_performance_salvos
  ADD COLUMN IF NOT EXISTS categoria_metas JSONB NOT NULL DEFAULT '{}'::jsonb;