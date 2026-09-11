CREATE OR REPLACE FUNCTION performance_private.recompute_upload(_upload_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, performance_private
AS $$
BEGIN
  PERFORM performance_private.recompute_upload_numeric(_upload_id);
END;
$$;

REVOKE ALL ON FUNCTION performance_private.recompute_upload(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION performance_private.recompute_upload(uuid) TO service_role;

DO $$
DECLARE
  _upload_id uuid;
BEGIN
  FOR _upload_id IN SELECT id FROM public.rep_performance_uploads LOOP
    PERFORM performance_private.recompute_upload_numeric(_upload_id);
  END LOOP;
END;
$$;