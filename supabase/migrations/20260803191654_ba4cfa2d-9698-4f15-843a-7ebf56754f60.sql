create policy "entrevistas_anexos_read" on storage.objects for select to authenticated
  using (bucket_id = 'entrevistas-anexos');
create policy "entrevistas_anexos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'entrevistas-anexos' and auth.uid() = owner);
create policy "entrevistas_anexos_update" on storage.objects for update to authenticated
  using (bucket_id = 'entrevistas-anexos' and auth.uid() = owner);
create policy "entrevistas_anexos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'entrevistas-anexos' and auth.uid() = owner);