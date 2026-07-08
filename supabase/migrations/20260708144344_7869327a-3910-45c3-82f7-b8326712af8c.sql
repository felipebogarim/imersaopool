CREATE TABLE IF NOT EXISTS public._image_url_staging2 (product_id uuid PRIMARY KEY, url text NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public._image_url_staging2 TO authenticated;
GRANT ALL ON public._image_url_staging2 TO service_role;
ALTER TABLE public._image_url_staging2 ENABLE ROW LEVEL SECURITY;