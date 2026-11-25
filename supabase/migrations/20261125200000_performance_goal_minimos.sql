-- Metas → mínimos por categoria e portfólio (configurados pela gestão).
-- A meta do gestor abaixo do mínimo da categoria do cliente é bloqueada no banco; a sugestão IA
-- aceita (origem 'ia', ex.: convite em massa) é elevada ao mínimo. Inclui a regra da migration
-- 20261125190000 (salvar no próximo semestre cria o ciclo); aplicar DEPOIS dela. Idempotente.

CREATE TABLE IF NOT EXISTS public.performance_goal_minimums (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  categoria text NOT NULL,          -- Silver | Gold | Black
  familia text NOT NULL,            -- portfólio canônico (ex.: PERFIL)
  minimo numeric NOT NULL CHECK (minimo >= 0),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, categoria, familia)
);

ALTER TABLE public.performance_goal_minimums ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.performance_goal_minimums FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.performance_goal_minimums TO authenticated;
GRANT ALL ON public.performance_goal_minimums TO service_role;

DROP POLICY IF EXISTS performance_goal_minimums_staff_select ON public.performance_goal_minimums;
CREATE POLICY performance_goal_minimums_staff_select ON public.performance_goal_minimums
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()));

DROP POLICY IF EXISTS block_external_rep ON public.performance_goal_minimums;
CREATE POLICY block_external_rep ON public.performance_goal_minimums
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT NOT public.is_external_rep(auth.uid())))
  WITH CHECK ((SELECT NOT public.is_external_rep(auth.uid())));

-- Lista os mínimos da empresa ativa: [{categoria, familia, minimo}].
CREATE OR REPLACE FUNCTION public.get_performance_goal_minimums()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_or_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('categoria', categoria, 'familia', familia,
                                        'minimo', minimo) ORDER BY categoria, familia)
    FROM public.performance_goal_minimums WHERE company_id = public.current_company_id()
  ), '[]'::jsonb);
END $$;

-- Substitui os mínimos da empresa ativa: _itens = [{categoria, familia, minimo|null}]
-- (null ou ausente = sem mínimo para aquele par).
CREATE OR REPLACE FUNCTION public.set_performance_goal_minimums(_itens jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _cid uuid := public.current_company_id();
BEGIN
  IF NOT public.is_admin_or_gestor(auth.uid()) OR _cid IS NULL THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.performance_goal_minimums WHERE company_id = _cid;
  INSERT INTO public.performance_goal_minimums (company_id, categoria, familia, minimo, updated_by)
  SELECT _cid, btrim(i->>'categoria'), btrim(i->>'familia'), (i->>'minimo')::numeric, auth.uid()
  FROM jsonb_array_elements(COALESCE(_itens, '[]'::jsonb)) i
  WHERE NULLIF(i->>'minimo', '') IS NOT NULL AND (i->>'minimo')::numeric >= 0
    AND btrim(COALESCE(i->>'categoria', '')) <> '' AND btrim(COALESCE(i->>'familia', '')) <> ''
  ON CONFLICT (company_id, categoria, familia) DO UPDATE
    SET minimo = EXCLUDED.minimo, updated_by = EXCLUDED.updated_by, updated_at = now();
  RETURN public.get_performance_goal_minimums();
END $$;

REVOKE ALL ON FUNCTION public.get_performance_goal_minimums() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_performance_goal_minimums(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_performance_goal_minimums() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_performance_goal_minimums(jsonb) TO authenticated;

-- save_performance_goals com a checagem do mínimo.
CREATE OR REPLACE FUNCTION public.save_performance_goals(
  _row_id uuid, _metas jsonb, _sugestoes_ia jsonb, _vigente_desde date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
  _uid uuid := auth.uid();
  _cur public.performance_goal_cycles := public.performance_goal_ensure_cycle(_ctx, _uid);
  _desde date := COALESCE(public.performance_goal_month(_vigente_desde),
                          GREATEST(public.performance_goal_month(), _cur.inicio));
  _c public.performance_goal_cycles;
  _last public.performance_goal_cycles;
  _prox date;
  _m jsonb;
  _min numeric;
  _valor numeric;
BEGIN
  SELECT * INTO _c FROM public.performance_goal_cycles
  WHERE company_id = _cur.company_id AND representative_id = _cur.representative_id
    AND cliente_key = _cur.cliente_key AND inicio >= _cur.inicio
    AND _desde BETWEEN inicio AND fim;

  IF _c.id IS NULL THEN
    -- Competência no semestre seguinte ao último ciclo: programa esse semestre agora.
    SELECT * INTO _last FROM public.performance_goal_cycles
    WHERE company_id = _cur.company_id AND representative_id = _cur.representative_id
      AND cliente_key = _cur.cliente_key
    ORDER BY inicio DESC LIMIT 1;
    _prox := public.performance_goal_semestre_inicio((_last.fim + interval '1 month')::date);
    IF _prox <= _last.fim THEN _prox := (_prox + interval '6 months')::date; END IF;
    IF _last.id IS DISTINCT FROM _cur.id
       OR _desde < _prox OR _desde > (_prox + interval '5 months')::date THEN
      RAISE EXCEPTION 'Competência fora do ciclo vigente e do próximo semestre.';
    END IF;
    INSERT INTO public.performance_goal_cycles
      (company_id, representative_id, cliente_key, razao_social, categoria, client_id,
       vinculo_confirmado_por, vinculo_confirmado_em, inicio, fim, renovado_de, created_by, updated_by)
    VALUES (_last.company_id, _last.representative_id, _last.cliente_key, _ctx->>'razao_social',
       _ctx->>'categoria', _last.client_id, _last.vinculo_confirmado_por, _last.vinculo_confirmado_em,
       _prox, (_prox + interval '5 months')::date, _last.id, _uid, _uid)
    RETURNING * INTO _c;
    INSERT INTO public.performance_goal_items
      (company_id, cycle_id, familia, vigente_desde, meta_mensal, origem, comentario_gestor,
       referencia_snapshot, updated_by)
    SELECT DISTINCT ON (familia) company_id, _c.id, familia, _prox, meta_mensal, origem,
           comentario_gestor, referencia_snapshot, _uid
    FROM public.performance_goal_items WHERE cycle_id = _last.id
    ORDER BY familia, vigente_desde DESC;
  END IF;

  FOR _m IN SELECT * FROM jsonb_array_elements(COALESCE(_metas, '[]'::jsonb)) LOOP
    -- Mínimo por categoria/portfólio: meta do gestor abaixo do mínimo é bloqueada;
    -- sugestão IA aceita em massa é elevada ao mínimo.
    SELECT mn.minimo INTO _min FROM public.performance_goal_minimums mn
    WHERE mn.company_id = _c.company_id
      AND lower(mn.categoria) = lower(btrim(COALESCE(_ctx->>'categoria', '')))
      AND mn.familia = _m->>'familia';
    _valor := NULLIF(_m->>'meta_mensal', '')::numeric;
    IF _min IS NOT NULL AND _valor IS NOT NULL AND _valor < _min THEN
      IF COALESCE(_m->>'origem', 'gestor') = 'ia' THEN
        _m := jsonb_set(_m, '{meta_mensal}', to_jsonb(_min));
      ELSE
        RAISE EXCEPTION 'Meta de % abaixo do mínimo de R$ % definido para a categoria %.',
          _m->>'familia', replace(to_char(_min, 'FM999,999,990'), ',', '.'), _ctx->>'categoria'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
    INSERT INTO public.performance_goal_items
      (company_id, cycle_id, familia, vigente_desde, meta_mensal, origem, comentario_gestor,
       referencia_snapshot, updated_by)
    VALUES (_c.company_id, _c.id, _m->>'familia', _desde, NULLIF(_m->>'meta_mensal', '')::numeric,
       COALESCE(_m->>'origem', 'gestor'), COALESCE(_m->>'comentario_gestor', ''),
       NULLIF(_m->>'referencia', '')::numeric, _uid)
    ON CONFLICT (cycle_id, familia, vigente_desde) DO UPDATE SET
      meta_mensal = EXCLUDED.meta_mensal, origem = EXCLUDED.origem,
      comentario_gestor = EXCLUDED.comentario_gestor,
      referencia_snapshot = EXCLUDED.referencia_snapshot, updated_by = _uid;
  END LOOP;
  INSERT INTO public.performance_goal_ai_suggestions
    (company_id, cycle_id, familia, valor, justificativa, tag, origem, created_by)
  SELECT _c.company_id, _c.id, s->>'familia', (s->>'valor')::numeric,
         COALESCE(s->>'justificativa', ''), s->>'tag', COALESCE(s->>'origem', 'simulacao'), _uid
  FROM jsonb_array_elements(COALESCE(_sugestoes_ia, '[]'::jsonb)) s
  WHERE NOT EXISTS (  -- não duplica a mesma sugestão já registrada por último
    SELECT 1 FROM (SELECT DISTINCT ON (familia) * FROM public.performance_goal_ai_suggestions
                   WHERE cycle_id = _c.id ORDER BY familia, created_at DESC) last
    WHERE last.familia = s->>'familia' AND last.valor = (s->>'valor')::numeric
      AND last.justificativa = COALESCE(s->>'justificativa', '') AND last.tag = s->>'tag');
  RETURN public.performance_goal_state(_ctx, true);
END $$;

REVOKE ALL ON FUNCTION public.save_performance_goals(uuid, jsonb, jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_performance_goals(uuid, jsonb, jsonb, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
