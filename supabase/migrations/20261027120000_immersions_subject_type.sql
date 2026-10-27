-- Imersões podem pertencer a um cliente da base ou a um parceiro especificador
-- (arquiteto, light designer, outro). Parceiros não são clientes: client_id fica nulo.
ALTER TABLE public.immersions
  ALTER COLUMN client_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS subject_type text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS partner_name text,
  ADD COLUMN IF NOT EXISTS partner_type text,
  ADD COLUMN IF NOT EXISTS partner_type_label text,
  ADD COLUMN IF NOT EXISTS partner_description text,
  ADD COLUMN IF NOT EXISTS partner_details jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.immersions DROP CONSTRAINT IF EXISTS immersions_subject_type_check;
ALTER TABLE public.immersions ADD CONSTRAINT immersions_subject_type_check
  CHECK (subject_type IN ('client', 'partner'));

ALTER TABLE public.immersions DROP CONSTRAINT IF EXISTS immersions_partner_type_check;
ALTER TABLE public.immersions ADD CONSTRAINT immersions_partner_type_check
  CHECK (partner_type IS NULL OR partner_type IN ('arquiteto', 'light_designer', 'outro'));

-- Parceiro: sem cliente e com identificação. Cliente: sem dados de parceiro.
-- (A obrigatoriedade de client_id para subject_type = 'client' é regra de aplicação,
-- pois há registros legados que não a respeitam.)
ALTER TABLE public.immersions DROP CONSTRAINT IF EXISTS immersions_subject_consistency_check;
ALTER TABLE public.immersions ADD CONSTRAINT immersions_subject_consistency_check
  CHECK (
    (subject_type = 'client' AND partner_type IS NULL)
    OR (
      subject_type = 'partner'
      AND client_id IS NULL
      AND partner_type IS NOT NULL
      AND btrim(coalesce(partner_name, '')) <> ''
    )
  );

CREATE INDEX IF NOT EXISTS idx_imm_subject_type ON public.immersions(subject_type);
