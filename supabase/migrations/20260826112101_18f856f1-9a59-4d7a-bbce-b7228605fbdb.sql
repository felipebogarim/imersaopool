CREATE OR REPLACE FUNCTION performance_private.recompute_upload(_upload_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','performance_private'
AS $fn$
DECLARE
  _familias text[];
  _f text;
  _cat text;
  _row record;
  _meta_val numeric;
  _real_val numeric;
  _row_meta_sum numeric;
  _row_real_sum numeric;
  _cat_meta_sum jsonb := '{}'::jsonb;
  _cat_real_sum jsonb := '{}'::jsonb;
  _cat_fam_meta jsonb := '{}'::jsonb;
  _cat_fam_real jsonb := '{}'::jsonb;
  _global_meta numeric := 0;
  _global_real numeric := 0;
  _familia_participacao jsonb := '{}'::jsonb;
  _familia_atingimento jsonb := '{}'::jsonb;
  _categoria_participacao jsonb := '{}'::jsonb;
  _has_global_numeric boolean := false;
BEGIN
  SELECT familias INTO _familias FROM public.rep_performance_uploads WHERE id = _upload_id;
  IF _familias IS NULL THEN RETURN; END IF;

  FOR _row IN
    SELECT r.id AS row_id, r.categoria, r.familia_pct AS stored_pct, r.total_pct AS stored_total_pct,
           v.total_meta, v.metas, v.realizado
    FROM public.rep_performance_rows r
    LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
    WHERE r.upload_id = _upload_id
  LOOP
    _row_meta_sum := 0;
    _row_real_sum := 0;
    DECLARE
      _fpct jsonb := COALESCE(_row.stored_pct, '{}'::jsonb);
      _row_has_numeric boolean := false;
    BEGIN
      _cat := COALESCE(_row.categoria, '');
      IF _cat <> '' AND NOT (_cat_fam_meta ? _cat) THEN
        _cat_fam_meta := jsonb_set(_cat_fam_meta, ARRAY[_cat], '{}'::jsonb, true);
        _cat_fam_real := jsonb_set(_cat_fam_real, ARRAY[_cat], '{}'::jsonb, true);
      END IF;

      FOREACH _f IN ARRAY _familias LOOP
        _meta_val := NULLIF(COALESCE(_row.metas, '{}'::jsonb)->>_f,'')::numeric;
        _real_val := NULLIF(COALESCE(_row.realizado, '{}'::jsonb)->>_f,'')::numeric;

        IF _meta_val IS NOT NULL THEN
          _row_meta_sum := _row_meta_sum + _meta_val;
        END IF;
        IF _real_val IS NOT NULL THEN
          _row_real_sum := _row_real_sum + _real_val;
        END IF;

        -- "Sem compra" é RESULTADO VÁLIDO (0%), nunca dado ausente:
        -- a família permanece na ponderação com todo o peso da sua meta.
        IF _meta_val IS NOT NULL AND _meta_val > 0 THEN
          _fpct := jsonb_set(_fpct, ARRAY[_f],
            to_jsonb(round((COALESCE(_real_val, 0) / _meta_val)::numeric, 4)), true);
          _row_has_numeric := true;
          _has_global_numeric := true;

          IF _cat <> '' THEN
            _cat_fam_meta := jsonb_set(_cat_fam_meta, ARRAY[_cat, _f],
              to_jsonb(COALESCE((_cat_fam_meta#>>ARRAY[_cat,_f])::numeric, 0) + _meta_val), true);
            _cat_fam_real := jsonb_set(_cat_fam_real, ARRAY[_cat, _f],
              to_jsonb(COALESCE((_cat_fam_real#>>ARRAY[_cat,_f])::numeric, 0) + COALESCE(_real_val, 0)), true);
          END IF;
        END IF;
      END LOOP;

      UPDATE public.rep_performance_rows
      SET familia_pct = _fpct,
          total_pct = CASE
            WHEN _row_has_numeric AND COALESCE(_row.total_meta, _row_meta_sum) > 0
              THEN round((_row_real_sum / COALESCE(_row.total_meta, _row_meta_sum))::numeric, 4)
            ELSE _row.stored_total_pct
          END
      WHERE id = _row.row_id;
    END;

    IF _row_meta_sum > 0 OR EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(_row.realizado, '{}'::jsonb))) THEN
      _global_meta := _global_meta + COALESCE(_row.total_meta, _row_meta_sum);
      _global_real := _global_real + _row_real_sum;
      IF COALESCE(_row.categoria,'') <> '' THEN
        _cat_meta_sum := jsonb_set(_cat_meta_sum, ARRAY[_row.categoria],
          to_jsonb(COALESCE((_cat_meta_sum->>_row.categoria)::numeric, 0) + COALESCE(_row.total_meta, _row_meta_sum)), true);
        _cat_real_sum := jsonb_set(_cat_real_sum, ARRAY[_row.categoria],
          to_jsonb(COALESCE((_cat_real_sum->>_row.categoria)::numeric, 0) + _row_real_sum), true);
      END IF;
    END IF;
  END LOOP;

  FOR _cat IN SELECT jsonb_object_keys(_cat_fam_meta) LOOP
    DECLARE
      _fam_meta_obj jsonb := _cat_fam_meta->_cat;
      _fam_real_obj jsonb := _cat_fam_real->_cat;
      _cat_meta_total numeric := 0;
      _p jsonb := '{}'::jsonb;
      _a jsonb := '{}'::jsonb;
    BEGIN
      SELECT COALESCE(SUM((value)::numeric),0) INTO _cat_meta_total FROM jsonb_each_text(_fam_meta_obj);
      FOR _f IN SELECT jsonb_object_keys(_fam_meta_obj) LOOP
        _meta_val := COALESCE((_fam_meta_obj->>_f)::numeric,0);
        _real_val := COALESCE((_fam_real_obj->>_f)::numeric,0);
        IF _cat_meta_total > 0 THEN
          _p := jsonb_set(_p, ARRAY[_f], to_jsonb(round((_meta_val/_cat_meta_total)::numeric, 6)), true);
        END IF;
        IF _meta_val > 0 THEN
          _a := jsonb_set(_a, ARRAY[_f], to_jsonb(round((_real_val/_meta_val)::numeric, 4)), true);
        END IF;
      END LOOP;
      _familia_participacao := jsonb_set(_familia_participacao, ARRAY[_cat], _p, true);
      _familia_atingimento := jsonb_set(_familia_atingimento, ARRAY[_cat], _a, true);
    END;
  END LOOP;

  FOR _cat IN SELECT jsonb_object_keys(_cat_meta_sum) LOOP
    IF _global_meta > 0 THEN
      _categoria_participacao := jsonb_set(_categoria_participacao, ARRAY[_cat],
        to_jsonb(round(((_cat_meta_sum->>_cat)::numeric/_global_meta)::numeric, 6)), true);
    END IF;
  END LOOP;

  UPDATE public.rep_performance_uploads
  SET familia_participacao_categoria = _familia_participacao,
      familia_atingimento_categoria = _familia_atingimento,
      categoria_participacao = _categoria_participacao,
      atingimento_geral = CASE WHEN _has_global_numeric AND _global_meta > 0 THEN round((_global_real/_global_meta)::numeric,4) ELSE NULL END
  WHERE id = _upload_id;
END;
$fn$;

REVOKE ALL ON FUNCTION performance_private.recompute_upload(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION performance_private.recompute_upload(uuid) TO service_role;

DO $$
DECLARE _id uuid;
BEGIN
  FOR _id IN SELECT id FROM public.rep_performance_uploads LOOP
    PERFORM performance_private.recompute_upload(_id);
  END LOOP;
END $$;