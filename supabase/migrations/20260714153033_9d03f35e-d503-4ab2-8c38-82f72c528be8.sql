
CREATE OR REPLACE FUNCTION public.list_storage_objects()
RETURNS TABLE (bucket_id text, name text, size bigint, mimetype text, updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT o.bucket_id,
         o.name,
         COALESCE((o.metadata->>'size')::bigint, 0) AS size,
         COALESCE(o.metadata->>'mimetype', '') AS mimetype,
         o.updated_at
  FROM storage.objects o
  WHERE o.bucket_id <> 'backups';
$$;

REVOKE ALL ON FUNCTION public.list_storage_objects() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_storage_objects() TO service_role;

UPDATE public.backup_jobs
SET status = 'erro',
    erro = 'Timeout: superado limite de execução do worker (estratégia antiga de cópia file-a-file). Tente novamente com a nova versão baseada em manifesto.',
    concluido_em = now()
WHERE status = 'executando';
