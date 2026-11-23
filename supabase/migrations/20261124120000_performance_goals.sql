-- Performance → METAS: metas mensais personalizadas por cliente, dentro de ciclos de vigência.
--
-- * Não substitui as metas oficiais do BI: rep_performance_*, performance_private.* e os
--   cálculos de farol ficam intactos (só leitura do realizado/metas para o recálculo).
-- * Escrita sempre por RPC SECURITY DEFINER com checagem de papel; leitura direta por RLS
--   apenas para admin/gestor da empresa ativa.
-- * Representante (usuário externo) continua bloqueado em todas as tabelas
--   (block_external_rep) e acessa somente por server functions (service role), escopadas
--   ao representante vinculado — por isso as RPCs rep_* são executáveis só pelo service_role.
-- * Histórico imutável de toda alteração em ciclos, metas e sugestões do representante.

-- =============================================================================
-- 1. Tabelas
-- =============================================================================

-- Ciclo de vigência (normalmente 6 meses; pode ser estendido até 12 ou renovado).
-- inicio/fim = 1º dia do primeiro e do último mês do ciclo.
CREATE TABLE public.performance_goal_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  representative_id uuid NOT NULL REFERENCES public.representatives(id),
  cliente_key text NOT NULL,            -- upper(btrim(razao_social)), mesmo critério da importação
  razao_social text NOT NULL,
  categoria text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,  -- vínculo confirmado (opcional)
  vinculo_confirmado_por uuid REFERENCES auth.users(id),
  vinculo_confirmado_em timestamptz,
  inicio date NOT NULL,
  fim date NOT NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado')),
  renovado_de uuid REFERENCES public.performance_goal_cycles(id),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pgc_meses CHECK (extract(day FROM inicio) = 1 AND extract(day FROM fim) = 1),
  CONSTRAINT pgc_duracao CHECK (fim >= inicio AND fim <= (inicio + interval '11 months')::date)
);
CREATE UNIQUE INDEX pgc_um_ativo_por_cliente
  ON public.performance_goal_cycles (company_id, representative_id, cliente_key)
  WHERE status = 'ativo';
CREATE INDEX pgc_rep_idx ON public.performance_goal_cycles (representative_id, cliente_key);

-- Meta mensal por portfólio. Alterar a meta durante a vigência cria uma nova linha a partir da
-- competência escolhida pelo gestor (vigente_desde); a meta de um mês M é a linha com maior
-- vigente_desde <= M. Versões anteriores permanecem (e cada alteração vai para o histórico).
CREATE TABLE public.performance_goal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  cycle_id uuid NOT NULL REFERENCES public.performance_goal_cycles(id) ON DELETE CASCADE,
  familia text NOT NULL CHECK (familia IN ('DECOR NEWLINE', 'DECOR STUDIO', 'SISTEMAS E MÓDULOS',
    'PRO LED', 'PRO LAMP', 'PERFIL', 'FITAS E FONTES')),
  vigente_desde date NOT NULL CHECK (extract(day FROM vigente_desde) = 1),
  meta_mensal numeric(14,2) CHECK (meta_mensal IS NULL OR meta_mensal >= 0),
  origem text NOT NULL CHECK (origem IN ('padrao', 'ia', 'representante', 'gestor')),
  comentario_gestor text NOT NULL DEFAULT '',        -- interno: nunca enviado ao representante
  referencia_snapshot numeric(14,2),                 -- meta padrão vigente ao salvar
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, familia, vigente_desde)
);

-- Sugestão vigente do representante (versões anteriores ficam no histórico).
CREATE TABLE public.performance_goal_rep_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  cycle_id uuid NOT NULL REFERENCES public.performance_goal_cycles(id) ON DELETE CASCADE,
  familia text NOT NULL CHECK (familia IN ('DECOR NEWLINE', 'DECOR STUDIO', 'SISTEMAS E MÓDULOS',
    'PRO LED', 'PRO LAMP', 'PERFIL', 'FITAS E FONTES')),
  valor numeric(14,2) CHECK (valor IS NULL OR valor >= 0),
  justificativa text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, familia)
);

-- Registro das sugestões da IA (somente inserção).
CREATE TABLE public.performance_goal_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  cycle_id uuid NOT NULL REFERENCES public.performance_goal_cycles(id) ON DELETE CASCADE,
  familia text NOT NULL CHECK (familia IN ('DECOR NEWLINE', 'DECOR STUDIO', 'SISTEMAS E MÓDULOS',
    'PRO LED', 'PRO LAMP', 'PERFIL', 'FITAS E FONTES')),
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  justificativa text NOT NULL DEFAULT '',
  tag text NOT NULL CHECK (tag IN ('imersao', 'tendencia')),
  origem text NOT NULL CHECK (origem IN ('simulacao', 'modelo')),
  modelo text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pgai_cycle_idx ON public.performance_goal_ai_suggestions (cycle_id, familia, created_at DESC);

-- Histórico imutável.
CREATE TABLE public.performance_goal_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  tabela text NOT NULL,
  acao text NOT NULL CHECK (acao IN ('insert', 'update', 'delete')),
  familia text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pgh_cycle_idx ON public.performance_goal_history (cycle_id, changed_at DESC);

-- =============================================================================
-- 2. Triggers (updated_at + histórico)
-- =============================================================================

CREATE TRIGGER pgc_touch BEFORE UPDATE ON public.performance_goal_cycles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER pgi_touch BEFORE UPDATE ON public.performance_goal_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER pgrs_touch BEFORE UPDATE ON public.performance_goal_rep_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.performance_goal_log_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _new jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  _old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  _ref jsonb := COALESCE(_new, _old);
BEGIN
  IF TG_OP = 'UPDATE' AND (_new - 'updated_at') = (_old - 'updated_at') THEN
    RETURN NEW;  -- nada mudou de fato
  END IF;
  INSERT INTO public.performance_goal_history
    (company_id, cycle_id, tabela, acao, familia, dados_anteriores, dados_novos, changed_by)
  VALUES (
    (_ref->>'company_id')::uuid,
    COALESCE(_ref->>'cycle_id', _ref->>'id')::uuid,
    TG_TABLE_NAME,
    lower(TG_OP),
    _ref->>'familia',
    _old,
    _new,
    COALESCE(auth.uid(), NULLIF(_ref->>'updated_by', '')::uuid)
  );
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE ALL ON FUNCTION public.performance_goal_log_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pgc_history AFTER INSERT OR UPDATE OR DELETE ON public.performance_goal_cycles
  FOR EACH ROW EXECUTE FUNCTION public.performance_goal_log_change();
CREATE TRIGGER pgi_history AFTER INSERT OR UPDATE OR DELETE ON public.performance_goal_items
  FOR EACH ROW EXECUTE FUNCTION public.performance_goal_log_change();
CREATE TRIGGER pgrs_history AFTER INSERT OR UPDATE OR DELETE ON public.performance_goal_rep_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.performance_goal_log_change();

-- =============================================================================
-- 3. Permissões e RLS
-- =============================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['performance_goal_cycles', 'performance_goal_items',
    'performance_goal_rep_suggestions', 'performance_goal_ai_suggestions',
    'performance_goal_history']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    -- Leitura direta só para gestão; nenhuma escrita direta (somente pelas RPCs abaixo).
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
      'USING (company_id = public.current_company_id() AND public.is_admin_or_gestor(auth.uid()))',
      t || '_staff_select', t);
    EXECUTE format(
      'CREATE POLICY block_external_rep ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT NOT public.is_external_rep(auth.uid()))) '
      'WITH CHECK ((SELECT NOT public.is_external_rep(auth.uid())))', t);
  END LOOP;
END $$;

-- =============================================================================
-- 4. Funções internas
-- =============================================================================

CREATE OR REPLACE FUNCTION public.performance_goal_month(_d date DEFAULT current_date)
RETURNS date LANGUAGE sql IMMUTABLE AS $$ SELECT date_trunc('month', _d::timestamp)::date $$;

-- Linha de Performance → identidade do cliente (empresa, representante, chave, base financeira).
CREATE OR REPLACE FUNCTION public.performance_goal_row_context(_row_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'company_id', r.company_id,
    'representative_id', u.representative_id,
    'razao_social', btrim(r.razao_social),
    'cliente_key', upper(btrim(r.razao_social)),
    'categoria', r.categoria,
    'periodo_label', u.periodo_label,
    'familia_pct', COALESCE(r.familia_pct, '{}'::jsonb),
    'metas', COALESCE(v.metas, '{}'::jsonb),
    'realizado', COALESCE(v.realizado, '{}'::jsonb),
    'media', COALESCE(v.media, '{}'::jsonb)
  )
  FROM public.rep_performance_rows r
  JOIN public.rep_performance_uploads u ON u.id = r.upload_id
  LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
  WHERE r.id = _row_id
$$;

-- Ciclo ativo do cliente; cria um de 6 meses a partir do mês corrente se não houver.
CREATE OR REPLACE FUNCTION public.performance_goal_ensure_cycle(_ctx jsonb, _actor uuid)
RETURNS public.performance_goal_cycles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.performance_goal_cycles; _m date := public.performance_goal_month();
BEGIN
  SELECT * INTO _c FROM public.performance_goal_cycles
  WHERE company_id = (_ctx->>'company_id')::uuid
    AND representative_id = (_ctx->>'representative_id')::uuid
    AND cliente_key = _ctx->>'cliente_key' AND status = 'ativo'
  FOR UPDATE;
  IF FOUND THEN RETURN _c; END IF;
  INSERT INTO public.performance_goal_cycles
    (company_id, representative_id, cliente_key, razao_social, categoria, inicio, fim,
     created_by, updated_by)
  VALUES ((_ctx->>'company_id')::uuid, (_ctx->>'representative_id')::uuid, _ctx->>'cliente_key',
     _ctx->>'razao_social', _ctx->>'categoria', _m, (_m + interval '5 months')::date,
     _actor, _actor)
  RETURNING * INTO _c;
  RETURN _c;
END $$;

-- Estado do cliente: ciclo, metas vigentes, sugestões e base financeira.
-- _staff = false omite comentário do gestor, meta padrão e IA (visão do representante).
CREATE OR REPLACE FUNCTION public.performance_goal_state(_ctx jsonb, _staff boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    SELECT * FROM public.performance_goal_cycles
    WHERE company_id = (_ctx->>'company_id')::uuid
      AND representative_id = (_ctx->>'representative_id')::uuid
      AND cliente_key = _ctx->>'cliente_key' AND status = 'ativo'
  ), items AS (  -- versão vigente no mês corrente (ou no 1º mês, se o ciclo ainda não começou)
    SELECT DISTINCT ON (i.familia) i.* FROM public.performance_goal_items i JOIN c ON c.id = i.cycle_id
    WHERE i.vigente_desde <= GREATEST(public.performance_goal_month(), c.inicio)
    ORDER BY i.familia, i.vigente_desde DESC
  ), agendadas AS (  -- versões que passam a valer em competências futuras
    SELECT i.* FROM public.performance_goal_items i JOIN c ON c.id = i.cycle_id
    WHERE i.vigente_desde > GREATEST(public.performance_goal_month(), c.inicio)
  ), ai AS (
    SELECT DISTINCT ON (a.familia) a.* FROM public.performance_goal_ai_suggestions a
    JOIN c ON c.id = a.cycle_id ORDER BY a.familia, a.created_at DESC
  )
  SELECT jsonb_build_object(
    'cycle', (SELECT jsonb_build_object('id', id, 'inicio', inicio, 'fim', fim,
                'client_id', CASE WHEN _staff THEN client_id END,
                'vinculo_confirmado_em', CASE WHEN _staff THEN vinculo_confirmado_em END) FROM c),
    'items', COALESCE((SELECT jsonb_agg(CASE WHEN _staff THEN jsonb_build_object(
                'familia', familia, 'meta_mensal', meta_mensal, 'origem', origem,
                'comentario_gestor', comentario_gestor, 'vigente_desde', vigente_desde)
              ELSE jsonb_build_object('familia', familia, 'meta_mensal', meta_mensal) END)
              FROM items), '[]'::jsonb),
    'agendadas', CASE WHEN _staff THEN COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'familia', familia, 'meta_mensal', meta_mensal, 'vigente_desde', vigente_desde)
                ORDER BY vigente_desde) FROM agendadas), '[]'::jsonb) ELSE '[]'::jsonb END,
    'rep_suggestions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'familia', s.familia, 'valor', s.valor, 'justificativa', s.justificativa))
              FROM public.performance_goal_rep_suggestions s JOIN c ON c.id = s.cycle_id), '[]'::jsonb),
    'ai_suggestions', CASE WHEN _staff THEN COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'familia', familia, 'valor', valor, 'justificativa', justificativa, 'tag', tag,
                'origem', origem)) FROM ai), '[]'::jsonb) ELSE '[]'::jsonb END,
    'base', jsonb_build_object('metas', _ctx->'metas', 'realizado', _ctx->'realizado',
                'media', _ctx->'media', 'familia_pct', _ctx->'familia_pct')
  )
$$;

REVOKE ALL ON FUNCTION public.performance_goal_row_context(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.performance_goal_ensure_cycle(jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.performance_goal_state(jsonb, boolean) FROM PUBLIC, anon, authenticated;

-- Contexto da linha + checagem de gestão (admin/gestor da empresa ativa).
CREATE OR REPLACE FUNCTION public.performance_goal_staff_ctx(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _ctx jsonb := public.performance_goal_row_context(_row_id);
BEGIN
  IF _ctx IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;
  IF NOT public.is_admin_or_gestor(auth.uid())
     OR (_ctx->>'company_id')::uuid IS DISTINCT FROM public.current_company_id() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  RETURN _ctx;
END $$;
REVOKE ALL ON FUNCTION public.performance_goal_staff_ctx(uuid) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 5. RPCs da gestão (admin/gestor)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_performance_goals(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.performance_goal_state(public.performance_goal_staff_ctx(_row_id), true);
END $$;

-- _metas: [{familia, meta_mensal, origem, comentario_gestor, referencia}]
-- _sugestoes_ia: [{familia, valor, justificativa, tag, origem}]
-- _vigente_desde: competência a partir da qual as metas valem (padrão: mês corrente);
-- precisa estar dentro do ciclo ativo.
CREATE OR REPLACE FUNCTION public.save_performance_goals(
  _row_id uuid, _metas jsonb, _sugestoes_ia jsonb, _vigente_desde date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
  _uid uuid := auth.uid();
  _c public.performance_goal_cycles := public.performance_goal_ensure_cycle(_ctx, _uid);
  _desde date := COALESCE(public.performance_goal_month(_vigente_desde),
                          GREATEST(public.performance_goal_month(), _c.inicio));
  _m jsonb;
BEGIN
  IF _desde < _c.inicio OR _desde > _c.fim THEN
    RAISE EXCEPTION 'Competência fora do ciclo vigente.';
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

-- Renova: encerra o ciclo atual e abre outro (6 ou 12 meses) copiando as metas vigentes.
CREATE OR REPLACE FUNCTION public.renew_performance_goal_cycle(_row_id uuid, _meses int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
  _uid uuid := auth.uid();
  _old public.performance_goal_cycles := public.performance_goal_ensure_cycle(_ctx, _uid);
  _inicio date := GREATEST(public.performance_goal_month(), (_old.fim + interval '1 month')::date);
  _new_id uuid;
BEGIN
  IF _meses NOT IN (6, 12) THEN RAISE EXCEPTION 'Ciclo deve ter 6 ou 12 meses.'; END IF;
  UPDATE public.performance_goal_cycles SET status = 'encerrado', updated_by = _uid WHERE id = _old.id;
  INSERT INTO public.performance_goal_cycles
    (company_id, representative_id, cliente_key, razao_social, categoria, client_id,
     vinculo_confirmado_por, vinculo_confirmado_em, inicio, fim, renovado_de, created_by, updated_by)
  VALUES (_old.company_id, _old.representative_id, _old.cliente_key, _ctx->>'razao_social',
     _ctx->>'categoria', _old.client_id, _old.vinculo_confirmado_por, _old.vinculo_confirmado_em,
     _inicio, (_inicio + make_interval(months => _meses - 1))::date, _old.id, _uid, _uid)
  RETURNING id INTO _new_id;
  INSERT INTO public.performance_goal_items
    (company_id, cycle_id, familia, vigente_desde, meta_mensal, origem, comentario_gestor,
     referencia_snapshot, updated_by)
  SELECT DISTINCT ON (familia) company_id, _new_id, familia, _inicio, meta_mensal, origem,
         comentario_gestor, referencia_snapshot, _uid
  FROM public.performance_goal_items WHERE cycle_id = _old.id
  ORDER BY familia, vigente_desde DESC;
  RETURN public.performance_goal_state(_ctx, true);
END $$;

-- Estende o ciclo ativo para 12 meses a partir do início.
CREATE OR REPLACE FUNCTION public.extend_performance_goal_cycle(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
  _c public.performance_goal_cycles := public.performance_goal_ensure_cycle(_ctx, auth.uid());
BEGIN
  UPDATE public.performance_goal_cycles
  SET fim = (_c.inicio + interval '11 months')::date, updated_by = auth.uid()
  WHERE id = _c.id;
  RETURN public.performance_goal_state(_ctx, true);
END $$;

-- Confirma manualmente o vínculo da linha de Performance com um cadastro de cliente.
CREATE OR REPLACE FUNCTION public.confirm_performance_goal_link(_row_id uuid, _client_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
  _c public.performance_goal_cycles := public.performance_goal_ensure_cycle(_ctx, auth.uid());
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clients
                 WHERE id = _client_id AND company_id = _c.company_id) THEN
    RAISE EXCEPTION 'Cadastro de cliente inválido.';
  END IF;
  UPDATE public.performance_goal_cycles
  SET client_id = _client_id, vinculo_confirmado_por = auth.uid(),
      vinculo_confirmado_em = now(), updated_by = auth.uid()
  WHERE id = _c.id;
  RETURN public.performance_goal_state(_ctx, true);
END $$;

-- =============================================================================
-- 6. RPCs do representante (somente service_role, via server functions do portal)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rep_get_performance_goals(_row_id uuid, _representative_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _ctx jsonb := public.performance_goal_row_context(_row_id);
BEGIN
  IF _ctx IS NULL OR (_ctx->>'representative_id')::uuid IS DISTINCT FROM _representative_id THEN
    RAISE EXCEPTION 'Cliente fora da carteira.' USING ERRCODE = '42501';
  END IF;
  RETURN public.performance_goal_state(_ctx, false);
END $$;

-- _sugestoes: [{familia, valor, justificativa}]
CREATE OR REPLACE FUNCTION public.rep_save_goal_suggestions(
  _row_id uuid, _representative_id uuid, _user_id uuid, _sugestoes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_row_context(_row_id);
  _c public.performance_goal_cycles;
BEGIN
  IF _ctx IS NULL OR (_ctx->>'representative_id')::uuid IS DISTINCT FROM _representative_id THEN
    RAISE EXCEPTION 'Cliente fora da carteira.' USING ERRCODE = '42501';
  END IF;
  _c := public.performance_goal_ensure_cycle(_ctx, _user_id);
  INSERT INTO public.performance_goal_rep_suggestions
    (company_id, cycle_id, familia, valor, justificativa, updated_by)
  SELECT _c.company_id, _c.id, s->>'familia', NULLIF(s->>'valor', '')::numeric,
         COALESCE(s->>'justificativa', ''), _user_id
  FROM jsonb_array_elements(COALESCE(_sugestoes, '[]'::jsonb)) s
  ON CONFLICT (cycle_id, familia) DO UPDATE SET
    valor = EXCLUDED.valor, justificativa = EXCLUDED.justificativa, updated_by = _user_id;
  RETURN public.performance_goal_state(_ctx, false);
END $$;

REVOKE ALL ON FUNCTION public.get_performance_goals(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_performance_goals(uuid, jsonb, jsonb, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.renew_performance_goal_cycle(uuid, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.extend_performance_goal_cycle(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_performance_goal_link(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_performance_goals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_performance_goals(uuid, jsonb, jsonb, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_performance_goal_cycle(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_performance_goal_cycle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_performance_goal_link(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.rep_get_performance_goals(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rep_save_goal_suggestions(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rep_get_performance_goals(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rep_save_goal_suggestions(uuid, uuid, uuid, jsonb) TO service_role;

-- =============================================================================
-- 7. Menu: libera METAS para gestor (admin já vê tudo)
-- =============================================================================

INSERT INTO public.role_permissions (role, nav_key, allowed)
SELECT r.role, 'performance.metas', r.role = 'gestor'::public.app_role
FROM (VALUES ('gestor'::public.app_role), ('agente'::public.app_role), ('comercial'::public.app_role)) AS r(role)
ON CONFLICT (role, nav_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
