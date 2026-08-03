CREATE POLICY "Manuais: autenticados leem arquivos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'manuais');
CREATE POLICY "Manuais: autenticados enviam arquivos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'manuais');
CREATE POLICY "Manuais: autenticados removem arquivos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'manuais');