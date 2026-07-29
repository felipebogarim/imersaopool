CREATE OR REPLACE FUNCTION public.list_storage_objects()
 RETURNS TABLE(bucket_id text, name text, size bigint, mimetype text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT o.bucket_id,
         o.name,
         COALESCE((o.metadata->>'size')::bigint, 0) AS size,
         COALESCE(o.metadata->>'mimetype', '') AS mimetype,
         o.updated_at
  FROM storage.objects o
  WHERE o.bucket_id <> 'backups';
END;
$function$;

REVOKE ALL ON FUNCTION public.list_storage_objects() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_storage_objects() TO authenticated, service_role;