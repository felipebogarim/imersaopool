CREATE OR REPLACE FUNCTION public.compute_bi_shares(_rep_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, performance_private
AS $$
DECLARE
  _upload_id uuid;
  _company_id uuid;
  _familias text[];
  _family_metas jsonb;
  _result jsonb;
BEGIN
  SELECT id, company_id, familias
    INTO _upload_id, _company_id, _familias
  FROM public.rep_performance_uploads
  WHERE representative_id = _rep_id AND substituida_em IS NULL
  ORDER BY created_at DESC LIMIT 1;

  IF _upload_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF _company_id IS DISTINCT FROM public.current_company_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT categoria_metas->'__family_metas_by_category__'
    INTO _family_metas
  FROM performance_private.rep_upload_values
  WHERE upload_id = _upload_id;

  WITH factor(status, f) AS (
    VALUES
      ('sem_compra', 0::numeric),
      ('abaixo_meta', 0.25::numeric),
      ('pode_melhorar', 0.6::numeric),
      ('proximo', 0.8::numeric),
      ('otimo', 0.95::numeric),
      ('excelente', 1.1::numeric)
  ),
  fams AS (SELECT unnest(_familias) AS familia),
  rows_data AS (
    SELECT r.categoria, r.metas_status, v.metas
    FROM public.rep_performance_rows r
    JOIN performance_private.rep_row_values v ON v.row_id = r.id
    WHERE r.upload_id = _upload_id
      AND r.categoria IS NOT NULL
      AND upper(coalesce(r.razao_social,'')) !~ '^(PARTICIPA|ATINGIMENTO|TOTAL|ESTIMATIVA|FAIXA)'
  ),
  per_cell AS (
    SELECT
      rd.categoria,
      f.familia,
      COALESCE(
        NULLIF((rd.metas->>f.familia), '')::numeric,
        COALESCE(((_family_metas->rd.categoria)->>f.familia)::numeric, 0)
      ) AS cell_meta,
      COALESCE(
        (SELECT fx.f FROM factor fx WHERE fx.status = rd.metas_status->>f.familia),
        0
      ) AS factor
    FROM rows_data rd CROSS JOIN fams f
  ),
  agg AS (
    SELECT categoria, familia,
      SUM(COALESCE(cell_meta,0) * factor) AS est_real
    FROM per_cell
    GROUP BY categoria, familia
  ),
  cat_totals AS (
    SELECT categoria, SUM(est_real) AS total FROM agg GROUP BY categoria
  )
  SELECT jsonb_object_agg(categoria, fams_json)
    INTO _result
  FROM (
    SELECT a.categoria,
      jsonb_agg(jsonb_build_object(
        'familyKey', a.familia,
        'familyName', a.familia,
        'shareRatio', CASE WHEN ct.total > 0 THEN a.est_real / ct.total ELSE 0 END
      ) ORDER BY a.familia) AS fams_json
    FROM agg a
    JOIN cat_totals ct ON ct.categoria = a.categoria
    GROUP BY a.categoria
  ) s;

  RETURN COALESCE(_result, '{}'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.compute_bi_shares(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_bi_shares(uuid) TO authenticated;