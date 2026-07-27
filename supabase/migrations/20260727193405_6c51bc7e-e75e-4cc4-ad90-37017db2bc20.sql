DO $mig$
DECLARE src text;
BEGIN
  SELECT prosrc INTO src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='submit_performance_upload';
  IF src IS NULL THEN RAISE EXCEPTION 'função não encontrada'; END IF;
  src := replace(
    src,
    'IF _missing <> '''' THEN',
    'IF _missing <> '''' AND _targets <> ''{}''::jsonb THEN'
  );
  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.submit_performance_upload(_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''public'', ''performance_private'' AS %L',
    src
  );
END
$mig$;