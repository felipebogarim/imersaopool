-- Performance → METAS: recomendação real da IA (complementa 20261124120000_performance_goals.sql).
--
-- * Aditiva e idempotente: não altera tabelas/cálculos existentes da Performance nem as metas
--   oficiais do BI; pode ser executada de novo sem efeito colateral.
-- * performance_goal_ai_suggestions ganha: `analise_id` (uma análise = 7 famílias),
--   `confianca` (alta/media/baixa), `participacao` (fração do total sugerido) e `base` (jsonb:
--   fontes usadas e resumo da análise). Tag passa a aceitar 'limitado' (Dados limitados).
-- * performance_goal_ai_context: dados do cliente para o modelo (só admin/gestor da empresa
--   ativa) — imersões (entrevistas, formulários de visita e do representante, relatórios),
--   histórico financeiro (R$), perfil e comparáveis agregados. Não envia pontos de farol.
-- * record_performance_goal_ai_suggestions: grava uma análise completa (só admin/gestor).
-- * performance_goal_state devolve só a última análise do modelo; registros "simulacao" da fase
--   de protótipo ficam no banco, ocultos.

ALTER TABLE public.performance_goal_ai_suggestions
  ADD COLUMN IF NOT EXISTS base jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS analise_id uuid,
  ADD COLUMN IF NOT EXISTS confianca text,
  ADD COLUMN IF NOT EXISTS participacao numeric(7,4);
ALTER TABLE public.performance_goal_ai_suggestions
  DROP CONSTRAINT IF EXISTS performance_goal_ai_suggestions_tag_check,
  DROP CONSTRAINT IF EXISTS performance_goal_ai_suggestions_confianca_check;
ALTER TABLE public.performance_goal_ai_suggestions
  ADD CONSTRAINT performance_goal_ai_suggestions_tag_check
    CHECK (tag IN ('imersao', 'tendencia', 'limitado')),
  ADD CONSTRAINT performance_goal_ai_suggestions_confianca_check
    CHECK (confianca IS NULL OR confianca IN ('alta', 'media', 'baixa'));
CREATE INDEX IF NOT EXISTS pgai_analise_idx
  ON public.performance_goal_ai_suggestions (cycle_id, created_at DESC) WHERE origem = 'modelo';

-- -----------------------------------------------------------------------------
-- Estado do cliente (mesma função da migration anterior; muda só o bloco `ai`).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.performance_goal_state(_ctx jsonb, _staff boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    SELECT * FROM public.performance_goal_current_cycle(_ctx)
  ), n AS (  -- próximo ciclo (renovação antecipada), começa no mês seguinte ao fim do vigente
    SELECT p.* FROM public.performance_goal_cycles p, c
    WHERE p.company_id = c.company_id AND p.representative_id = c.representative_id
      AND p.cliente_key = c.cliente_key AND p.inicio > c.fim
    ORDER BY p.inicio LIMIT 1
  ), items AS (  -- versão vigente no mês corrente (ou no 1º mês, se o ciclo ainda não começou)
    SELECT DISTINCT ON (i.familia) i.* FROM public.performance_goal_items i JOIN c ON c.id = i.cycle_id
    WHERE i.vigente_desde <= GREATEST(public.performance_goal_month(), c.inicio)
    ORDER BY i.familia, i.vigente_desde DESC
  ), versoes AS (  -- versões do ciclo vigente e do próximo, com o valor anterior
    SELECT i.*, lag(i.meta_mensal) OVER (PARTITION BY i.familia ORDER BY i.vigente_desde) AS anterior
    FROM public.performance_goal_items i
    WHERE i.cycle_id IN (SELECT id FROM c UNION ALL SELECT id FROM n)
  ), agendadas AS (  -- mudanças de meta em competências futuras
    SELECT v.* FROM versoes v, c
    WHERE v.vigente_desde > GREATEST(public.performance_goal_month(), c.inicio)
      AND v.meta_mensal IS DISTINCT FROM v.anterior
  ), ultima AS (  -- última análise do modelo (7 famílias gravadas juntas)
    SELECT a.analise_id FROM public.performance_goal_ai_suggestions a JOIN c ON c.id = a.cycle_id
    WHERE a.origem = 'modelo' AND a.analise_id IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1
  ), ai AS (
    SELECT a.* FROM public.performance_goal_ai_suggestions a JOIN ultima u ON u.analise_id = a.analise_id
  )
  SELECT jsonb_build_object(
    'cycle', (SELECT jsonb_build_object('id', id, 'inicio', inicio, 'fim', fim,
                'client_id', CASE WHEN _staff THEN client_id END,
                'vinculo_confirmado_em', CASE WHEN _staff THEN vinculo_confirmado_em END) FROM c),
    'proximo', CASE WHEN _staff THEN (SELECT jsonb_build_object('id', id, 'inicio', inicio,
                'fim', fim) FROM n) END,
    'items', COALESCE((SELECT jsonb_agg(CASE WHEN _staff THEN jsonb_build_object(
                'familia', familia, 'meta_mensal', meta_mensal, 'origem', origem,
                'comentario_gestor', comentario_gestor, 'vigente_desde', vigente_desde)
              ELSE jsonb_build_object('familia', familia, 'meta_mensal', meta_mensal) END)
              FROM items), '[]'::jsonb),
    'agendadas', CASE WHEN _staff THEN COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'familia', familia, 'meta_mensal', meta_mensal, 'vigente_desde', vigente_desde)
                ORDER BY vigente_desde) FROM agendadas), '[]'::jsonb) ELSE '[]'::jsonb END,
    'rep_suggestions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'familia', s.familia, 'valor', s.valor, 'justificativa', s.justificativa,
                'created_at', s.created_at, 'updated_at', s.updated_at))
              FROM public.performance_goal_rep_suggestions s JOIN c ON c.id = s.cycle_id), '[]'::jsonb),
    'ai_suggestions', CASE WHEN _staff THEN COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'familia', familia, 'valor', valor, 'justificativa', justificativa, 'tag', tag,
                'origem', origem, 'base', base, 'modelo', modelo, 'created_at', created_at,
                'confianca', confianca, 'participacao', participacao, 'analise_id', analise_id))
                FROM ai), '[]'::jsonb) ELSE '[]'::jsonb END,
    'base', jsonb_build_object('metas', _ctx->'metas', 'realizado', _ctx->'realizado',
                'media', _ctx->'media', 'familia_pct', _ctx->'familia_pct')
  )
$$;
REVOKE ALL ON FUNCTION public.performance_goal_state(jsonb, boolean) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Comparáveis: clientes da mesma categoria no upload vigente mais recente de cada representante
-- da empresa (na região indicada, se houver). Só médias em R$ por família; nada individual.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.performance_goal_ai_comparaveis(
  _company uuid, _cat text, _key text, _regiao text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ult AS (
    SELECT DISTINCT ON (u.representative_id) u.id
    FROM public.rep_performance_uploads u
    JOIN public.representatives rp ON rp.id = u.representative_id
    WHERE u.company_id = _company AND u.substituida_em IS NULL
      AND (_regiao IS NULL OR rp.regiao = _regiao)
    ORDER BY u.representative_id, u.periodo_inicio DESC NULLS LAST, u.created_at DESC
  ), cmp AS (
    SELECT v.realizado, v.media
    FROM public.rep_performance_rows r
    JOIN ult ON ult.id = r.upload_id
    LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
    WHERE r.categoria IS NOT DISTINCT FROM _cat AND upper(btrim(r.razao_social)) <> _key
  )
  SELECT jsonb_build_object(
    'clientes', (SELECT count(*) FROM cmp),
    'escopo', CASE WHEN _regiao IS NULL THEN 'empresa' ELSE 'regiao' END,
    'regiao', _regiao, 'categoria', _cat,
    'realizado_medio_rs', (SELECT jsonb_object_agg(k, round(m, 2)) FROM (
        SELECT e.key AS k, avg(e.value::numeric) AS m
        FROM cmp, jsonb_each_text(COALESCE(cmp.realizado, '{}'::jsonb)) e
        WHERE e.value ~ '^-?[0-9]+(\.[0-9]+)?$' GROUP BY e.key) a),
    'media_historica_media_rs', (SELECT jsonb_object_agg(k, round(m, 2)) FROM (
        SELECT e.key AS k, avg(e.value::numeric) AS m
        FROM cmp, jsonb_each_text(COALESCE(cmp.media, '{}'::jsonb)) e
        WHERE e.value ~ '^-?[0-9]+(\.[0-9]+)?$' GROUP BY e.key) a))
$$;
REVOKE ALL ON FUNCTION public.performance_goal_ai_comparaveis(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Contexto para a IA: cliente, perfil, histórico (R$), imersões e comparáveis.
-- Só admin/gestor da empresa ativa (performance_goal_staff_ctx). Valores financeiros só em R$
-- (realizado, média, meta do upload); atingimento por farol não é enviado.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.performance_goal_ai_context(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
  _company uuid := (_ctx->>'company_id')::uuid;
  _rep uuid := (_ctx->>'representative_id')::uuid;
  _key text := _ctx->>'cliente_key';
  _cat text := _ctx->>'categoria';
  _client_id uuid;
  _regiao text;
  _imm uuid[];
  _perfil jsonb;
  _hist jsonb;
  _entrevistas jsonb;
  _visitas jsonb;
  _rep_inputs jsonb;
  _imersoes jsonb;
  _relatorios jsonb;
  _comp jsonb;
BEGIN
  -- Vínculo confirmado no ciclo; senão, cadastro com a mesma razão social na empresa.
  SELECT client_id INTO _client_id FROM public.performance_goal_current_cycle(_ctx);
  IF _client_id IS NULL THEN
    SELECT id INTO _client_id FROM public.clients
    WHERE company_id = _company AND upper(btrim(razao_social)) = _key
    ORDER BY (representative_id = _rep) DESC NULLS LAST, updated_at DESC
    LIMIT 1;
  END IF;
  SELECT regiao INTO _regiao FROM public.representatives WHERE id = _rep;

  SELECT jsonb_build_object('categoria', COALESCE(c.categoria::text, _cat),
           'cidade', COALESCE(c.cidade, c.municipio), 'estado', c.estado,
           'regiao', COALESCE(c.regiao, _regiao), 'grupo', c.grupo_nome)
  INTO _perfil FROM public.clients c WHERE c.id = _client_id;
  _perfil := COALESCE(_perfil, jsonb_build_object('categoria', _cat, 'cidade', NULL,
               'estado', NULL, 'regiao', _regiao, 'grupo', NULL));

  -- Histórico financeiro do cliente nos uploads vigentes do representante (até 12 períodos).
  SELECT COALESCE(jsonb_agg(x.h ORDER BY x.ini), '[]'::jsonb) INTO _hist FROM (
    SELECT u.periodo_inicio AS ini, jsonb_build_object(
             'periodo', u.periodo_label, 'periodo_inicio', u.periodo_inicio,
             'periodo_fim', u.periodo_fim, 'realizado_rs', v.realizado,
             'media_historica_rs', v.media, 'meta_upload_rs', v.metas) AS h
    FROM public.rep_performance_rows r
    JOIN public.rep_performance_uploads u ON u.id = r.upload_id
    LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
    WHERE r.company_id = _company AND u.representative_id = _rep
      AND u.substituida_em IS NULL AND upper(btrim(r.razao_social)) = _key
    ORDER BY u.periodo_inicio DESC NULLS LAST, u.created_at DESC
    LIMIT 12) x;

  -- Imersões do cliente: vinculadas ao cadastro ou com entrevista da mesma razão social.
  SELECT array_agg(DISTINCT id) INTO _imm FROM (
    SELECT im.id FROM public.immersions im
    WHERE _client_id IS NOT NULL AND im.company_id = _company AND im.client_id = _client_id
    UNION
    SELECT i.immersion_id FROM public.interviews i
    WHERE i.company_id = _company AND i.immersion_id IS NOT NULL
      AND ((_client_id IS NOT NULL AND i.client_id = _client_id)
           OR upper(btrim(i.empresa_nome)) = _key)) s;

  SELECT COALESCE(jsonb_agg(x.e ORDER BY x.dt DESC), '[]'::jsonb) INTO _imersoes FROM (
    SELECT im.created_at AS dt, jsonb_build_object(
             'data', COALESCE(im.data_visita::text, im.created_at::date::text),
             'titulo', im.titulo, 'observacoes', left(im.observacoes, 1500)) AS e
    FROM public.immersions im WHERE im.id = ANY(COALESCE(_imm, '{}'))
    ORDER BY im.created_at DESC LIMIT 3) x;

  SELECT COALESCE(jsonb_agg(x.e ORDER BY x.dt DESC), '[]'::jsonb) INTO _entrevistas FROM (
    SELECT i.created_at AS dt, jsonb_build_object(
             'data', COALESCE(i.data_entrevista::text, i.created_at::date::text),
             'perfil', i.perfil, 'classificacao', i.entrevistado_classificacao,
             'observacoes', left(i.observacoes, 1500),
             'respostas', left(i.respostas::text, 3000)) AS e
    FROM public.interviews i
    WHERE i.company_id = _company
      AND ((_client_id IS NOT NULL AND i.client_id = _client_id)
           OR i.immersion_id = ANY(COALESCE(_imm, '{}'))
           OR upper(btrim(i.empresa_nome)) = _key)
    ORDER BY i.created_at DESC LIMIT 5) x;

  -- Formulários da visita: oportunidades, concorrência, exposição, loja, comercial.
  SELECT COALESCE(jsonb_agg(x.e ORDER BY x.dt DESC), '[]'::jsonb) INTO _visitas FROM (
    SELECT f.created_at AS dt, jsonb_build_object(
             'data', f.created_at::date::text, 'oportunidades', left(f.oportunidades, 1500),
             'comercial', left(f.observacoes_comerciais, 1500),
             'concorrentes', left(f.observacoes_concorrentes, 1500),
             'exposicao', left(f.observacoes_exposicao, 800),
             'loja', left(f.observacoes_loja, 800), 'texto', left(f.texto, 1500)) AS e
    FROM public.field_visit_inputs f WHERE f.immersion_id = ANY(COALESCE(_imm, '{}'))
    ORDER BY f.created_at DESC LIMIT 4) x;

  -- Respostas do representante: negociação, potencial, ameaças, concorrência, mix.
  SELECT COALESCE(jsonb_agg(x.e ORDER BY x.dt DESC), '[]'::jsonb) INTO _rep_inputs FROM (
    SELECT r.created_at AS dt, jsonb_build_object(
             'data', COALESCE(r.submitted_at, r.created_at)::date::text,
             'oportunidades', left(r.oportunidades, 1000),
             'potencial_aumento', left(r.potencial_aumento, 1000),
             'negociacao', left(r.negociacao, 1000), 'ameacas', left(r.ameacas, 1000),
             'marcas_concorrentes', left(r.marcas_concorrentes, 600),
             'familias_mais_compradas', left(r.familias_mais_compradas, 600),
             'acoes_faturamento', left(r.acoes_faturamento, 1000),
             'cuidados', left(r.cuidados, 600), 'texto_livre', left(r.texto_livre, 1500)) AS e
    FROM public.representative_inputs r WHERE r.immersion_id = ANY(COALESCE(_imm, '{}'))
    ORDER BY r.created_at DESC LIMIT 3) x;

  SELECT COALESCE(jsonb_agg(x.e ORDER BY x.dt DESC), '[]'::jsonb) INTO _relatorios FROM (
    SELECT f.visit_date AS dt, jsonb_build_object(
             'data', f.visit_date::text, 'conteudo', left(f.content_markdown, 5000)) AS e
    FROM public.field_immersion_v2_reports f
    WHERE f.company_id = _company AND upper(btrim(f.client_name)) = _key
    ORDER BY f.visit_date DESC LIMIT 2) x;

  -- Comparáveis: região do representante; com menos de 3, a empresa toda (mesma categoria).
  _comp := public.performance_goal_ai_comparaveis(_company, _cat, _key, _regiao);
  IF (_comp->>'clientes')::int < 3 AND _regiao IS NOT NULL THEN
    _comp := public.performance_goal_ai_comparaveis(_company, _cat, _key, NULL);
  END IF;
  IF (_comp->>'clientes')::int < 3 THEN
    _comp := jsonb_build_object('clientes', (_comp->>'clientes')::int, 'regiao', _regiao,
               'categoria', _cat, 'insuficiente', true);
  END IF;

  RETURN jsonb_build_object(
    'cliente', jsonb_build_object('razao_social', _ctx->>'razao_social', 'categoria', _cat,
                 'periodo', _ctx->>'periodo_label', 'meta_upload_rs', _ctx->'metas',
                 'realizado_rs', _ctx->'realizado', 'media_historica_rs', _ctx->'media'),
    'perfil', _perfil,
    'historico', _hist,
    'imersao', jsonb_build_object('entrevistas', _entrevistas, 'visitas', _visitas,
                 'representante', _rep_inputs, 'imersoes', _imersoes,
                 'relatorios', _relatorios),
    'comparaveis', _comp);
END $$;

-- Uma análise completa: _sugestoes = [{familia, valor, justificativa, tag, confianca,
-- participacao, base}] (validadas no servidor). Todas recebem o mesmo analise_id.
CREATE OR REPLACE FUNCTION public.record_performance_goal_ai_suggestions(
  _row_id uuid, _sugestoes jsonb, _modelo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
  _uid uuid := auth.uid();
  _c public.performance_goal_cycles := public.performance_goal_ensure_cycle(_ctx, _uid);
  _analise uuid := gen_random_uuid();
BEGIN
  IF jsonb_array_length(COALESCE(_sugestoes, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Análise vazia.';
  END IF;
  INSERT INTO public.performance_goal_ai_suggestions
    (company_id, cycle_id, familia, valor, justificativa, tag, origem, modelo, base,
     analise_id, confianca, participacao, created_by)
  SELECT _c.company_id, _c.id, s->>'familia', round((s->>'valor')::numeric, 2),
         left(COALESCE(s->>'justificativa', ''), 4000), s->>'tag', 'modelo', left(_modelo, 200),
         COALESCE(s->'base', '{}'::jsonb), _analise, s->>'confianca',
         round(NULLIF(s->>'participacao', '')::numeric, 4), _uid
  FROM jsonb_array_elements(_sugestoes) s;
  RETURN public.performance_goal_state(_ctx, true);
END $$;

REVOKE ALL ON FUNCTION public.performance_goal_ai_context(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_performance_goal_ai_suggestions(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.performance_goal_ai_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_performance_goal_ai_suggestions(uuid, jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
