ALTER TABLE public.representatives ADD COLUMN IF NOT EXISTS representacao text;

UPDATE public.representatives
SET representacao = trim(both ' ' from split_part(split_part(observacoes, 'Representação:', 2), '|', 1))
WHERE representacao IS NULL AND observacoes ILIKE '%Representação:%';