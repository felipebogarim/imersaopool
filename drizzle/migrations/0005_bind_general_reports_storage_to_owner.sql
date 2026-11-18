DROP POLICY IF EXISTS "general_reports_storage_all" ON storage.objects;

CREATE POLICY "general_reports_storage_all" ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'general-reports'
    AND EXISTS (
      SELECT 1 FROM public.general_reports r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND (r.created_by = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))
    )
  )
  WITH CHECK (
    bucket_id = 'general-reports'
    AND EXISTS (
      SELECT 1 FROM public.general_reports r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND (r.created_by = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))
    )
  );