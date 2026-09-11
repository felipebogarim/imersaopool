CREATE OR REPLACE FUNCTION performance_private.recompute_upload_numeric(_upload_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, performance_private AS $$
DECLARE _row record; _f text; _familias text[]; _meta numeric; _real numeric; _pct numeric; _prev numeric;
  _fpct jsonb; _statuses jsonb; _row_meta numeric; _row_real numeric; _eff numeric;
  _global_meta numeric := 0; _global_real numeric := 0; _has_global boolean := false;
BEGIN
  SELECT familias INTO _familias FROM public.rep_performance_uploads WHERE id=_upload_id;
  IF _familias IS NULL THEN RETURN; END IF;
  FOR _row IN SELECT r.id, r.familia_pct, v.metas, v.realizado, v.media
    FROM public.rep_performance_rows r LEFT JOIN performance_private.rep_row_values v ON v.row_id=r.id
    WHERE r.upload_id=_upload_id
  LOOP
    _fpct := '{}'::jsonb; _statuses := '{}'::jsonb; _row_meta := 0; _row_real := 0;
    FOREACH _f IN ARRAY _familias LOOP
      _meta := NULLIF(COALESCE(_row.metas,'{}'::jsonb)->>_f,'')::numeric;
      _real := NULLIF(COALESCE(_row.realizado,'{}'::jsonb)->>_f,'')::numeric;
      _prev := NULLIF(COALESCE(_row.familia_pct,'{}'::jsonb)->>_f,'')::numeric;
      _pct := NULL; _eff := NULL;
      IF _meta IS NOT NULL AND _meta > 0 AND _real IS NOT NULL THEN
        _pct := round((_real/_meta)::numeric,6); _eff := _real;
      ELSIF _prev IS NOT NULL THEN
        _pct := round(_prev,6);
        _eff := CASE WHEN _meta IS NOT NULL AND _meta > 0 THEN _pct*_meta ELSE NULL END;
      END IF;
      IF _pct IS NOT NULL THEN
        _fpct := jsonb_set(_fpct,ARRAY[_f],to_jsonb(_pct),true);
        _statuses := jsonb_set(_statuses,ARRAY[_f],to_jsonb(performance_private.farol_from_ratio(_pct)),true);
        IF _eff IS NOT NULL AND _meta IS NOT NULL AND _meta > 0 THEN _row_meta := _row_meta + _meta; _row_real := _row_real + _eff; END IF;
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

DO $$
DECLARE
  _u record; _r record; _f text; _result numeric; _meta numeric; _ratio numeric;
  _fpct jsonb; _statuses jsonb; _metas jsonb; _realizado jsonb;
  _matrix constant jsonb := '{"Black":{"DECOR NEWLINE":8000,"DECOR STUDIO":6000,"SISTEMAS E MÓDULOS":10000,"PRO LED":3000,"PRO LAMP":4000,"PERFIL":7000,"FITAS E FONTES":3000},"Gold":{"DECOR NEWLINE":2500,"DECOR STUDIO":3000,"SISTEMAS E MÓDULOS":2500,"PRO LED":1500,"PRO LAMP":1500,"PERFIL":2000,"FITAS E FONTES":2000},"Silver":{"DECOR NEWLINE":1000,"DECOR STUDIO":1500,"SISTEMAS E MÓDULOS":1000,"PRO LED":500,"PRO LAMP":1000,"PERFIL":1000,"FITAS E FONTES":1000}}'::jsonb;
BEGIN
  FOR _u IN
    SELECT u.id,u.representative_id,u.periodo_label,u.familias
    FROM public.rep_performance_uploads u JOIN public.representatives rp ON rp.id=u.representative_id
    WHERE rp.nome='ANDERSON BASSO' AND u.substituida_em IS NULL
  LOOP
    DELETE FROM performance_private.upload_category_family_targets WHERE upload_id=_u.id;
    INSERT INTO performance_private.upload_category_family_targets(upload_id,categoria,familia,target_amount)
      SELECT _u.id,c.key,f.key,(f.value::text)::numeric FROM jsonb_each(_matrix)c CROSS JOIN jsonb_each(c.value)f;
    UPDATE performance_private.rep_upload_values
      SET categoria_metas=jsonb_build_object('__family_metas_by_category__',_matrix)
      WHERE upload_id=_u.id;

    FOR _r IN
      SELECT pr.id,pr.razao_social,pr.categoria
      FROM public.rep_performance_rows pr WHERE pr.upload_id=_u.id
    LOOP
      _fpct:='{}'::jsonb; _statuses:='{}'::jsonb; _metas:='{}'::jsonb; _realizado:='{}'::jsonb;
      FOREACH _f IN ARRAY _u.familias LOOP
        _result:=NULL;
        SELECT NULLIF(COALESCE(item->>'resultado',item->>'realizado',item->>'valor',item->>'atingimento'), '')::numeric
          INTO _result
        FROM public.client_bi_uploads c
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.data->'familias',c.data->'itens','[]'::jsonb)) item
        WHERE c.representative_id=_u.representative_id AND c.substituida_em IS NULL
          AND upper(btrim(c.razao_social))=upper(btrim(_r.razao_social))
          AND upper(btrim(item->>'familia'))=upper(btrim(_f))
        ORDER BY c.created_at DESC LIMIT 1;
        _meta:=NULLIF(_matrix#>>ARRAY[COALESCE(_r.categoria,''),_f],'')::numeric;
        IF _result IS NOT NULL AND _meta IS NOT NULL AND _meta>0 THEN
          -- BI legado guarda a faixa canônica em atingimento; quando houver um
          -- resultado monetário original, a razão resultado/meta prevalece.
          IF _result BETWEEN 0 AND 10 THEN
            _ratio:=_result;
            _realizado:=jsonb_set(_realizado,ARRAY[_f],to_jsonb(round(_ratio*_meta,6)),true);
          ELSE
            _ratio:=_result/_meta;
            _realizado:=jsonb_set(_realizado,ARRAY[_f],to_jsonb(_result),true);
          END IF;
          _metas:=jsonb_set(_metas,ARRAY[_f],to_jsonb(_meta),true);
          _fpct:=jsonb_set(_fpct,ARRAY[_f],to_jsonb(round(_ratio,6)),true);
          _statuses:=jsonb_set(_statuses,ARRAY[_f],to_jsonb(performance_private.farol_from_ratio(_ratio)),true);
        END IF;
      END LOOP;
      UPDATE performance_private.rep_row_values SET metas=_metas,realizado=_realizado WHERE row_id=_r.id;
      UPDATE public.rep_performance_rows SET familia_pct=_fpct,metas_status=_statuses,metas_cores='{}'::jsonb WHERE id=_r.id;
    END LOOP;
    PERFORM performance_private.recompute_upload_numeric(_u.id);
  END LOOP;
END $$;