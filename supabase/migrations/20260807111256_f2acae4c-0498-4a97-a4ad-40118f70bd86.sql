-- 1. entrevistas-anexos: restrict cross-tenant read
DROP POLICY IF EXISTS "entrevistas_anexos_read" ON storage.objects;
CREATE POLICY "entrevistas_anexos_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'entrevistas-anexos'
  AND (
    public.is_admin_or_gestor(auth.uid())
    OR auth.uid() = owner
    OR EXISTS (
      SELECT 1 FROM public.attachments a
      JOIN public.interviews i ON i.id = a.entity_id
      WHERE a.storage_path = storage.objects.name
        AND a.entity_type = 'interview'
        AND (
          i.created_by = auth.uid()
          OR (i.company_id IS NOT NULL AND i.company_id = public.current_company_id())
        )
    )
  )
);

-- 2. manuais bucket: ownership checks
DROP POLICY IF EXISTS "Manuais: autenticados leem arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Manuais: autenticados enviam arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Manuais: autenticados removem arquivos" ON storage.objects;

CREATE POLICY "manuais_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'manuais'
  AND (
    public.is_admin_or_gestor(auth.uid())
    OR auth.uid() = owner
    OR EXISTS (
      SELECT 1 FROM public.manuais m
      WHERE m.pdf_path = storage.objects.name
        AND (m.publicado = true OR m.created_by = auth.uid())
    )
  )
);

CREATE POLICY "manuais_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'manuais' AND auth.uid() = owner);

CREATE POLICY "manuais_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'manuais' AND (auth.uid() = owner OR public.is_admin_or_gestor(auth.uid())))
WITH CHECK (bucket_id = 'manuais' AND (auth.uid() = owner OR public.is_admin_or_gestor(auth.uid())));

CREATE POLICY "manuais_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'manuais' AND (auth.uid() = owner OR public.is_admin_or_gestor(auth.uid())));

-- 3. mapa_familia_versoes: writes restricted to admin/gestor
DROP POLICY IF EXISTS "Autenticados gerenciam mapa de familias" ON public.mapa_familia_versoes;
DROP POLICY IF EXISTS "Autenticados leem mapa de familias" ON public.mapa_familia_versoes;

CREATE POLICY "mapa_familias_read" ON public.mapa_familia_versoes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "mapa_familias_insert" ON public.mapa_familia_versoes
FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor(auth.uid()));

CREATE POLICY "mapa_familias_update" ON public.mapa_familia_versoes
FOR UPDATE TO authenticated
USING (public.is_admin_or_gestor(auth.uid()))
WITH CHECK (public.is_admin_or_gestor(auth.uid()));

CREATE POLICY "mapa_familias_delete" ON public.mapa_familia_versoes
FOR DELETE TO authenticated USING (public.is_admin_or_gestor(auth.uid()));

-- 4. SECURITY DEFINER functions: remove direct EXECUTE where not needed
REVOKE EXECUTE ON FUNCTION public.rep_perf_restore_on_delete() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reactivate_last_performance_upload(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_active_form_by_slug(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_active_form_by_slug(text) TO anon;
