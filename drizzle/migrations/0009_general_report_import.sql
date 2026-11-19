-- Relatório Geral: importação de relatório pronto (JSON validado + PDF original).
-- Mesmo RLS e mesmo bucket privado 'general-reports' de antes: nada vira público por padrão.
ALTER TABLE public.general_reports
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ia',
  ADD COLUMN IF NOT EXISTS import_data jsonb,
  ADD COLUMN IF NOT EXISTS import_pdf_path text,
  ADD COLUMN IF NOT EXISTS import_pdf_name text,
  ADD COLUMN IF NOT EXISTS import_pdf_sha256 text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'general_reports_source_check'
  ) THEN
    ALTER TABLE public.general_reports
      ADD CONSTRAINT general_reports_source_check CHECK (source IN ('ia', 'importado'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';