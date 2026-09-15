ALTER TABLE public.executive_reports
  ADD COLUMN IF NOT EXISTS layout_version text,
  ADD COLUMN IF NOT EXISTS executive_summary text,
  ADD COLUMN IF NOT EXISTS executive_topics jsonb NOT NULL DEFAULT '[]'::jsonb;