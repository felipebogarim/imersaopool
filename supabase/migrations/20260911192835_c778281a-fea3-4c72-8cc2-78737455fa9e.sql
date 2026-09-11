ALTER TABLE performance_private.rep_row_values ADD COLUMN IF NOT EXISTS media jsonb;

CREATE OR REPLACE FUNCTION performance_private.farol_from_ratio(_ratio numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN _ratio IS NULL THEN NULL WHEN _ratio = 0 THEN 'sem_compra'
    WHEN _ratio < .5 THEN 'abaixo_meta' WHEN _ratio < .7 THEN 'pode_melhorar'
    WHEN _ratio < .9 THEN 'proximo' WHEN _ratio <= 1 THEN 'otimo' ELSE 'excelente' END
$$;
REVOKE ALL ON FUNCTION performance_private.farol_from_ratio(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION performance_private.farol_from_ratio(numeric) TO service_role;

CREATE OR REPLACE FUNCTION performance_private.recompute_upload_numeric(_upload_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, performance_private AS $$
DECLARE _row record; _f text; _familias text[]; _meta numeric; _real numeric; _pct numeric;
  _fpct jsonb; _statuses jsonb; _row_meta numeric; _row_real numeric;
  _global_meta numeric := 0; _global_real numeric := 0; _has_global boolean := false;
BEGIN
  SELECT familias INTO _familias FROM public.rep_performance_uploads WHERE id=_upload_id;
  IF _familias IS NULL THEN RETURN; END IF;
  FOR _row IN SELECT r.id, v.metas, v.realizado, v.media
    FROM public.rep_performance_rows r LEFT JOIN performance_private.rep_row_values v ON v.row_id=r.id
    WHERE r.upload_id=_upload_id
  LOOP
    _fpct := '{}'::jsonb; _statuses := '{}'::jsonb; _row_meta := 0; _row_real := 0;
    FOREACH _f IN ARRAY _familias LOOP
      _meta := NULLIF(COALESCE(_row.metas,'{}'::jsonb)->>_f,'')::numeric;
      _real := NULLIF(COALESCE(_row.realizado,'{}'::jsonb)->>_f,'')::numeric;
      IF _meta IS NOT NULL AND _meta > 0 AND _real IS NOT NULL THEN
        _pct := round((_real/_meta)::numeric,6);
        _fpct := jsonb_set(_fpct,ARRAY[_f],to_jsonb(_pct),true);
        _statuses := jsonb_set(_statuses,ARRAY[_f],to_jsonb(performance_private.farol_from_ratio(_pct)),true);
        _row_meta := _row_meta + _meta; _row_real := _row_real + _real;
      END IF;
    END LOOP;
    UPDATE public.rep_performance_rows SET familia_pct=_fpct, metas_status=_statuses,
      total_pct=CASE WHEN _row_meta>0 THEN round((_row_real/_row_meta)::numeric,6) ELSE NULL END,
      total_pct_status=CASE WHEN _row_meta>0 THEN performance_private.farol_from_ratio(_row_real/_row_meta) ELSE NULL END
    WHERE id=_row.id;
    IF _row_meta>0 THEN _global_meta:=_global_meta+_row_meta; _global_real:=_global_real+_row_real; _has_global:=true; END IF;
  END LOOP;
  UPDATE public.rep_performance_uploads SET calculation_version='performance_bi_v3_numeric_only',
    atingimento_geral=CASE WHEN _has_global AND _global_meta>0 THEN round((_global_real/_global_meta)::numeric,6) ELSE NULL END
  WHERE id=_upload_id;
END $$;
REVOKE ALL ON FUNCTION performance_private.recompute_upload_numeric(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION performance_private.recompute_upload_numeric(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.submit_performance_upload(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,performance_private AS $$
DECLARE _rep uuid:=(_payload->>'representative_id')::uuid; _company uuid; _uid uuid:=auth.uid();
  _old uuid; _upload uuid; _row jsonb; _row_id uuid; _ord int:=0; _fam text; _familias text[];
  _cat text; _targets jsonb:=COALESCE(_payload->'targets_matrix','{}'); _metas jsonb; _realizado jsonb;
  _media jsonb; _fpct jsonb; _statuses jsonb; _meta numeric; _real numeric; _med numeric; _pct numeric;
  _total_meta numeric; _row_meta_input numeric; _row_total_pct numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT company_id INTO _company FROM public.representatives WHERE id=_rep;
  IF _company IS NULL OR _company<>public.current_company_id() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT ARRAY(SELECT jsonb_array_elements_text(_payload->'familias')) INTO _familias;
  IF array_length(_familias,1) IS NULL THEN RAISE EXCEPTION 'familias vazio'; END IF;
  SELECT id INTO _old FROM public.rep_performance_uploads WHERE representative_id=_rep AND substituida_em IS NULL
    AND (lower(trim(periodo_label))=lower(trim(_payload->>'periodo_label')) OR
      (periodo_inicio IS NOT DISTINCT FROM NULLIF(_payload->>'periodo_inicio','')::date AND
       periodo_fim IS NOT DISTINCT FROM NULLIF(_payload->>'periodo_fim','')::date AND NULLIF(_payload->>'periodo_inicio','') IS NOT NULL))
    ORDER BY created_at DESC LIMIT 1;
  IF _old IS NOT NULL THEN UPDATE public.rep_performance_uploads SET substituida_em=now() WHERE id=_old; END IF;
  INSERT INTO public.rep_performance_uploads(company_id,representative_id,periodo_label,periodo_inicio,periodo_fim,familias,escala_percentual,filename,uploaded_by,origem,calculation_version,observacao)
  VALUES(_company,_rep,_payload->>'periodo_label',NULLIF(_payload->>'periodo_inicio','')::date,NULLIF(_payload->>'periodo_fim','')::date,
    _familias,'[]',_payload->>'filename',_uid,'importacao_deterministica','performance_bi_v3_numeric_only',NULLIF(_payload->>'diagnostic_summary','')) RETURNING id INTO _upload;
  IF _old IS NOT NULL THEN UPDATE public.rep_performance_uploads SET substituida_por=_upload WHERE id=_old; END IF;
  INSERT INTO performance_private.upload_category_family_targets(upload_id,categoria,familia,target_amount)
    SELECT _upload,c.key,f.key,f.value::text::numeric FROM jsonb_each(_targets)c CROSS JOIN jsonb_each(c.value)f
    WHERE jsonb_typeof(f.value)='number' AND f.value::text::numeric>0;
  INSERT INTO performance_private.rep_upload_values(upload_id,categoria_metas) VALUES(_upload,jsonb_build_object('__family_metas_by_category__',_targets));
  FOR _row IN SELECT value FROM jsonb_array_elements(COALESCE(_payload->'rows','[]')) LOOP
    IF COALESCE(btrim(_row->>'razao_social'),'')='' OR public.is_total_row(_row->>'razao_social') THEN CONTINUE; END IF;
    _ord:=_ord+1; _cat:=NULLIF(btrim(_row->>'categoria'),''); _metas:='{}'; _realizado:='{}'; _media:='{}'; _fpct:='{}'; _statuses:='{}'; _total_meta:=0;
    FOREACH _fam IN ARRAY _familias LOOP
      _meta:=NULLIF(_row#>>ARRAY['metas',_fam],'')::numeric;
      IF _meta IS NULL THEN _meta:=NULLIF(_targets#>>ARRAY[COALESCE(_cat,''),_fam],'')::numeric; END IF;
      _real:=NULLIF(_row#>>ARRAY['realizado',_fam],'')::numeric; _med:=NULLIF(_row#>>ARRAY['media',_fam],'')::numeric;
      _pct:=NULLIF(_row#>>ARRAY['familia_pct',_fam],'')::numeric;
      IF _pct IS NULL AND _meta>0 AND _real IS NOT NULL THEN _pct:=_real/_meta;
      ELSIF _pct IS NULL AND _meta>0 AND _med IS NOT NULL THEN _pct:=_med/_meta; END IF;
      IF _meta IS NOT NULL AND _meta>0 THEN _metas:=jsonb_set(_metas,ARRAY[_fam],to_jsonb(_meta),true); _total_meta:=_total_meta+_meta; END IF;
      IF _real IS NOT NULL THEN _realizado:=jsonb_set(_realizado,ARRAY[_fam],to_jsonb(_real),true); END IF;
      IF _med IS NOT NULL THEN _media:=jsonb_set(_media,ARRAY[_fam],to_jsonb(_med),true); END IF;
      IF _pct IS NOT NULL THEN _fpct:=jsonb_set(_fpct,ARRAY[_fam],to_jsonb(round(_pct,6)),true); _statuses:=jsonb_set(_statuses,ARRAY[_fam],to_jsonb(performance_private.farol_from_ratio(_pct)),true); END IF;
    END LOOP;
    _row_meta_input:=NULLIF(_row->>'total_meta','')::numeric; _row_total_pct:=NULLIF(_row->>'total_pct','')::numeric;
    INSERT INTO public.rep_performance_rows(company_id,upload_id,ordem,razao_social,categoria,metas_status,metas_cores,total_pct_status,familia_pct,total_pct)
    VALUES(_company,_upload,_ord,_row->>'razao_social',_cat,_statuses,'{}',performance_private.farol_from_ratio(_row_total_pct),_fpct,_row_total_pct) RETURNING id INTO _row_id;
    INSERT INTO performance_private.rep_row_values(row_id,upload_id,total_meta,metas,realizado,media)
    VALUES(_row_id,_upload,COALESCE(NULLIF(_total_meta,0),_row_meta_input),_metas,_realizado,_media);
  END LOOP;
  PERFORM performance_private.recompute_upload_numeric(_upload);
  RETURN jsonb_build_object('upload_id',_upload,'replaced_upload_id',_old,'calculation_version','performance_bi_v3_numeric_only');
END $$;
REVOKE ALL ON FUNCTION public.submit_performance_upload(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_performance_upload(jsonb) TO authenticated,service_role;

DO $$ DECLARE _id uuid; BEGIN FOR _id IN SELECT id FROM public.rep_performance_uploads LOOP PERFORM performance_private.recompute_upload_numeric(_id); END LOOP; END $$;