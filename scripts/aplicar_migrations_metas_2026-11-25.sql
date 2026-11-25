-- Pacote único das migrations de Metas de 25/11/2026 (cole tudo no SQL Editor do Lovable e execute).
-- Ordem obrigatória: 170000 → 180000 → 190000 → 200000 → 210000 → 220000. Tudo numa transação:
-- se algo falhar, nada é aplicado. Pode ser executado de novo sem efeito colateral.

BEGIN;

-- ===================== 20261125170000_performance_goal_investigacao =====================
-- Metas → flag "Em investigação" por cliente (gestão).
-- Marcado pelo gestor quando foi aberto um processo de investigação mais detalhada sobre o
-- cliente antes de definir a meta. Aparece como alerta na coluna de status da carteira.
-- Identidade do cliente = (empresa, representante, cliente_key), igual a performance_goal_cycles.
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.performance_goal_investigations (
  company_id uuid NOT NULL REFERENCES public.companies(id),
  representative_id uuid NOT NULL REFERENCES public.representatives(id),
  cliente_key text NOT NULL,
  em_investigacao boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, representative_id, cliente_key)
);

ALTER TABLE public.performance_goal_investigations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.performance_goal_investigations FROM PUBLIC, anon, authenticated;
-- Leitura direta só para gestão; escrita somente pela RPC abaixo.
GRANT SELECT ON public.performance_goal_investigations TO authenticated;
GRANT ALL ON public.performance_goal_investigations TO service_role;

DROP POLICY IF EXISTS performance_goal_investigations_staff_select
  ON public.performance_goal_investigations;
CREATE POLICY performance_goal_investigations_staff_select
  ON public.performance_goal_investigations FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()));

DROP POLICY IF EXISTS block_external_rep ON public.performance_goal_investigations;
CREATE POLICY block_external_rep ON public.performance_goal_investigations
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT NOT public.is_external_rep(auth.uid())))
  WITH CHECK ((SELECT NOT public.is_external_rep(auth.uid())));

-- Leitura do flag de um cliente (linha de Performance).
CREATE OR REPLACE FUNCTION public.get_performance_goal_investigation(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
  _i public.performance_goal_investigations;
BEGIN
  SELECT * INTO _i FROM public.performance_goal_investigations
  WHERE company_id = (_ctx->>'company_id')::uuid
    AND representative_id = (_ctx->>'representative_id')::uuid
    AND cliente_key = _ctx->>'cliente_key';
  RETURN jsonb_build_object(
    'em_investigacao', COALESCE(_i.em_investigacao, false),
    'updated_at', _i.updated_at
  );
END $$;

-- Marca/desmarca o flag.
CREATE OR REPLACE FUNCTION public.set_performance_goal_investigation(_row_id uuid, _ativo boolean)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
BEGIN
  IF _ctx->>'representative_id' IS NULL THEN
    RAISE EXCEPTION 'Cliente sem representante vinculado.';
  END IF;
  INSERT INTO public.performance_goal_investigations AS i
    (company_id, representative_id, cliente_key, em_investigacao, updated_by, updated_at)
  VALUES ((_ctx->>'company_id')::uuid, (_ctx->>'representative_id')::uuid,
          _ctx->>'cliente_key', COALESCE(_ativo, false), auth.uid(), now())
  ON CONFLICT (company_id, representative_id, cliente_key) DO UPDATE
    SET em_investigacao = EXCLUDED.em_investigacao,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at;
  RETURN public.get_performance_goal_investigation(_row_id);
END $$;

REVOKE ALL ON FUNCTION public.get_performance_goal_investigation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_performance_goal_investigation(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_performance_goal_investigation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_performance_goal_investigation(uuid, boolean) TO authenticated;


-- ===================== 20261125180000_performance_goal_ciclo_semestral =====================
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


-- ===================== 20261125190000_performance_goals_save_proximo_semestre =====================
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


-- ===================== 20261125200000_performance_goal_minimos =====================
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


-- ===================== 20261125210000_performance_goal_categoria_base =====================
-- Metas → base da CATEGORIA do cliente (somente leitura; não altera dados importados).
-- Devolve todos os uploads vigentes (não substituídos) do representante que têm a linha do
-- cliente, com período e valores por portfólio (realizado, média), para o painel apurar a média
-- mensal do SEMESTRE de corte com a origem de cada valor. Só gestão (admin/gestor da empresa).

CREATE OR REPLACE FUNCTION public.get_performance_goal_categoria_base(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
BEGIN
  RETURN jsonb_build_object(
    'categoria', _ctx->>'categoria',
    'uploads', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'upload_id', u.id,
               'row_id', r.id,
               'atual', r.id = _row_id,
               'periodo_label', u.periodo_label,
               'periodo_inicio', u.periodo_inicio,
               'periodo_fim', u.periodo_fim,
               'realizado', COALESCE(v.realizado, '{}'::jsonb),
               'media', COALESCE(v.media, '{}'::jsonb))
             ORDER BY u.periodo_inicio NULLS LAST, u.created_at)
      FROM public.rep_performance_rows r
      JOIN public.rep_performance_uploads u ON u.id = r.upload_id
      LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
      WHERE r.company_id = (_ctx->>'company_id')::uuid
        AND u.representative_id = (_ctx->>'representative_id')::uuid
        AND (u.substituida_em IS NULL OR r.id = _row_id)
        AND upper(btrim(r.razao_social)) = _ctx->>'cliente_key'
    ), '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.get_performance_goal_categoria_base(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_performance_goal_categoria_base(uuid) TO authenticated;



-- ===================== 20261125220000_rep_support_requests =====================
-- Portal do representante → SOLICITAÇÕES DE APOIO (materiais para eventos, ações de trade,
-- material de PDV/exposição, amostras e catálogos).
--
-- O representante cria e acompanha os pedidos pelo portal (server functions com service role,
-- sempre escopadas ao representante vinculado ao usuário). A equipe interna (admin/gestor da
-- empresa) lê e responde pelo próprio token (RLS). Usuário externo não acessa a tabela direto.

CREATE TABLE IF NOT EXISTS public.rep_support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  representative_id UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('material_evento', 'acao_trade', 'material_pdv', 'amostras')),
  titulo TEXT NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 3 AND 200),
  cliente TEXT,
  acao_trade_tipo TEXT,
  data_evento DATE,
  data_necessaria DATE,
  local TEXT,
  publico_estimado INTEGER CHECK (publico_estimado IS NULL OR publico_estimado >= 0),
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_analise', 'aprovada', 'recusada', 'concluida')),
  resposta TEXT,
  respondido_por UUID REFERENCES auth.users(id),
  respondido_em TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rep_support_requests_rep
  ON public.rep_support_requests(representative_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rep_support_requests_company_status
  ON public.rep_support_requests(company_id, status, created_at DESC);

GRANT SELECT, UPDATE ON public.rep_support_requests TO authenticated;
GRANT ALL ON public.rep_support_requests TO service_role;
ALTER TABLE public.rep_support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rep_support_requests_staff_select ON public.rep_support_requests;
CREATE POLICY rep_support_requests_staff_select ON public.rep_support_requests
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()));

DROP POLICY IF EXISTS rep_support_requests_staff_update ON public.rep_support_requests;
CREATE POLICY rep_support_requests_staff_update ON public.rep_support_requests
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()))
  WITH CHECK (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()));

-- Blindagem padrão: representante (usuário externo) não acessa pelo token dele.
DROP POLICY IF EXISTS block_external_rep ON public.rep_support_requests;
CREATE POLICY block_external_rep ON public.rep_support_requests AS RESTRICTIVE FOR ALL
  TO authenticated
  USING ((SELECT NOT public.is_external_rep(auth.uid())))
  WITH CHECK ((SELECT NOT public.is_external_rep(auth.uid())));


COMMIT;

NOTIFY pgrst, 'reload schema';
