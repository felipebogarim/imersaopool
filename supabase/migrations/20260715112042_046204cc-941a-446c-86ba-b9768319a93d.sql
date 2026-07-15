
-- 1) Revoke EXECUTE on trigger / internal SECURITY DEFINER functions from anon, authenticated, PUBLIC.
--    These are used only by triggers and must not be exposed via PostgREST RPC.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.fanout_representative_input()',
    'public.handle_new_user()',
    'public.set_ai_compilation_versao()',
    'public.set_company_id_default()',
    'public.set_rep_perf_row_company()',
    'public.set_repinput_company()',
    'public.set_roteiro_perfil_company()',
    'public.set_sci_company()',
    'public.set_sessao_capitulo_company()',
    'public.validate_perspectiva_conteudo()',
    'public.touch_updated_at()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

-- 2) Drop unused staging table (RLS enabled but no policies, no company scoping).
DROP TABLE IF EXISTS public._image_url_staging2;

-- 3) Tighten product-images storage policies: scope to owner or same-company members.
DROP POLICY IF EXISTS "product_images_auth_read" ON storage.objects;
DROP POLICY IF EXISTS "product_images_auth_write" ON storage.objects;

CREATE POLICY "product_images_company_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    owner = auth.uid()
    OR public.is_admin_or_gestor(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.own_products op
      JOIN public.profiles pr ON pr.active_company_id = op.company_id
      WHERE pr.id = auth.uid()
        AND op.imagem_url IS NOT NULL
        AND position(storage.objects.name in op.imagem_url) > 0
    )
  )
);

CREATE POLICY "product_images_company_write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND owner = auth.uid()
  AND public.current_company_id() IS NOT NULL
);
