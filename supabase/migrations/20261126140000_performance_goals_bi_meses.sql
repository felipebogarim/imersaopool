-- BI Metas por período: além das metas vigentes hoje ('items'), devolve todos os ciclos do
-- cliente com todas as versões de meta ('cycles'), para o front calcular a meta de qualquer
-- mês (versão com maior vigente_desde <= mês, dentro do ciclo que contém o mês; fora de ciclo
-- vale a meta padrão). Mesma assinatura, permissão e escopo de 20261126130000.

CREATE OR REPLACE FUNCTION public.get_performance_goals_bi(_row_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _company uuid := public.current_company_id();
  _m date := public.performance_goal_month();
BEGIN
  IF _company IS NULL OR NOT public.is_admin_or_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'row_id', r.id,
      'representative_id', u.representative_id,
      'rep_regiao', rep.regiao,
      'cliente_regiao', cl.regiao,
      'cliente_uf', cl.estado,
      'cliente_cidade', cl.cidade,
      'ciclo_inicio', cy.inicio,
      'ciclo_fim', cy.fim,
      'metas', COALESCE(v.metas, '{}'::jsonb),
      'realizado', COALESCE(v.realizado, '{}'::jsonb),
      'media', COALESCE(v.media, '{}'::jsonb),
      'familia_pct', COALESCE(r.familia_pct, '{}'::jsonb),
      'items', COALESCE(it.items, '[]'::jsonb),
      'cycles', COALESCE(cs.cycles, '[]'::jsonb)
    ))
    FROM public.rep_performance_rows r
    JOIN public.rep_performance_uploads u ON u.id = r.upload_id
    LEFT JOIN public.representatives rep ON rep.id = u.representative_id
    LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
    LEFT JOIN LATERAL (
      SELECT c.id, c.inicio, c.fim, c.client_id
      FROM public.performance_goal_cycles c
      WHERE c.company_id = r.company_id
        AND c.representative_id = u.representative_id
        AND c.cliente_key = upper(btrim(r.razao_social))
      ORDER BY CASE WHEN c.inicio <= _m THEN 0 ELSE 1 END,
               CASE WHEN c.inicio <= _m THEN c.inicio END DESC NULLS LAST,
               c.inicio
      LIMIT 1
    ) cy ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'familia', i.familia, 'meta_mensal', i.meta_mensal, 'origem', i.origem)) AS items
      FROM (
        SELECT DISTINCT ON (i.familia) i.familia, i.meta_mensal, i.origem
        FROM public.performance_goal_items i
        WHERE i.cycle_id = cy.id AND i.vigente_desde <= GREATEST(_m, cy.inicio)
        ORDER BY i.familia, i.vigente_desde DESC
      ) i
    ) it ON true
    -- Todos os ciclos do cliente, com todas as versões de meta.
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'inicio', c.inicio, 'fim', c.fim,
        'items', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'familia', i.familia, 'vigente_desde', i.vigente_desde,
            'meta_mensal', i.meta_mensal, 'origem', i.origem) ORDER BY i.vigente_desde)
          FROM public.performance_goal_items i WHERE i.cycle_id = c.id), '[]'::jsonb)
      ) ORDER BY c.inicio) AS cycles
      FROM public.performance_goal_cycles c
      WHERE c.company_id = r.company_id
        AND c.representative_id = u.representative_id
        AND c.cliente_key = upper(btrim(r.razao_social))
    ) cs ON true
    LEFT JOIN LATERAL (
      SELECT c2.regiao, c2.estado, c2.cidade
      FROM public.clients c2
      WHERE c2.company_id = r.company_id
        AND (c2.id = cy.client_id OR upper(btrim(c2.razao_social)) = upper(btrim(r.razao_social)))
      ORDER BY COALESCE(c2.id = cy.client_id, false) DESC, c2.created_at DESC
      LIMIT 1
    ) cl ON true
    WHERE r.id = ANY(_row_ids) AND r.company_id = _company
  ), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.get_performance_goals_bi(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_performance_goals_bi(uuid[]) TO authenticated;
