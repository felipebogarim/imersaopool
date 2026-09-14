
CREATE POLICY "trade_comprovantes_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trade-comprovantes');
CREATE POLICY "trade_comprovantes_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trade-comprovantes');
CREATE POLICY "trade_comprovantes_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'trade-comprovantes' AND owner = auth.uid());
CREATE POLICY "trade_comprovantes_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'trade-comprovantes' AND owner = auth.uid());
