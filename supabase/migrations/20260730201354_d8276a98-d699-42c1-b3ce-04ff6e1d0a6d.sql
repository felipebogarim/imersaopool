-- 1) Ao excluir um upload, reativa a versão que ele substituiu (se não houver outra ativa)
CREATE OR REPLACE FUNCTION public.rep_perf_restore_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _prev uuid;
BEGIN
  SELECT id INTO _prev
  FROM public.rep_performance_uploads
  WHERE representative_id = OLD.representative_id
    AND substituida_em IS NOT NULL
    AND (substituida_por = OLD.id
         OR lower(trim(coalesce(periodo_label,''))) = lower(trim(coalesce(OLD.periodo_label,''))))
  ORDER BY (substituida_por = OLD.id) DESC, created_at DESC
  LIMIT 1;

  IF _prev IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.rep_performance_uploads
    WHERE representative_id = OLD.representative_id
      AND substituida_em IS NULL
      AND id <> OLD.id
      AND lower(trim(coalesce(periodo_label,''))) = lower(trim(coalesce(OLD.periodo_label,'')))
  ) THEN
    UPDATE public.rep_performance_uploads
      SET substituida_em = NULL, substituida_por = NULL
      WHERE id = _prev;
  END IF;

  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_rep_perf_restore_on_delete ON public.rep_performance_uploads;
CREATE TRIGGER trg_rep_perf_restore_on_delete
AFTER DELETE ON public.rep_performance_uploads
FOR EACH ROW EXECUTE FUNCTION public.rep_perf_restore_on_delete();

-- 2) Reativação manual da última versão de um representante
CREATE OR REPLACE FUNCTION public.reactivate_last_performance_upload(_rep_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _company_id uuid;
  _target uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT company_id INTO _company_id FROM public.representatives WHERE id = _rep_id;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Representante não encontrado'; END IF;
  IF _company_id <> public.current_company_id() THEN
    RAISE EXCEPTION 'Acesso negado à empresa deste representante';
  END IF;
  IF NOT public.is_admin_or_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores ou gestores podem reativar versões';
  END IF;

  IF EXISTS (SELECT 1 FROM public.rep_performance_uploads
             WHERE representative_id = _rep_id AND substituida_em IS NULL) THEN
    RETURN jsonb_build_object('reactivated', false, 'reason', 'ja_existe_versao_ativa');
  END IF;

  SELECT id INTO _target
  FROM public.rep_performance_uploads
  WHERE representative_id = _rep_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF _target IS NULL THEN
    RETURN jsonb_build_object('reactivated', false, 'reason', 'sem_historico');
  END IF;

  UPDATE public.rep_performance_uploads
    SET substituida_em = NULL, substituida_por = NULL
    WHERE id = _target;

  RETURN jsonb_build_object('reactivated', true, 'upload_id', _target);
END $$;

GRANT EXECUTE ON FUNCTION public.reactivate_last_performance_upload(uuid) TO authenticated;