ALTER TABLE public.capitulos
  ADD COLUMN IF NOT EXISTS pergunta_abertura text,
  ADD COLUMN IF NOT EXISTS pontos_escuta text[];