
CREATE POLICY "imersoes_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'imersoes-anexos');
CREATE POLICY "imersoes_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'imersoes-anexos' AND auth.uid() = owner);
CREATE POLICY "imersoes_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'imersoes-anexos' AND auth.uid() = owner);
CREATE POLICY "imersoes_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'imersoes-anexos' AND auth.uid() = owner);
