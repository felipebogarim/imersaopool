create policy "Allow public access to app_update_assets"
on storage.objects for select
to public
using (bucket_id = 'app_update_assets');

create policy "Allow authenticated uploads to app_update_assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'app_update_assets');

create policy "Allow authenticated deletions from app_update_assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'app_update_assets');
