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
  _row_status_sum numeric;
  _row_status_count integer;
  _cat_meta_sum jsonb := '{}'::jsonb;
  _cat_real_sum jsonb := '{}'::jsonb;
  _cat_fam_meta jsonb := '{}'::jsonb;
  _cat_fam_real jsonb := '{}'::jsonb;
  _cat_fam_status_sum jsonb := '{}'::jsonb;
  _cat_fam_status_count jsonb := '{}'::jsonb;
  _global_meta numeric := 0;
  _global_real numeric := 0;
  _global_status_sum numeric := 0;
  _global_status_count integer := 0;
  _familia_participacao jsonb := '{}'::jsonb;
  _familia_atingimento jsonb := '{}'::jsonb;
  _categoria_participacao jsonb := '{}'::jsonb;
  _status text;
  _factor numeric;
BEGIN
  SELECT familias INTO _familias FROM public.rep_performance_uploads WHERE id = _upload_id;
  IF _familias IS NULL THEN RETURN; END IF;

  FOR _row IN
    SELECT r.id AS row_id, r.categoria, r.metas_status, r.total_pct_status, v.total_meta, v.metas, v.realizado
    FROM public.rep_performance_rows r
    LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
    WHERE r.upload_id = _upload_id
  LOOP
    _row_meta_sum := 0;
    _row_real_sum := 0;
    _row_status_sum := 0;
    _row_status_count := 0;
    DECLARE _fpct jsonb := '{}'::jsonb;
    BEGIN
      _cat := COALESCE(_row.categoria, '');
      IF _cat <> '' THEN
        IF NOT (_cat_fam_meta ? _cat) THEN
          _cat_fam_meta := jsonb_set(_cat_fam_meta, ARRAY[_cat], '{}'::jsonb, true);
          _cat_fam_real := jsonb_set(_cat_fam_real, ARRAY[_cat], '{}'::jsonb, true);
        END IF;
        IF NOT (_cat_fam_status_sum ? _cat) THEN
          _cat_fam_status_sum := jsonb_set(_cat_fam_status_sum, ARRAY[_cat], '{}'::jsonb, true);
          _cat_fam_status_count := jsonb_set(_cat_fam_status_count, ARRAY[_cat], '{}'::jsonb, true);
        END IF;
      END IF;

      FOREACH _f IN ARRAY _familias LOOP
        _meta_val := COALESCE(NULLIF(COALESCE(_row.metas, '{}'::jsonb)->>_f,'')::numeric, 0);
        _real_val := COALESCE(NULLIF(COALESCE(_row.realizado, '{}'::jsonb)->>_f,'')::numeric, 0);
        _status := COALESCE(COALESCE(_row.metas_status, '{}'::jsonb)->>_f, '');
        _factor := CASE _status
          WHEN 'sem_compra' THEN 0
          WHEN 'abaixo_meta' THEN 0.25
          WHEN 'pode_melhorar' THEN 0.60
          WHEN 'proximo' THEN 0.80
          WHEN 'otimo' THEN 0.95
          WHEN 'excelente' THEN 1.10
          ELSE NULL
        END;

        IF _meta_val > 0 THEN
          _fpct := jsonb_set(_fpct, ARRAY[_f], to_jsonb(round((_real_val / _meta_val)::numeric, 4)), true);
        ELSIF _factor IS NOT NULL THEN
          _fpct := jsonb_set(_fpct, ARRAY[_f], to_jsonb(_factor), true);
        END IF;

        IF _factor IS NOT NULL THEN
          _row_status_sum := _row_status_sum + _factor;
          _row_status_count := _row_status_count + 1;
          _global_status_sum := _global_status_sum + _factor;
          _global_status_count := _global_status_count + 1;
          IF _cat <> '' THEN
            _cat_fam_status_sum := jsonb_set(_cat_fam_status_sum, ARRAY[_cat, _f],
              to_jsonb(COALESCE((_cat_fam_status_sum#>>ARRAY[_cat,_f])::numeric, 0) + _factor), true);
            _cat_fam_status_count := jsonb_set(_cat_fam_status_count, ARRAY[_cat, _f],
              to_jsonb(COALESCE((_cat_fam_status_count#>>ARRAY[_cat,_f])::numeric, 0) + 1), true);
          END IF;
        END IF;

        _row_meta_sum := _row_meta_sum + _meta_val;
        _row_real_sum := _row_real_sum + _real_val;

        IF _cat <> '' AND _meta_val > 0 THEN
          _cat_fam_meta := jsonb_set(_cat_fam_meta, ARRAY[_cat, _f],
            to_jsonb(COALESCE((_cat_fam_meta#>>ARRAY[_cat,_f])::numeric, 0) + _meta_val), true);
          _cat_fam_real := jsonb_set(_cat_fam_real, ARRAY[_cat, _f],
            to_jsonb(COALESCE((_cat_fam_real#>>ARRAY[_cat,_f])::numeric, 0) + _real_val), true);
        END IF;
      END LOOP;

      _status := COALESCE(_row.total_pct_status, '');
      _factor := CASE _status
        WHEN 'sem_compra' THEN 0
        WHEN 'abaixo_meta' THEN 0.25
        WHEN 'pode_melhorar' THEN 0.60
        WHEN 'proximo' THEN 0.80
        WHEN 'otimo' THEN 0.95
        WHEN 'excelente' THEN 1.10
        ELSE NULL
      END;

      UPDATE public.rep_performance_rows
        SET familia_pct = _fpct,
            total_pct = CASE
              WHEN COALESCE(_row.total_meta, _row_meta_sum) > 0 THEN round((_row_real_sum / COALESCE(_row.total_meta, _row_meta_sum))::numeric, 4)
              WHEN _factor IS NOT NULL THEN _factor
              WHEN _row_status_count > 0 THEN round((_row_status_sum / _row_status_count)::numeric, 4)
              ELSE NULL
            END
        WHERE id = _row.row_id;
    END;

    _global_meta := _global_meta + COALESCE(_row.total_meta, _row_meta_sum);
    _global_real := _global_real + _row_real_sum;
    IF COALESCE(_row.categoria,'') <> '' THEN
      _cat_meta_sum := jsonb_set(_cat_meta_sum, ARRAY[_row.categoria],
        to_jsonb(COALESCE((_cat_meta_sum->>_row.categoria)::numeric, 0) + COALESCE(_row.total_meta, _row_meta_sum)), true);
      _cat_real_sum := jsonb_set(_cat_real_sum, ARRAY[_row.categoria],
        to_jsonb(COALESCE((_cat_real_sum->>_row.categoria)::numeric, 0) + _row_real_sum), true);
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

  FOR _cat IN SELECT jsonb_object_keys(_cat_fam_status_sum) LOOP
    IF NOT (_familia_atingimento ? _cat) THEN
      DECLARE
        _sum_obj jsonb := _cat_fam_status_sum->_cat;
        _count_obj jsonb := _cat_fam_status_count->_cat;
        _a jsonb := '{}'::jsonb;
        _sum_val numeric;
        _count_val numeric;
      BEGIN
        FOR _f IN SELECT jsonb_object_keys(_sum_obj) LOOP
          _sum_val := COALESCE((_sum_obj->>_f)::numeric, 0);
          _count_val := COALESCE((_count_obj->>_f)::numeric, 0);
          IF _count_val > 0 THEN
            _a := jsonb_set(_a, ARRAY[_f], to_jsonb(round((_sum_val / _count_val)::numeric, 4)), true);
          END IF;
        END LOOP;
        _familia_atingimento := jsonb_set(_familia_atingimento, ARRAY[_cat], _a, true);
      END;
    END IF;
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
        atingimento_geral = CASE
          WHEN _global_meta > 0 THEN round((_global_real/_global_meta)::numeric,4)
          WHEN _global_status_count > 0 THEN round((_global_status_sum/_global_status_count)::numeric,4)
          ELSE NULL
        END
    WHERE id = _upload_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.submit_performance_upload(_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'performance_private'
AS $function$
DECLARE
  _rep_id uuid := (_payload->>'representative_id')::uuid;
  _company_id uuid;
  _periodo_label text := _payload->>'periodo_label';
  _periodo_inicio date := NULLIF(_payload->>'periodo_inicio','')::date;
  _periodo_fim date := NULLIF(_payload->>'periodo_fim','')::date;
  _filename text := _payload->>'filename';
  _familias text[];
  _targets jsonb := COALESCE(_payload->'targets_matrix', '{}'::jsonb);
  _rows jsonb := COALESCE(_payload->'rows', '[]'::jsonb);
  _conflitos jsonb := COALESCE(_payload->'conflitos', '[]'::jsonb);
  _c jsonb;
  _uid uuid := auth.uid();
  _new_upload_id uuid;
  _replaced_id uuid;
  _categorias_usadas text[];
  _cat text;
  _fam text;
  _missing text := '';
  _row jsonb;
  _row_id uuid;
  _ordem int := 0;
  _metas jsonb;
  _cores jsonb;
  _fam_target numeric;
  _status text;
  _factor numeric;
  _real_val numeric;
  _realizado jsonb;
  _row_metas jsonb;
  _cat_meta_sum jsonb := '{}'::jsonb;
  _fam_by_cat jsonb := '{}'::jsonb;
  _total_meta numeric;
BEGIN
  IF _rep_id IS NULL THEN RAISE EXCEPTION 'representative_id ausente'; END IF;
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT company_id INTO _company_id FROM public.representatives WHERE id = _rep_id;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Representante não encontrado'; END IF;

  IF _company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'Acesso negado à empresa deste representante';
  END IF;

  IF jsonb_typeof(_conflitos) = 'array' AND jsonb_array_length(_conflitos) > 0 THEN
    _c := _conflitos->0;
    RAISE EXCEPTION 'Importação interrompida: divergência entre faixa e cor em % divergência(s). Primeira: linha %, cliente %, família %, texto %, cor %',
      jsonb_array_length(_conflitos), COALESCE(_c->>'linha','?'), COALESCE(_c->>'razao_social','?'),
      COALESCE(_c->>'familia','?'), COALESCE(_c->>'texto','(vazio)'), COALESCE(NULLIF(_c->>'cor',''),'(sem cor)');
  END IF;

  SELECT ARRAY(SELECT jsonb_array_elements_text(_payload->'familias')) INTO _familias;
  IF array_length(_familias,1) IS NULL THEN RAISE EXCEPTION 'familias vazio'; END IF;
  SELECT COALESCE(jsonb_agg(r ORDER BY ord), '[]'::jsonb) INTO _rows
  FROM jsonb_array_elements(_rows) WITH ORDINALITY t(r, ord)
  WHERE COALESCE(btrim(r->>'razao_social'),'') <> ''
    AND COALESCE(btrim(r->>'categoria'),'') <> ''
    AND lower(btrim(r->>'categoria')) NOT IN ('none','null','nan','-')
    AND NOT public.is_total_row(r->>'razao_social')
    AND EXISTS (SELECT 1 FROM jsonb_each(COALESCE(r->'metas_status','{}'::jsonb)));

  SELECT ARRAY(
    SELECT DISTINCT r->>'categoria'
    FROM jsonb_array_elements(_rows) r
    WHERE COALESCE(r->>'categoria','') <> ''
  ) INTO _categorias_usadas;

  FOREACH _cat IN ARRAY _categorias_usadas LOOP
    IF _targets->_cat IS NULL THEN
      _missing := _missing || _cat || ' (categoria inteira ausente); ';
      CONTINUE;
    END IF;
    FOREACH _fam IN ARRAY _familias LOOP
      IF NULLIF(_targets->_cat->>_fam,'') IS NULL OR (_targets->_cat->>_fam)::numeric <= 0 THEN
        _missing := _missing || _cat || '/' || _fam || '; ';
      END IF;
    END LOOP;
  END LOOP;
  IF _missing <> '' AND _targets <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Matriz financeira incompleta. Faltam: %', _missing
      USING HINT = 'Cadastre metas em R$ por categoria × família antes de reenviar.';
  END IF;

  SELECT id INTO _replaced_id
  FROM public.rep_performance_uploads
  WHERE representative_id = _rep_id
    AND substituida_em IS NULL
    AND (
      lower(trim(periodo_label)) = lower(trim(_periodo_label))
      OR (periodo_inicio IS NOT DISTINCT FROM _periodo_inicio
          AND periodo_fim IS NOT DISTINCT FROM _periodo_fim
          AND _periodo_inicio IS NOT NULL)
    )
  ORDER BY created_at DESC LIMIT 1;

  IF _replaced_id IS NOT NULL THEN
    UPDATE public.rep_performance_uploads
      SET substituida_em = now(), substituida_por = NULL
      WHERE id = _replaced_id;
  END IF;

  INSERT INTO public.rep_performance_uploads(
    company_id, representative_id, periodo_label, periodo_inicio, periodo_fim,
    familias, escala_percentual, filename, uploaded_by, origem, calculation_version
  ) VALUES (
    _company_id, _rep_id, _periodo_label, _periodo_inicio, _periodo_fim,
    _familias, '[]'::jsonb, _filename, _uid,
    CASE WHEN _replaced_id IS NULL THEN 'ia' ELSE 'ia-atualizada' END,
    'performance_v3_status_fallback'
  ) RETURNING id INTO _new_upload_id;

  IF _replaced_id IS NOT NULL THEN
    UPDATE public.rep_performance_uploads SET substituida_por = _new_upload_id WHERE id = _replaced_id;
  END IF;

  INSERT INTO performance_private.upload_category_family_targets(upload_id, categoria, familia, target_amount)
  SELECT _new_upload_id, cat.key, fam.key, (fam.value)::numeric
  FROM jsonb_each(_targets) cat, jsonb_each_text(cat.value) fam
  WHERE fam.value IS NOT NULL AND fam.value <> '' AND (fam.value)::numeric > 0;

  SELECT jsonb_object_agg(cat, tot)
    INTO _cat_meta_sum
  FROM (
    SELECT cat.key AS cat, SUM((fam.value)::numeric) AS tot
    FROM jsonb_each(_targets) cat, jsonb_each_text(cat.value) fam
    GROUP BY cat.key
  ) s;

  _fam_by_cat := _targets;

  INSERT INTO performance_private.rep_upload_values(upload_id, categoria_metas)
  VALUES (_new_upload_id,
    COALESCE(_cat_meta_sum,'{}'::jsonb) || jsonb_build_object('__family_metas_by_category__', _fam_by_cat));

  FOR _row IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    _ordem := _ordem + 1;
    _cat := COALESCE(_row->>'categoria','');
    _metas := COALESCE(_row->'metas_status','{}'::jsonb);
    _cores := COALESCE(_row->'metas_cores','{}'::jsonb);
    _row_metas := '{}'::jsonb;
    _realizado := '{}'::jsonb;
    _total_meta := 0;

    FOREACH _fam IN ARRAY _familias LOOP
      _fam_target := NULLIF(_targets#>>ARRAY[_cat,_fam],'')::numeric;
      _fam_target := COALESCE(_fam_target, 0);
      _status := COALESCE(_metas->>_fam,'');
      _factor := CASE _status
        WHEN 'sem_compra' THEN 0
        WHEN 'abaixo_meta' THEN 0.25
        WHEN 'pode_melhorar' THEN 0.60
        WHEN 'proximo' THEN 0.80
        WHEN 'otimo' THEN 0.95
        WHEN 'excelente' THEN 1.10
        ELSE 0
      END;
      _real_val := _fam_target * _factor;
      IF _fam_target > 0 THEN
        _row_metas := jsonb_set(_row_metas, ARRAY[_fam], to_jsonb(_fam_target));
        _realizado := jsonb_set(_realizado, ARRAY[_fam], to_jsonb(_real_val));
      END IF;
      _total_meta := _total_meta + _fam_target;
    END LOOP;

    INSERT INTO public.rep_performance_rows(
      company_id, upload_id, ordem, razao_social, categoria, metas_status, metas_cores, total_pct_status
    ) VALUES (
      _company_id, _new_upload_id, _ordem,
      _row->>'razao_social', NULLIF(_cat,''),
      _metas, _cores, NULLIF(_row->>'total_pct_status','')
    ) RETURNING id INTO _row_id;

    INSERT INTO performance_private.rep_row_values(row_id, upload_id, total_meta, metas, realizado)
    VALUES (_row_id, _new_upload_id, NULLIF(_total_meta,0), _row_metas, _realizado);
  END LOOP;

  PERFORM performance_private.recompute_upload(_new_upload_id);

  RETURN jsonb_build_object(
    'upload_id', _new_upload_id,
    'replaced_upload_id', _replaced_id,
    'calculation_version', 'performance_v3_status_fallback'
  );
END $function$;

SELECT performance_private.recompute_upload(id)
FROM public.rep_performance_uploads
WHERE EXISTS (
  SELECT 1
  FROM public.rep_performance_rows r
  WHERE r.upload_id = rep_performance_uploads.id
    AND EXISTS (SELECT 1 FROM jsonb_each(COALESCE(r.metas_status,'{}'::jsonb)))
);