ALTER TABLE public.rep_performance_uploads
  ADD COLUMN IF NOT EXISTS participacao jsonb,
  ADD COLUMN IF NOT EXISTS atingimento jsonb;