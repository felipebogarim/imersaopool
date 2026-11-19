-- Link público do Relatório Geral: token aleatório (não adivinhável), revogável.
-- Leitura pública só pelo servidor (service role) via token; RLS da tabela não muda.
ALTER TABLE public.general_reports
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS general_reports_share_token_key
  ON public.general_reports(share_token) WHERE share_token IS NOT NULL;
NOTIFY pgrst, 'reload schema';
