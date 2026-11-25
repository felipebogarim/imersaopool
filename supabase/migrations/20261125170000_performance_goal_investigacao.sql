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

NOTIFY pgrst, 'reload schema';
