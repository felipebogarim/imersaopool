create policy "email_anexos_auth_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'email-anexos');

create policy "email_anexos_auth_select"
on storage.objects for select
to authenticated
using (bucket_id = 'email-anexos');

create policy "email_anexos_owner_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'email-anexos' and owner = auth.uid());