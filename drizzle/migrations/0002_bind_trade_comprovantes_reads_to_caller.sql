DROP POLICY IF EXISTS "trade_comprovantes_select" ON storage.objects;
CREATE POLICY "trade_comprovantes_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'trade-comprovantes' AND (
      owner_id = (SELECT auth.uid()::text)
      OR EXISTS (
        SELECT 1
        FROM public.trade_investments ti
        JOIN public.profiles p ON p.id = (SELECT auth.uid())
        WHERE ti.anexo_path = storage.objects.name
          AND p.active_company_id IS NOT NULL
          AND ti.company_id = p.active_company_id
      )
    )
  );