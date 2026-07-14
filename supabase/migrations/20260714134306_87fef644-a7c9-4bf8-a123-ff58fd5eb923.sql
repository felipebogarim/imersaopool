
CREATE POLICY "admin read backups" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin write backups" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'backups' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update backups" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete backups" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(),'admin'));
