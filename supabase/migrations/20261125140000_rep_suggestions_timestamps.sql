-- Migration incremental: inclui created_at e updated_at nas sugestões do representante
-- para exibição da data de envio na tela de metas.

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
