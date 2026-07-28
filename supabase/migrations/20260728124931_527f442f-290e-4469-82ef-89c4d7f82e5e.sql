CREATE TABLE IF NOT EXISTS public._seed_payloads(id serial primary key, payload jsonb not null, done boolean not null default false);
GRANT ALL ON public._seed_payloads TO service_role;
GRANT ALL ON public._seed_payloads TO authenticated;
GRANT ALL ON SEQUENCE public._seed_payloads_id_seq TO authenticated, service_role;
ALTER TABLE public._seed_payloads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.seed_performance_upload(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','performance_private' AS $function$
DECLARE
  _rep_id uuid := (_payload->>'representative_id')::uuid;
  _company_id uuid;
  _periodo_label text := _payload->>'periodo_label';
  _periodo_inicio date := NULLIF(_payload->>'periodo_inicio','')::date;
  _periodo_fim date := NULLIF(_payload->>'periodo_fim','')::date;
  _filename text := _payload->>'filename';
  _familias text[];
  _targets jsonb := COALESCE(_payload->'targets_matrix','{}'::jsonb);
  _rows jsonb := COALESCE(_payload->'rows','[]'::jsonb);
  _new_upload_id uuid; _replaced_id uuid; _cat text; _fam text; _row jsonb; _row_id uuid;
  _ordem int := 0; _metas jsonb; _fam_target numeric; _status text; _factor numeric; _real_val numeric;
  _realizado jsonb; _row_metas jsonb; _cat_meta_sum jsonb := '{}'::jsonb; _total_meta numeric;
BEGIN
  SELECT company_id INTO _company_id FROM public.representatives WHERE id=_rep_id;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Representante nao encontrado'; END IF;
  SELECT ARRAY(SELECT jsonb_array_elements_text(_payload->'familias')) INTO _familias;

  SELECT id INTO _replaced_id FROM public.rep_performance_uploads
   WHERE representative_id=_rep_id AND substituida_em IS NULL
     AND (lower(trim(periodo_label))=lower(trim(_periodo_label))
       OR (periodo_inicio IS NOT DISTINCT FROM _periodo_inicio AND periodo_fim IS NOT DISTINCT FROM _periodo_fim AND _periodo_inicio IS NOT NULL))
   ORDER BY created_at DESC LIMIT 1;
  IF _replaced_id IS NOT NULL THEN
    UPDATE public.rep_performance_uploads SET substituida_em=now(), substituida_por=NULL WHERE id=_replaced_id;
  END IF;

  INSERT INTO public.rep_performance_uploads(company_id,representative_id,periodo_label,periodo_inicio,periodo_fim,familias,escala_percentual,filename,uploaded_by,origem,calculation_version)
  VALUES (_company_id,_rep_id,_periodo_label,_periodo_inicio,_periodo_fim,_familias,'[]'::jsonb,_filename,NULL,
    CASE WHEN _replaced_id IS NULL THEN 'ia' ELSE 'ia-atualizada' END,'performance_v2')
  RETURNING id INTO _new_upload_id;
  IF _replaced_id IS NOT NULL THEN
    UPDATE public.rep_performance_uploads SET substituida_por=_new_upload_id WHERE id=_replaced_id;
  END IF;

  INSERT INTO performance_private.upload_category_family_targets(upload_id,categoria,familia,target_amount)
  SELECT _new_upload_id, cat.key, fam.key, (fam.value)::numeric
  FROM jsonb_each(_targets) cat, jsonb_each_text(cat.value) fam
  WHERE fam.value IS NOT NULL AND fam.value<>'' AND (fam.value)::numeric>0;

  SELECT jsonb_object_agg(cat,tot) INTO _cat_meta_sum FROM (
    SELECT cat.key AS cat, SUM((fam.value)::numeric) AS tot
    FROM jsonb_each(_targets) cat, jsonb_each_text(cat.value) fam GROUP BY cat.key) s;

  INSERT INTO performance_private.rep_upload_values(upload_id,categoria_metas)
  VALUES (_new_upload_id, COALESCE(_cat_meta_sum,'{}'::jsonb) || jsonb_build_object('__family_metas_by_category__',_targets));

  FOR _row IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    _ordem := _ordem+1;
    _cat := COALESCE(_row->>'categoria','');
    _metas := COALESCE(_row->'metas_status','{}'::jsonb);
    _row_metas := '{}'::jsonb; _realizado := '{}'::jsonb; _total_meta := 0;
    FOREACH _fam IN ARRAY _familias LOOP
      _fam_target := COALESCE(NULLIF(_targets#>>ARRAY[_cat,_fam],'')::numeric,0);
      _status := COALESCE(_metas->>_fam,'');
      _factor := CASE _status WHEN 'sem_compra' THEN 0 WHEN 'abaixo_meta' THEN 0.25 WHEN 'pode_melhorar' THEN 0.60
        WHEN 'proximo' THEN 0.80 WHEN 'otimo' THEN 0.95 WHEN 'excelente' THEN 1.10 ELSE 0 END;
      _real_val := _fam_target*_factor;
      IF _fam_target>0 THEN
        _row_metas := jsonb_set(_row_metas,ARRAY[_fam],to_jsonb(_fam_target));
        _realizado := jsonb_set(_realizado,ARRAY[_fam],to_jsonb(_real_val));
      END IF;
      _total_meta := _total_meta + _fam_target;
    END LOOP;
    INSERT INTO public.rep_performance_rows(company_id,upload_id,ordem,razao_social,categoria,metas_status,total_pct_status)
    VALUES (_company_id,_new_upload_id,_ordem,_row->>'razao_social',NULLIF(_cat,''),_metas,NULLIF(_row->>'total_pct_status',''))
    RETURNING id INTO _row_id;
    INSERT INTO performance_private.rep_row_values(row_id,upload_id,total_meta,metas,realizado)
    VALUES (_row_id,_new_upload_id,NULLIF(_total_meta,0),_row_metas,_realizado);
  END LOOP;

  PERFORM performance_private.recompute_upload(_new_upload_id);
  RETURN jsonb_build_object('upload_id',_new_upload_id,'rows',_ordem);
END $function$;

CREATE OR REPLACE FUNCTION public.run_seed_payloads()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id, payload FROM public._seed_payloads WHERE NOT done ORDER BY id LOOP
    PERFORM public.seed_performance_upload(r.payload);
    UPDATE public._seed_payloads SET done = true WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('processed', n);
END $$;
GRANT EXECUTE ON FUNCTION public.run_seed_payloads() TO service_role;