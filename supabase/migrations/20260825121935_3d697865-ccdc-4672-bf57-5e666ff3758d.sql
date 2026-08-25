DROP POLICY IF EXISTS "Allow public access to app_update_assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletions from app_update_assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to app_update_assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;

CREATE POLICY "app_update_assets insert admin or owner"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'app_update_assets'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "app_update_assets update admin or owner"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'app_update_assets'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
)
WITH CHECK (
  bucket_id = 'app_update_assets'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "app_update_assets delete admin or owner"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'app_update_assets'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);