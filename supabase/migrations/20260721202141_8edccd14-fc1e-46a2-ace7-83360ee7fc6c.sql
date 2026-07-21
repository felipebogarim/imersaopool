
-- =============================================================
-- performance_v2: submissão validada + versionamento + matriz por upload
-- =============================================================

-- 1) calculation_version em uploads
ALTER TABLE public.rep_performance_uploads
  ADD COLUMN IF NOT EXISTS calculation_version text NOT NULL DEFAULT 'performance_v2';

-- Marca uploads pré-existentes como v1 (não recalculados pela nova regra)
UPDATE public.rep_performance_uploads SET calculation_version = 'performance_v1'
WHERE calculation_version = 'performance_v2' AND created_at < now() - interval '1 minute';

-- 2) Matriz financeira por upload (privada) — 21 combinações categoria×família
CREATE TABLE IF NOT EXISTS performance_private.upload_category_family_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.rep_performance_uploads(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  familia text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (upload_id, categoria, familia)
);
GRANT ALL ON performance_private.upload_category_family_targets TO service_role;
CREATE INDEX IF NOT EXISTS ucft_upload_idx ON performance_private.upload_category_family_targets(upload_id);

-- 3) RPC de submissão atômica com validação de matriz
-- Payload:
-- {
--   representative_id: uuid,
--   periodo_label: text,
--   periodo_inicio: date|null,
--   periodo_fim: date|null,
--   familias: text[],
--   filename: text,
--   targets_matrix: { [categoria]: { [familia]: number } },  -- OBRIGATÓRIA e completa
--   rows: [
--     { razao_social, categoria, total_pct_status,
--       metas_status: { [familia]: 'sem_compra'|'abaixo_meta'|... },
--     }
--   ]
-- }
-- Retorno: { upload_id, replaced_upload_id, warnings: [] }
CREATE OR REPLACE FUNCTION public.submit_performance_upload(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, performance_private
AS $$
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

  -- Autoriza: usuário da mesma empresa
  IF _company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'Acesso negado à empresa deste representante';
  END IF;

  SELECT ARRAY(SELECT jsonb_array_elements_text(_payload->'familias')) INTO _familias;
  IF array_length(_familias,1) IS NULL THEN RAISE EXCEPTION 'familias vazio'; END IF;

  -- Categorias efetivamente presentes nos rows
  SELECT ARRAY(
    SELECT DISTINCT r->>'categoria'
    FROM jsonb_array_elements(_rows) r
    WHERE COALESCE(r->>'categoria','') <> ''
  ) INTO _categorias_usadas;

  -- Validação: matriz financeira completa para cada categoria usada × cada família
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
  IF _missing <> '' THEN
    RAISE EXCEPTION 'Matriz financeira incompleta. Faltam: %', _missing
      USING HINT = 'Cadastre metas em R$ por categoria × família antes de reenviar.';
  END IF;

  -- Marca upload anterior como substituído (mesmo rep + mesmo período_label ou datas)
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

  -- Cria novo upload
  INSERT INTO public.rep_performance_uploads(
    company_id, representative_id, periodo_label, periodo_inicio, periodo_fim,
    familias, escala_percentual, filename, uploaded_by, origem, calculation_version
  ) VALUES (
    _company_id, _rep_id, _periodo_label, _periodo_inicio, _periodo_fim,
    _familias, '[]'::jsonb, _filename, _uid,
    CASE WHEN _replaced_id IS NULL THEN 'ia' ELSE 'ia-atualizada' END,
    'performance_v2'
  ) RETURNING id INTO _new_upload_id;

  IF _replaced_id IS NOT NULL THEN
    UPDATE public.rep_performance_uploads SET substituida_por = _new_upload_id WHERE id = _replaced_id;
  END IF;

  -- Persiste matriz de metas do upload
  INSERT INTO performance_private.upload_category_family_targets(upload_id, categoria, familia, target_amount)
  SELECT _new_upload_id, cat.key, fam.key, (fam.value)::numeric
  FROM jsonb_each(_targets) cat, jsonb_each_text(cat.value) fam
  WHERE fam.value IS NOT NULL AND fam.value <> '' AND (fam.value)::numeric > 0;

  -- categoria_metas para trigger de recomputação: soma das famílias por categoria
  SELECT jsonb_object_agg(cat, tot)
    INTO _cat_meta_sum
  FROM (
    SELECT cat.key AS cat, SUM((fam.value)::numeric) AS tot
    FROM jsonb_each(_targets) cat, jsonb_each_text(cat.value) fam
    GROUP BY cat.key
  ) s;

  -- Também injeta __family_metas_by_category__ para a função compute_bi_shares
  _fam_by_cat := _targets;

  INSERT INTO performance_private.rep_upload_values(upload_id, categoria_metas)
  VALUES (_new_upload_id,
    COALESCE(_cat_meta_sum,'{}'::jsonb) || jsonb_build_object('__family_metas_by_category__', _fam_by_cat));

  -- Insere linhas
  FOR _row IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    _ordem := _ordem + 1;
    _cat := COALESCE(_row->>'categoria','');
    _metas := COALESCE(_row->'metas_status','{}'::jsonb);
    _row_metas := '{}'::jsonb;
    _realizado := '{}'::jsonb;
    _total_meta := 0;

    -- Para cada família: meta = matriz[cat][fam] (se cat existe); realizado = meta × fator(faixa)
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
      company_id, upload_id, ordem, razao_social, categoria, metas_status, total_pct_status
    ) VALUES (
      _company_id, _new_upload_id, _ordem,
      _row->>'razao_social', NULLIF(_cat,''),
      _metas, NULLIF(_row->>'total_pct_status','')
    ) RETURNING id INTO _row_id;

    INSERT INTO performance_private.rep_row_values(row_id, upload_id, total_meta, metas, realizado)
    VALUES (_row_id, _new_upload_id, NULLIF(_total_meta,0), _row_metas, _realizado);
  END LOOP;

  -- Dispara recomputação global do upload (participação/atingimento agregados)
  PERFORM performance_private.recompute_upload(_new_upload_id);

  RETURN jsonb_build_object(
    'upload_id', _new_upload_id,
    'replaced_upload_id', _replaced_id,
    'calculation_version', 'performance_v2'
  );
END $$;

REVOKE ALL ON FUNCTION public.submit_performance_upload(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_performance_upload(jsonb) TO authenticated;
