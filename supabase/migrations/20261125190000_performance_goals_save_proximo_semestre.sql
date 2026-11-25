-- Metas → salvar com competência no PRÓXIMO semestre (padrão da tela: 1º mês do próximo semestre,
-- ex.: jan/27). Se o próximo semestre ainda não foi programado, ele é criado na hora (como a
-- renovação: copia as metas vigentes ao fim do ciclo atual) e as metas salvas valem a partir da
-- competência escolhida. Depende de 20261125180000_performance_goal_ciclo_semestral.sql
-- (performance_goal_semestre_inicio). Idempotente.

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
