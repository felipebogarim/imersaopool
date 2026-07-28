CREATE OR REPLACE FUNCTION public.is_total_row(_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH n AS (
    SELECT regexp_replace(
             btrim(
               regexp_replace(
                 upper(translate(COALESCE(_name,''),
                   'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                   'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
                 '[[:space:]]+', ' ', 'g'),
               ' .:;-'),
             '[.:;]+$', '') AS v
  )
  SELECT v = '' OR v IN (
    'TOTAL','TOTAL GERAL','TOTAL GERAL DA META','TOTAL DA META','TOTAL META',
    'TOTAL GERAL META','SOMA','SOMATORIO','SUBTOTAL','SUB TOTAL',
    'TOTAL DA CARTEIRA','TOTAL DO REPRESENTANTE','TOTAL CARTEIRA',
    'MEDIA','MEDIA GERAL','TOTAIS','LEGENDA','OBSERVACAO','OBSERVACOES',
    'FAIXA %','FAIXA','ESTIMATIVA','PARTICIPACAO','ATINGIMENTO'
  ) OR v ~ '^(TOTAL|SUBTOTAL|SUB TOTAL|SOMA|SOMATORIO|MEDIA)( |$)'
    OR v ~ '^(PARTICIPACAO|ATINGIMENTO|ESTIMATIVA|LEGENDA|OBSERVAC)'
  FROM n;
$$;

GRANT EXECUTE ON FUNCTION public.is_total_row(text) TO authenticated, anon, service_role;

DO $mig$
DECLARE
  src text;
  anchor text := '  IF array_length(_familias,1) IS NULL THEN RAISE EXCEPTION ''familias vazio''; END IF;';
  guard text := '
  SELECT COALESCE(jsonb_agg(r ORDER BY ord), ''[]''::jsonb) INTO _rows
  FROM jsonb_array_elements(_rows) WITH ORDINALITY t(r, ord)
  WHERE COALESCE(btrim(r->>''razao_social''),'''') <> ''''
    AND COALESCE(btrim(r->>''categoria''),'''') <> ''''
    AND lower(btrim(r->>''categoria'')) NOT IN (''none'',''null'',''nan'',''-'')
    AND NOT public.is_total_row(r->>''razao_social'');
';
BEGIN
  SELECT prosrc INTO src FROM pg_proc
   WHERE proname = 'submit_performance_upload' AND pronamespace = 'public'::regnamespace;
  IF src IS NULL THEN RAISE EXCEPTION 'submit_performance_upload não encontrada'; END IF;
  IF position('is_total_row' in src) = 0 THEN
    IF position(anchor in src) = 0 THEN RAISE EXCEPTION 'âncora não encontrada'; END IF;
    src := replace(src, anchor, anchor || guard);
    EXECUTE 'CREATE OR REPLACE FUNCTION public.submit_performance_upload(_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, performance_private AS $fn$' || src || '$fn$';
  END IF;
END
$mig$;