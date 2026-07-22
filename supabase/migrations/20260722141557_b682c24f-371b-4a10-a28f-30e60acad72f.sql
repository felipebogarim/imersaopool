
CREATE POLICY "price-tables authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'price-tables');

CREATE POLICY "price-tables authenticated insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'price-tables');

CREATE POLICY "price-tables authenticated update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'price-tables')
  WITH CHECK (bucket_id = 'price-tables');

CREATE POLICY "price-tables authenticated delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'price-tables');
