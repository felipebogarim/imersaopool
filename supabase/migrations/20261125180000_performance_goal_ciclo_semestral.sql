-- Metas → ciclos SEMPRE semestrais e fixos: 1º semestre (jan–jun) e 2º semestre (jul–dez).
-- Sem ciclos móveis (6 meses a partir do mês corrente) e sem extensão/renovação de 12 meses.
--   * ensure_cycle: o ciclo criado é o semestre que contém o mês corrente;
--   * renew: programa o PRÓXIMO semestre (o parâmetro _meses só aceita 6, mantido por compatibilidade);
--   * extend: desativado (erro explicativo);
--   * ciclos já gravados fora do calendário são realinhados ao semestre que contém o início.
-- Idempotente.

-- 1º dia do semestre que contém a data.
CREATE OR REPLACE FUNCTION public.performance_goal_semestre_inicio(_d date)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT make_date(extract(year FROM _d)::int, CASE WHEN extract(month FROM _d) <= 6 THEN 1 ELSE 7 END, 1)
$$;

-- Ciclo vigente; se o cliente não tiver nenhum, cria o semestre corrente (jan–jun ou jul–dez).
CREATE OR REPLACE FUNCTION public.performance_goal_ensure_cycle(_ctx jsonb, _actor uuid)
RETURNS public.performance_goal_cycles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _c public.performance_goal_cycles;
  _ini date := public.performance_goal_semestre_inicio(public.performance_goal_month());
BEGIN
  PERFORM public.performance_goal_lock(_ctx);
  SELECT * INTO _c FROM public.performance_goal_current_cycle(_ctx);
  IF _c.id IS NOT NULL THEN RETURN _c; END IF;
  INSERT INTO public.performance_goal_cycles
    (company_id, representative_id, cliente_key, razao_social, categoria, inicio, fim,
     created_by, updated_by)
  VALUES ((_ctx->>'company_id')::uuid, (_ctx->>'representative_id')::uuid, _ctx->>'cliente_key',
     _ctx->>'razao_social', _ctx->>'categoria', _ini, (_ini + interval '5 months')::date,
     _actor, _actor)
  RETURNING * INTO _c;
  RETURN _c;
END $$;
REVOKE ALL ON FUNCTION public.performance_goal_ensure_cycle(jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- Renovação: cria o PRÓXIMO semestre logo após o último ciclo do cliente, copiando as metas
-- vigentes ao final dele. O ciclo atual segue até o fim do semestre. Só um ciclo futuro por vez.
CREATE OR REPLACE FUNCTION public.renew_performance_goal_cycle(_row_id uuid, _meses int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
  _uid uuid := auth.uid();
  _cur public.performance_goal_cycles := public.performance_goal_ensure_cycle(_ctx, _uid);
  _last public.performance_goal_cycles;
  _inicio date;
  _new_id uuid;
BEGIN
  IF _meses IS DISTINCT FROM 6 THEN
    RAISE EXCEPTION 'Os ciclos de metas são semestrais (jan–jun / jul–dez).';
  END IF;
  SELECT * INTO _last FROM public.performance_goal_cycles
  WHERE company_id = _cur.company_id AND representative_id = _cur.representative_id
    AND cliente_key = _cur.cliente_key
  ORDER BY inicio DESC LIMIT 1;
  IF _last.inicio > public.performance_goal_month() THEN
    RAISE EXCEPTION 'Já existe um próximo semestre programado.';
  END IF;
  _inicio := public.performance_goal_semestre_inicio((_last.fim + interval '1 month')::date);
  IF _inicio <= _last.fim THEN
    _inicio := (_inicio + interval '6 months')::date;
  END IF;
  INSERT INTO public.performance_goal_cycles
    (company_id, representative_id, cliente_key, razao_social, categoria, client_id,
     vinculo_confirmado_por, vinculo_confirmado_em, inicio, fim, renovado_de, created_by, updated_by)
  VALUES (_last.company_id, _last.representative_id, _last.cliente_key, _ctx->>'razao_social',
     _ctx->>'categoria', _last.client_id, _last.vinculo_confirmado_por, _last.vinculo_confirmado_em,
     _inicio, (_inicio + interval '5 months')::date, _last.id, _uid, _uid)
  RETURNING id INTO _new_id;
  INSERT INTO public.performance_goal_items
    (company_id, cycle_id, familia, vigente_desde, meta_mensal, origem, comentario_gestor,
     referencia_snapshot, updated_by)
  SELECT DISTINCT ON (familia) company_id, _new_id, familia, _inicio, meta_mensal, origem,
         comentario_gestor, referencia_snapshot, _uid
  FROM public.performance_goal_items WHERE cycle_id = _last.id
  ORDER BY familia, vigente_desde DESC;
  RETURN public.performance_goal_state(_ctx, true);
END $$;

-- Extensão para 12 meses não existe mais: o ciclo é sempre o semestre.
CREATE OR REPLACE FUNCTION public.extend_performance_goal_cycle(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.performance_goal_staff_ctx(_row_id);
  RAISE EXCEPTION 'Os ciclos de metas são semestrais (jan–jun / jul–dez); use "Renovar: próximo semestre".';
END $$;

REVOKE ALL ON FUNCTION public.renew_performance_goal_cycle(uuid, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.extend_performance_goal_cycle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_performance_goal_cycle(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_performance_goal_cycle(uuid) TO authenticated;

-- Realinha ciclos já gravados fora do calendário (ex.: nov/26–abr/27 → jul/26–dez/26).
-- As metas gravadas continuam com o mesmo `vigente_desde` (sempre >= novo início).
-- Se o semestre de destino já pertencer a outro ciclo do mesmo cliente, o ciclo fica como está.
DO $$
DECLARE
  r record;
  _ini date;
  _fim date;
  _ok int := 0;
  _skip int := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.performance_goal_cycles
    WHERE inicio <> public.performance_goal_semestre_inicio(inicio)
       OR fim <> (public.performance_goal_semestre_inicio(inicio) + interval '5 months')::date
    ORDER BY inicio
  LOOP
    _ini := public.performance_goal_semestre_inicio(r.inicio);
    _fim := (_ini + interval '5 months')::date;
    IF EXISTS (
      SELECT 1 FROM public.performance_goal_cycles o
      WHERE o.company_id = r.company_id AND o.representative_id = r.representative_id
        AND o.cliente_key = r.cliente_key AND o.id <> r.id
        AND o.inicio <= _fim AND o.fim >= _ini
    ) THEN
      _skip := _skip + 1;
      RAISE NOTICE 'Ciclo % (% a %) não realinhado: o semestre já tem outro ciclo.', r.id, r.inicio, r.fim;
      CONTINUE;
    END IF;
    UPDATE public.performance_goal_cycles SET inicio = _ini, fim = _fim WHERE id = r.id;
    -- Ciclo renovado: as metas copiadas no início antigo passam a valer desde o novo início
    -- (senão os meses antecipados ficariam sem meta). Ciclo original: nada muda (meses passados).
    IF r.renovado_de IS NOT NULL AND _ini < r.inicio THEN
      UPDATE public.performance_goal_items SET vigente_desde = _ini
      WHERE cycle_id = r.id AND vigente_desde = r.inicio;
    END IF;
    _ok := _ok + 1;
  END LOOP;
  RAISE NOTICE 'Ciclos realinhados ao semestre: %, mantidos: %.', _ok, _skip;
END $$;

NOTIFY pgrst, 'reload schema';
