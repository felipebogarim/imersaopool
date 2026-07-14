
-- 1. Session notes: restrict SELECT to same tenant
DROP POLICY IF EXISTS "Authenticated can read session notes" ON public.session_notes;
CREATE POLICY "Users can read session notes in their company"
ON public.session_notes FOR SELECT TO authenticated
USING (
  (entity_type = 'interview' AND EXISTS (
    SELECT 1 FROM public.interviews i
    WHERE i.id = session_notes.entity_id
      AND i.company_id = public.current_company_id()
  ))
  OR (entity_type = 'immersion' AND EXISTS (
    SELECT 1 FROM public.immersions im
    WHERE im.id = session_notes.entity_id
      AND im.company_id = public.current_company_id()
  ))
);

-- 2. Storage: product-images
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_auth_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_auth_update" ON storage.objects;
CREATE POLICY "product_images_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND owner = auth.uid())
WITH CHECK (bucket_id = 'product-images' AND owner = auth.uid());

DROP POLICY IF EXISTS "product_images_auth_delete" ON storage.objects;
CREATE POLICY "product_images_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND owner = auth.uid());

-- 3. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated/public.
-- These are trigger functions or internal helpers; they should not be callable via the API.
REVOKE ALL ON FUNCTION public.fanout_representative_input() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_ai_compilation_versao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_company_id_default() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_repinput_company() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_roteiro_perfil_company() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_sci_company() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_sessao_capitulo_company() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_perspectiva_conteudo() FROM PUBLIC, anon, authenticated;

-- current_company_id is used inside RLS; only authenticated needs it.
REVOKE ALL ON FUNCTION public.current_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;

-- Representative token functions must remain callable by anon (public link flow).
-- Tighten to only anon (and authenticated for parity); revoke PUBLIC.
REVOKE ALL ON FUNCTION public.get_immersion_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_immersion_by_token(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_representative_input(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_representative_input(text, jsonb) TO anon, authenticated;
