-- Price › Equivalências: base oficial de equivalências Newline/Standard/Studio × concorrentes.
-- Migration incremental sobre public.price_equivalences (sem tabelas novas):
--   origin           — de onde veio a relação (persistida, nunca inferida pelo frontend)
--   relation_status  — estado do ciclo de vida da equivalência (pt-BR, independente do enum legado `status`)
--   created_by       — usuário que criou a relação
-- `status` (enum legado em_analise/validado/incompativel) continua sendo gravado pelo código
-- para não quebrar Comparativos/Mapa. "Sem equivalência" é um estado derivado: produto base sem linha ativa.

ALTER TABLE public.price_equivalences
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS relation_status text,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

-- Backfill das linhas existentes.
UPDATE public.price_equivalences
SET relation_status = CASE
      WHEN status = 'validado' THEN 'validada'
      WHEN status = 'incompativel' THEN 'rejeitada'
      WHEN manually_edited THEN 'em_revisao'
      ELSE 'sugestao_sistema'
    END
WHERE relation_status IS NULL;

UPDATE public.price_equivalences
SET origin = CASE
      WHEN group_id IS NOT NULL THEN 'comparables_validation'
      WHEN manually_edited OR validated_by IS NOT NULL THEN 'admin_manual'
      ELSE 'system_suggestion'
    END
WHERE origin IS NULL;

ALTER TABLE public.price_equivalences
  ALTER COLUMN origin SET DEFAULT 'system_suggestion',
  ALTER COLUMN origin SET NOT NULL,
  ALTER COLUMN relation_status SET DEFAULT 'sugestao_sistema',
  ALTER COLUMN relation_status SET NOT NULL;

ALTER TABLE public.price_equivalences
  DROP CONSTRAINT IF EXISTS price_equivalences_origin_check,
  ADD CONSTRAINT price_equivalences_origin_check
    CHECK (origin IN ('system_suggestion', 'admin_manual', 'comparables_validation')),
  DROP CONSTRAINT IF EXISTS price_equivalences_relation_status_check,
  ADD CONSTRAINT price_equivalences_relation_status_check
    CHECK (relation_status IN ('sugestao_sistema', 'validada', 'rejeitada', 'em_revisao'));

CREATE INDEX IF NOT EXISTS price_equivalences_relation_status_idx
  ON public.price_equivalences(relation_status) WHERE is_deleted = false;

-- ============ NAV PERMISSIONS ============
-- Mesmo padrão de price.validacao: gestor/agente veem, comercial não; admin bypassa.
INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT r.role, 'price.equivalencias', CASE WHEN r.role = 'comercial' THEN false ELSE true END
FROM (VALUES ('gestor'::public.app_role), ('agente'::public.app_role), ('comercial'::public.app_role)) AS r(role)
ON CONFLICT (role, nav_key) DO NOTHING;
