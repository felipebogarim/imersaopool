
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'action_plans','ai_compilations','attachments','clients','competitor_products',
    'entity_permissions','field_visit_inputs','immersions','interviews','own_products',
    'price_competitors','product_equivalences','representative_inputs','representatives'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id DROP NOT NULL', t);
  END LOOP;
END $$;
