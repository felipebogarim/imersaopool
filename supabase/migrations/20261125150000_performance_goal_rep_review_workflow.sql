-- Fluxo de revisão de metas pelo representante.
-- A migration é aplicada manualmente no SQL Editor do Lovable/Supabase.

CREATE TABLE IF NOT EXISTS public.performance_goal_rep_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL UNIQUE REFERENCES public.performance_goal_cycles(id) ON DELETE CASCADE,
  representative_id uuid NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'respondido', 'reabertura_solicitada', 'reaberto')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  invited_by uuid REFERENCES auth.users(id),
  submitted_at timestamptz,
  reopen_requested_at timestamptz,
  reopen_request_note text NOT NULL DEFAULT '',
  reopened_at timestamptz,
  reopened_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pgrr_rep_status_idx
  ON public.performance_goal_rep_reviews(representative_id, status);

ALTER TABLE public.performance_goal_rep_reviews ENABLE ROW LEVEL SECURITY;

-- Regra obrigatória para toda tabela public nova: representantes externos nunca acessam
-- diretamente. O portal usa apenas funções server-side com service_role e escopo conferido.
DROP POLICY IF EXISTS block_external_rep ON public.performance_goal_rep_reviews;
CREATE POLICY block_external_rep ON public.performance_goal_rep_reviews
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_external_rep(auth.uid()))
  WITH CHECK (NOT public.is_external_rep(auth.uid()));

CREATE OR REPLACE FUNCTION public.performance_goal_review_state(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
  _c public.performance_goal_cycles;
BEGIN
  SELECT * INTO _c FROM public.performance_goal_current_cycle(_ctx);
  IF _c.id IS NULL THEN RETURN NULL; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'status', r.status,
      'invited_at', r.invited_at,
      'submitted_at', r.submitted_at,
      'reopen_requested_at', r.reopen_requested_at,
      'reopen_request_note', r.reopen_request_note,
      'reopened_at', r.reopened_at
    )
    FROM public.performance_goal_rep_reviews r WHERE r.cycle_id = _c.id
  );
END $$;

CREATE OR REPLACE FUNCTION public.start_performance_goal_review(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
  _c public.performance_goal_cycles;
BEGIN
  SELECT * INTO _c FROM public.performance_goal_current_cycle(_ctx);
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Salve as metas antes de enviar o convite.'; END IF;
  INSERT INTO public.performance_goal_rep_reviews
    (company_id, cycle_id, representative_id, status, invited_at, invited_by,
     submitted_at, reopen_requested_at, reopen_request_note, reopened_at, reopened_by)
  VALUES
    (_c.company_id, _c.id, _c.representative_id, 'pendente', now(), auth.uid(),
     NULL, NULL, '', NULL, NULL)
  ON CONFLICT (cycle_id) DO UPDATE SET
    status = 'pendente', invited_at = now(), invited_by = auth.uid(),
    submitted_at = NULL, reopen_requested_at = NULL, reopen_request_note = '',
    reopened_at = NULL, reopened_by = NULL, updated_at = now();
  RETURN public.performance_goal_review_state(_row_id);
END $$;

CREATE OR REPLACE FUNCTION public.reopen_performance_goal_review(_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_staff_ctx(_row_id);
  _c public.performance_goal_cycles;
BEGIN
  SELECT * INTO _c FROM public.performance_goal_current_cycle(_ctx);
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Ciclo de metas não encontrado.'; END IF;
  UPDATE public.performance_goal_rep_reviews
  SET status = 'reaberto', reopened_at = now(), reopened_by = auth.uid(), updated_at = now()
  WHERE cycle_id = _c.id AND status = 'reabertura_solicitada';
  IF NOT FOUND THEN RAISE EXCEPTION 'Não há pedido de reabertura pendente.'; END IF;
  RETURN public.performance_goal_review_state(_row_id);
END $$;

-- Chamada somente pelo servidor do portal, após repForUser confirmar o usuário.
CREATE OR REPLACE FUNCTION public.rep_request_goal_review_reopen(
  _row_id uuid, _representative_id uuid, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_row_context(_row_id);
  _c public.performance_goal_cycles;
BEGIN
  IF _ctx IS NULL OR (_ctx->>'representative_id')::uuid IS DISTINCT FROM _representative_id THEN
    RAISE EXCEPTION 'Cliente fora da carteira.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _c FROM public.performance_goal_current_cycle(_ctx);
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Ciclo de metas não encontrado.'; END IF;
  UPDATE public.performance_goal_rep_reviews
  SET status = 'reabertura_solicitada', reopen_requested_at = now(),
      reopen_request_note = left(COALESCE(_note, ''), 1000), updated_at = now()
  WHERE cycle_id = _c.id AND status = 'respondido';
  IF NOT FOUND THEN RAISE EXCEPTION 'A revisão não está disponível para reabertura.'; END IF;
  RETURN jsonb_build_object('status', 'reabertura_solicitada');
END $$;

-- Ranking calculado dentro do banco sobre o schema privado. O portal recebe somente id e posição,
-- nunca o valor de faturamento. As linhas ainda são novamente limitadas ao representante informado.
CREATE OR REPLACE FUNCTION public.rep_goal_revenue_ranks(
  _representative_id uuid, _row_ids uuid[])
RETURNS TABLE(row_id uuid, top10_rank int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, performance_private AS $$
  WITH revenues AS (
    SELECT r.id AS row_id,
           COALESCE(SUM(CASE WHEN j.value ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
                             THEN GREATEST(j.value::numeric, 0) ELSE 0 END), 0) AS revenue
    FROM public.rep_performance_rows r
    JOIN public.rep_performance_uploads u ON u.id = r.upload_id
    LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
    LEFT JOIN LATERAL jsonb_each_text(COALESCE(v.realizado, '{}'::jsonb)) j ON true
    WHERE u.representative_id = _representative_id AND r.id = ANY(COALESCE(_row_ids, '{}'::uuid[]))
    GROUP BY r.id
  ), ranked AS (
    SELECT row_id, row_number() OVER (ORDER BY revenue DESC, row_id)::int AS top10_rank
    FROM revenues WHERE revenue > 0
  )
  SELECT row_id, top10_rank FROM ranked WHERE top10_rank <= 10
$$;

-- Substitui a função anterior: somente convite pendente ou reaberto pode ser enviado.
CREATE OR REPLACE FUNCTION public.rep_save_goal_suggestions(
  _row_id uuid, _representative_id uuid, _user_id uuid, _sugestoes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.performance_goal_row_context(_row_id);
  _c public.performance_goal_cycles;
  _review public.performance_goal_rep_reviews;
BEGIN
  IF _ctx IS NULL OR (_ctx->>'representative_id')::uuid IS DISTINCT FROM _representative_id THEN
    RAISE EXCEPTION 'Cliente fora da carteira.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _c FROM public.performance_goal_current_cycle(_ctx);
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Ciclo de metas não encontrado.'; END IF;
  SELECT * INTO _review FROM public.performance_goal_rep_reviews WHERE cycle_id = _c.id FOR UPDATE;
  IF _review.id IS NULL OR _review.status NOT IN ('pendente', 'reaberto') THEN
    RAISE EXCEPTION 'Esta revisão não está aberta para edição.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.performance_goal_rep_suggestions
    (company_id, cycle_id, familia, valor, justificativa, updated_by)
  SELECT _c.company_id, _c.id, s->>'familia', NULLIF(s->>'valor', '')::numeric,
         COALESCE(s->>'justificativa', ''), _user_id
  FROM jsonb_array_elements(COALESCE(_sugestoes, '[]'::jsonb)) s
  ON CONFLICT (cycle_id, familia) DO UPDATE SET
    valor = EXCLUDED.valor, justificativa = EXCLUDED.justificativa, updated_by = _user_id;

  UPDATE public.performance_goal_rep_reviews
  SET status = 'respondido', submitted_at = now(), updated_at = now()
  WHERE id = _review.id;
  RETURN public.performance_goal_state(_ctx, false);
END $$;

REVOKE ALL ON FUNCTION public.performance_goal_review_state(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_performance_goal_review(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reopen_performance_goal_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.performance_goal_review_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_performance_goal_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_performance_goal_review(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.rep_request_goal_review_reopen(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rep_request_goal_review_reopen(uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.rep_goal_revenue_ranks(uuid, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rep_goal_revenue_ranks(uuid, uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.rep_save_goal_suggestions(uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rep_save_goal_suggestions(uuid, uuid, uuid, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
