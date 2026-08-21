-- Set up storage policies for app_update_assets
-- Allow authenticated users to upload files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Allow authenticated users to upload files'
    ) THEN
        CREATE POLICY "Allow authenticated users to upload files"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'app_update_assets');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Allow public access to read files'
    ) THEN
        CREATE POLICY "Allow public access to read files"
        ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'app_update_assets');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Allow authenticated users to delete their files'
    ) THEN
        CREATE POLICY "Allow authenticated users to delete their files"
        ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id = 'app_update_assets');
    END IF;
END $$;
