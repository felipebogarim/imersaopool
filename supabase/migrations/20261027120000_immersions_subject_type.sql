-- Imersões podem pertencer a um cliente da base ou a um parceiro especificador
-- (arquiteto, light designer, outro). Parceiros não são clientes: client_id fica nulo.
-- A coluna client_id passa a aceitar NULL, mas o CHECK de consistência exige
-- client_id para imersões de cliente e o proíbe para imersões de parceiro.
-- A chave estrangeira immersions_client_id_fkey e as políticas de acesso não são alteradas.
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

-- Cliente: client_id obrigatório e sem tipo de parceiro.
-- Parceiro: sem cliente, com tipo e com nome não vazio.
ALTER TABLE public.immersions DROP CONSTRAINT IF EXISTS immersions_subject_consistency_check;
ALTER TABLE public.immersions ADD CONSTRAINT immersions_subject_consistency_check
  CHECK (
    (
      subject_type = 'client'
      AND client_id IS NOT NULL
      AND partner_type IS NULL
    )
    OR (
      subject_type = 'partner'
      AND client_id IS NULL
      AND partner_type IS NOT NULL
      AND btrim(coalesce(partner_name, '')) <> ''
    )
  );

CREATE INDEX IF NOT EXISTS idx_imm_subject_type ON public.immersions(subject_type);

-- Faz o PostgREST reconhecer as novas colunas imediatamente (evita "column not found in schema cache").
NOTIFY pgrst, 'reload schema';
