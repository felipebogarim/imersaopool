-- Performance → METAS → BI Metas: leitura agregável das metas vigentes de vários clientes.
--
-- * Somente gestão (admin/gestor) da empresa ativa — mesmo critério de get_performance_goals.
-- * Recebe as linhas de Performance já resolvidas no cliente (versão mais recente de cada
--   representante, mesma regra da listagem) e devolve, por linha: metas vigentes salvas
--   (performance_goal_items do ciclo vigente), base financeira do BI (R$) e a localização
--   do cliente (região/UF/cidade) para os recortes. A meta padrão por categoria e os
--   agregados são calculados no front (src/lib/performance-metas-bi.ts).
-- * Somente leitura; não toca em metas oficiais do BI nem nos ciclos.

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
      'items', COALESCE(it.items, '[]'::jsonb)
    ))
    FROM public.rep_performance_rows r
    JOIN public.rep_performance_uploads u ON u.id = r.upload_id
    LEFT JOIN public.representatives rep ON rep.id = u.representative_id
    LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
    -- Ciclo vigente: mesma ordenação de performance_goal_current_cycle.
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
    -- Metas vigentes no mês corrente (ou no 1º mês do ciclo, se ainda não começou).
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
    -- Cadastro do cliente: vínculo confirmado no ciclo; senão, razão social na empresa.
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
