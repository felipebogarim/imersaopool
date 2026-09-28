-- ============================================================
-- Price › Validação de Comparáveis / Comparativos Específicos
-- Grupos de comparação manuais (1 ou 2 concorrentes por linha),
-- que podem ser salvos como comparativo oficial (alimentando
-- public.price_equivalences, já usado por Mapa/Comparativos) e/ou
-- como comparativo específico (biblioteca própria, sem tocar a base
-- oficial). Reaproveita public.price_products / public.price_equivalences
-- em vez de duplicar o catálogo.
-- ============================================================

-- ============ GROUPS ============
CREATE TABLE public.price_comparison_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  name text NOT NULL,
  familia text NOT NULL,
  categoria text,
  base_brand text NOT NULL,
  base_price_table text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'finalizado')),
  destino text CHECK (destino IN ('oficial', 'especifico', 'oficial_e_especifico')),
  is_official boolean NOT NULL DEFAULT false,
  notes text,
  source_group_id uuid REFERENCES public.price_comparison_groups(id) ON DELETE SET NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  saved_official_at timestamptz,
  saved_specific_at timestamptz
);
CREATE INDEX price_comparison_groups_company_idx
  ON public.price_comparison_groups(company_id, familia, is_deleted);

GRANT SELECT, INSERT, UPDATE ON public.price_comparison_groups TO authenticated;
GRANT ALL ON public.price_comparison_groups TO service_role;
ALTER TABLE public.price_comparison_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_comparison_groups_read" ON public.price_comparison_groups FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "price_comparison_groups_insert" ON public.price_comparison_groups FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND created_by = auth.uid());
CREATE POLICY "price_comparison_groups_update" ON public.price_comparison_groups FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );

-- Só admin pode marcar um grupo como oficial (item 24: "Gestormaster: salvar como oficial").
CREATE OR REPLACE FUNCTION public.price_comparison_groups_guard_official()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_official IS TRUE AND (TG_OP = 'INSERT' OR OLD.is_official IS DISTINCT FROM NEW.is_official) THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Apenas administradores podem salvar um comparativo como oficial.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER price_comparison_groups_guard_official
  BEFORE INSERT OR UPDATE ON public.price_comparison_groups
  FOR EACH ROW EXECUTE FUNCTION public.price_comparison_groups_guard_official();

CREATE TRIGGER price_comparison_groups_updated
  BEFORE UPDATE ON public.price_comparison_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ GROUP ITEMS ============
CREATE TABLE public.price_comparison_group_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  group_id uuid NOT NULL REFERENCES public.price_comparison_groups(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,

  base_code text NOT NULL,
  base_brand text NOT NULL,
  base_product_id uuid REFERENCES public.price_products(id) ON DELETE SET NULL,
  base_price numeric,
  base_adjustment_percent numeric,

  two_competitors boolean NOT NULL DEFAULT false,

  competitor_a_brand text NOT NULL,
  competitor_a_code text NOT NULL,
  competitor_a_product_id uuid REFERENCES public.price_products(id) ON DELETE SET NULL,
  competitor_a_price numeric,
  competitor_a_price_table text,
  competitor_a_price_date date,
  competitor_a_region text,
  competitor_a_source text,
  competitor_a_adjustment_percent numeric,

  competitor_b_brand text,
  competitor_b_code text,
  competitor_b_product_id uuid REFERENCES public.price_products(id) ON DELETE SET NULL,
  competitor_b_price numeric,
  competitor_b_price_table text,
  competitor_b_price_date date,
  competitor_b_region text,
  competitor_b_source text,
  competitor_b_adjustment_percent numeric,

  status text NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise', 'validado', 'incompativel')),
  classification text CHECK (
    classification IN ('equivalente_direto', 'equivalente_aproximado', 'alternativo', 'incompativel')
  ),
  voltage_note text,
  notes text,
  specs_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_comparison_group_items_group_idx
  ON public.price_comparison_group_items(group_id, is_deleted);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_comparison_group_items TO authenticated;
GRANT ALL ON public.price_comparison_group_items TO service_role;
ALTER TABLE public.price_comparison_group_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_comparison_group_items_read" ON public.price_comparison_group_items FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "price_comparison_group_items_insert" ON public.price_comparison_group_items FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.price_comparison_groups g
      WHERE g.id = group_id
        AND g.company_id = public.current_company_id()
        AND (g.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY "price_comparison_group_items_update" ON public.price_comparison_group_items FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.price_comparison_groups g
        WHERE g.id = group_id AND g.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "price_comparison_group_items_delete" ON public.price_comparison_group_items FOR DELETE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.price_comparison_groups g
        WHERE g.id = group_id AND g.created_by = auth.uid()
      )
    )
  );

CREATE TRIGGER price_comparison_group_items_updated
  BEFORE UPDATE ON public.price_comparison_group_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ AUDIT LOG ============
CREATE TABLE public.price_comparison_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  group_id uuid REFERENCES public.price_comparison_groups(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.price_comparison_group_items(id) ON DELETE SET NULL,
  action text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_comparison_audit_log_group_idx
  ON public.price_comparison_audit_log(group_id, created_at DESC);

GRANT SELECT, INSERT ON public.price_comparison_audit_log TO authenticated;
GRANT ALL ON public.price_comparison_audit_log TO service_role;
ALTER TABLE public.price_comparison_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_comparison_audit_log_read" ON public.price_comparison_audit_log FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "price_comparison_audit_log_insert" ON public.price_comparison_audit_log FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid());

-- ============ LINK TO OFFICIAL EQUIVALENCES ============
-- Permite rastrear de qual grupo/estudo uma equivalência oficial se originou,
-- e distinguir relações que vieram do mesmo par base×2-concorrentes.
ALTER TABLE public.price_equivalences
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.price_comparison_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS relation_context text;
CREATE INDEX IF NOT EXISTS price_equivalences_group_idx ON public.price_equivalences(group_id);

-- ============ NAV PERMISSIONS ============
-- Mesmo padrão de acesso já usado por "price.comparativos": gestor/agente veem,
-- comercial não (only ferramentas.* no seed original); admin bypassa via isAdmin.
INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT r.role, k.nav_key, CASE WHEN r.role = 'comercial' THEN false ELSE true END
FROM (VALUES ('gestor'::public.app_role), ('agente'::public.app_role), ('comercial'::public.app_role)) AS r(role)
CROSS JOIN (VALUES ('price.validacao'), ('price.comparativos-especificos')) AS k(nav_key)
ON CONFLICT (role, nav_key) DO NOTHING;
