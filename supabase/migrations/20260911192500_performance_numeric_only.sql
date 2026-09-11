ALTER TABLE performance_private.rep_row_values ADD COLUMN IF NOT EXISTS media jsonb;

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
  _media_val numeric;
  _real_val numeric;
  _pct_val numeric;
  _realizado jsonb;
  _row_metas jsonb;
  _row_pct jsonb;
  _cat_meta_sum jsonb := '{}'::jsonb;
  _fam_by_cat jsonb := '{}'::jsonb;
  _total_meta numeric;
  _row_total_meta_input numeric;
  _row_total_pct_input numeric;
  _has_row_numbers boolean;
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
    AND (
      EXISTS (SELECT 1 FROM jsonb_each(COALESCE(r->'metas_status','{}'::jsonb)))
      OR EXISTS (SELECT 1 FROM jsonb_each(COALESCE(r->'familia_pct','{}'::jsonb)))
      OR EXISTS (SELECT 1 FROM jsonb_each(COALESCE(r->'metas','{}'::jsonb)))
      OR EXISTS (SELECT 1 FROM jsonb_each(COALESCE(r->'realizado','{}'::jsonb)))
      OR NULLIF(r->>'total_pct','') IS NOT NULL
    );

  SELECT ARRAY(
    SELECT DISTINCT r->>'categoria'
    FROM jsonb_array_elements(_rows) r
    WHERE COALESCE(r->>'categoria','') <> ''
  ) INTO _categorias_usadas;

  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_rows) r
    WHERE EXISTS (SELECT 1 FROM jsonb_each(COALESCE(r->'metas','{}'::jsonb)))
       OR EXISTS (SELECT 1 FROM jsonb_each(COALESCE(r->'realizado','{}'::jsonb)))
       OR EXISTS (SELECT 1 FROM jsonb_each(COALESCE(r->'media','{}'::jsonb)))
       OR EXISTS (SELECT 1 FROM jsonb_each(COALESCE(r->'familia_pct','{}'::jsonb)))
       OR NULLIF(r->>'total_pct','') IS NOT NULL
  ) INTO _has_row_numbers;

  FOREACH _cat IN ARRAY _categorias_usadas LOOP
    IF _targets <> '{}'::jsonb AND _targets->_cat IS NULL THEN
      _missing := _missing || _cat || ' (categoria inteira ausente); ';
      CONTINUE;
    END IF;
    IF _targets <> '{}'::jsonb THEN
      FOREACH _fam IN ARRAY _familias LOOP
        IF NULLIF(_targets->_cat->>_fam,'') IS NULL OR (_targets->_cat->>_fam)::numeric <= 0 THEN
          _missing := _missing || _cat || '/' || _fam || '; ';
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  IF _missing <> '' AND _targets <> '{}'::jsonb AND NOT _has_row_numbers THEN
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
    familias, escala_percentual, filename, uploaded_by, origem, calculation_version, observacao
  ) VALUES (
    _company_id, _rep_id, _periodo_label, _periodo_inicio, _periodo_fim,
    _familias, '[]'::jsonb, _filename, _uid,
    CASE WHEN _replaced_id IS NULL THEN 'importacao_deterministica' ELSE 'importacao_deterministica-atualizada' END,
    'performance_bi_v3_numeric_only',
    NULLIF(_payload->>'diagnostic_summary','')
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
    WHERE fam.value IS NOT NULL AND fam.value <> '' AND (fam.value)::numeric > 0
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
    _row_pct := '{}'::jsonb;
    _total_meta := 0;
    _row_total_meta_input := NULLIF(_row->>'total_meta','')::numeric;
    _row_total_pct_input := NULLIF(_row->>'total_pct','')::numeric;

    FOREACH _fam IN ARRAY _familias LOOP
      _fam_target := NULLIF(_row#>>ARRAY['metas',_fam],'')::numeric;
      IF _fam_target IS NULL THEN
        _fam_target := NULLIF(_targets#>>ARRAY[_cat,_fam],'')::numeric;
      END IF;
      _fam_target := COALESCE(_fam_target, 0);

      _real_val := NULLIF(_row#>>ARRAY['realizado',_fam],'')::numeric;
      _pct_val := NULLIF(_row#>>ARRAY['familia_pct',_fam],'')::numeric;
      _media_val := NULLIF(_row#>>ARRAY['media',_fam],'')::numeric;


      IF _fam_target > 0 THEN
        _row_metas := jsonb_set(_row_metas, ARRAY[_fam], to_jsonb(_fam_target), true);
        _total_meta := _total_meta + _fam_target;
      END IF;
      IF _real_val IS NOT NULL THEN
        _realizado := jsonb_set(_realizado, ARRAY[_fam], to_jsonb(_real_val), true);
      END IF;
      IF _pct_val IS NOT NULL THEN
        _row_pct := jsonb_set(_row_pct, ARRAY[_fam], to_jsonb(_pct_val), true);
      ELSIF _fam_target > 0 AND _real_val IS NOT NULL THEN
        _row_pct := jsonb_set(_row_pct, ARRAY[_fam], to_jsonb(round((_real_val / _fam_target)::numeric, 4)), true);
      ELSIF _fam_target > 0 AND _media_val IS NOT NULL THEN
        _row_pct := jsonb_set(_row_pct, ARRAY[_fam], to_jsonb(round((_media_val / _fam_target)::numeric, 4)), true);
      END IF;
    END LOOP;

    INSERT INTO public.rep_performance_rows(
      company_id, upload_id, ordem, razao_social, categoria, metas_status, metas_cores, total_pct_status, familia_pct, total_pct
    ) VALUES (
      _company_id, _new_upload_id, _ordem,
      _row->>'razao_social', NULLIF(_cat,''),
      _metas, _cores, NULLIF(_row->>'total_pct_status',''), _row_pct, _row_total_pct_input
    ) RETURNING id INTO _row_id;

    INSERT INTO performance_private.rep_row_values(row_id, upload_id, total_meta, metas, realizado, media)
    VALUES (_row_id, _new_upload_id, COALESCE(NULLIF(_total_meta,0), _row_total_meta_input), _row_metas, _realizado, COALESCE(_row->'media','{}'::jsonb));
  END LOOP;

  PERFORM performance_private.recompute_upload(_new_upload_id);

  UPDATE public.rep_performance_rows r
  SET familia_pct = COALESCE(NULLIF(r.familia_pct, '{}'::jsonb), src.family_pct),
      total_pct = COALESCE(r.total_pct, src.total_pct)
  FROM (
    SELECT rr.id,
           COALESCE(row_payload->'familia_pct', '{}'::jsonb) AS family_pct,
           NULLIF(row_payload->>'total_pct','')::numeric AS total_pct
    FROM public.rep_performance_rows rr
    JOIN jsonb_array_elements(_rows) WITH ORDINALITY src_rows(row_payload, ord)
      ON ord::int = rr.ordem
    WHERE rr.upload_id = _new_upload_id
  ) src
  WHERE r.id = src.id
    AND (src.family_pct <> '{}'::jsonb OR src.total_pct IS NOT NULL);

  RETURN jsonb_build_object(
    'upload_id', _new_upload_id,
    'replaced_upload_id', _replaced_id,
    'calculation_version', 'performance_bi_v3_numeric_only'
  );
END $function$;

REVOKE ALL ON FUNCTION public.submit_performance_upload(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_performance_upload(jsonb) TO authenticated, service_role;