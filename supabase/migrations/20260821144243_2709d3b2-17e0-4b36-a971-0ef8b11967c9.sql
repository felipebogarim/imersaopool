-- Remove previous policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to read files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their files" ON storage.objects;

-- New policies for private bucket
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'app_update_assets');

CREATE POLICY "Allow authenticated users to read files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'app_update_assets');

CREATE POLICY "Allow authenticated users to delete their files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'app_update_assets');
