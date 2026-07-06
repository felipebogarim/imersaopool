
TRUNCATE public.action_plans, public.ai_compilations, public.attachments, public.clients,
  public.competitor_products, public.entity_permissions, public.field_visit_inputs,
  public.immersions, public.interviews, public.own_products, public.price_competitors,
  public.product_equivalences, public.representative_inputs, public.representatives CASCADE;

CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER companies_touch BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN active_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE POLICY companies_admin_all ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY companies_member_select ON public.companies FOR SELECT TO authenticated
  USING (id IN (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid() AND p.company_id IS NOT NULL));

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT active_company_id FROM public.profiles WHERE id = auth.uid()
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'action_plans','ai_compilations','attachments','clients','competitor_products',
    'entity_permissions','field_visit_inputs','immersions','interviews','own_products',
    'price_competitors','product_equivalences','representative_inputs','representatives'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE', t);
    EXECUTE format('CREATE INDEX %I ON public.%I(company_id)', t||'_company_idx', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.set_company_id_default()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.current_company_id();
  END IF;
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa ativa selecionada. Escolha uma empresa antes de continuar.';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'action_plans','ai_compilations','attachments','clients','competitor_products',
    'entity_permissions','field_visit_inputs','immersions','interviews','own_products',
    'price_competitors','product_equivalences','representatives'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default()',
      'trg_'||t||'_set_company', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.set_repinput_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.immersions WHERE id = NEW.immersion_id;
  END IF;
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Imersão sem empresa vinculada.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_repinput_set_company BEFORE INSERT ON public.representative_inputs
  FOR EACH ROW EXECUTE FUNCTION public.set_repinput_company();

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND tablename IN (
      'action_plans','ai_compilations','attachments','clients','competitor_products',
      'entity_permissions','field_visit_inputs','immersions','interviews','own_products',
      'price_competitors','product_equivalences','representative_inputs','representatives'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'action_plans','ai_compilations','attachments','clients','competitor_products',
    'entity_permissions','field_visit_inputs','immersions','interviews','own_products',
    'price_competitors','product_equivalences','representatives','representative_inputs'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR ALL TO authenticated
        USING (company_id = public.current_company_id())
        WITH CHECK (company_id = public.current_company_id())
    $f$, t||'_company_scope', t);
  END LOOP;
END $$;
