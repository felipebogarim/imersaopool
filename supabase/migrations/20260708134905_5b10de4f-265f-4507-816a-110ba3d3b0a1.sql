CREATE TABLE IF NOT EXISTS public._image_url_staging (product_id uuid PRIMARY KEY, url text NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public._image_url_staging TO authenticated;
GRANT ALL ON public._image_url_staging TO service_role;
GRANT SELECT, INSERT ON public._image_url_staging TO postgres;
ALTER TABLE public._image_url_staging ENABLE ROW LEVEL SECURITY;