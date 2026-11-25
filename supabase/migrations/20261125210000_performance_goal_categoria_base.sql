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

NOTIFY pgrst, 'reload schema';
