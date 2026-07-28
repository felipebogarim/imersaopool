CREATE TABLE public.performance_import_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  upload_id uuid REFERENCES public.rep_performance_uploads(id) ON DELETE SET NULL,
  representative_id uuid,
  periodo_label text,
  periodo_inicio date,
  periodo_fim date,
  filename text,
  file_hash text,
  parser_version text,
  performed_by uuid,
  linhas_lidas int NOT NULL DEFAULT 0,
  clientes_validos int NOT NULL DEFAULT 0,
  linhas_ignoradas int NOT NULL DEFAULT 0,
  descartes jsonb NOT NULL DEFAULT '[]'::jsonb,
  categorias text[] NOT NULL DEFAULT '{}',
  familias text[] NOT NULL DEFAULT '{}',
  matriz_status text NOT NULL DEFAULT 'ausente',
  matriz_erros jsonb NOT NULL DEFAULT '[]'::jsonb,
  divergencias_texto_cor int NOT NULL DEFAULT 0,
  divergencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  mensagem text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.performance_import_audit TO authenticated;
GRANT ALL ON public.performance_import_audit TO service_role;

ALTER TABLE public.performance_import_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auditoria de importação visível para a empresa"
ON public.performance_import_audit FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

CREATE INDEX idx_perf_import_audit_rep ON public.performance_import_audit(representative_id, created_at DESC);
CREATE UNIQUE INDEX idx_perf_import_audit_sucesso_unico
  ON public.performance_import_audit(representative_id, periodo_label, file_hash)
  WHERE status = 'sucesso' AND file_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.log_performance_import(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid := public.current_company_id();
  _rep uuid := NULLIF(_payload->>'representative_id','')::uuid;
  _status text := COALESCE(_payload->>'status','erro');
  _hash text := NULLIF(_payload->>'file_hash','');
  _periodo text := _payload->>'periodo_label';
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Nenhuma empresa ativa selecionada'; END IF;

  IF _status = 'sucesso' AND _hash IS NOT NULL THEN
    SELECT id INTO _id FROM public.performance_import_audit
    WHERE status = 'sucesso' AND representative_id = _rep
      AND periodo_label IS NOT DISTINCT FROM _periodo AND file_hash = _hash
    LIMIT 1;
    IF _id IS NOT NULL THEN
      UPDATE public.performance_import_audit
        SET upload_id = COALESCE(NULLIF(_payload->>'upload_id','')::uuid, upload_id),
            created_at = created_at
        WHERE id = _id;
      RETURN _id;
    END IF;
  END IF;

  INSERT INTO public.performance_import_audit(
    company_id, upload_id, representative_id, periodo_label, periodo_inicio, periodo_fim,
    filename, file_hash, parser_version, performed_by,
    linhas_lidas, clientes_validos, linhas_ignoradas, descartes,
    categorias, familias, matriz_status, matriz_erros,
    divergencias_texto_cor, divergencias, status, mensagem
  ) VALUES (
    _company_id,
    NULLIF(_payload->>'upload_id','')::uuid,
    _rep,
    _periodo,
    NULLIF(_payload->>'periodo_inicio','')::date,
    NULLIF(_payload->>'periodo_fim','')::date,
    _payload->>'filename',
    _hash,
    _payload->>'parser_version',
    _uid,
    COALESCE((_payload->>'linhas_lidas')::int, 0),
    COALESCE((_payload->>'clientes_validos')::int, 0),
    COALESCE((_payload->>'linhas_ignoradas')::int, 0),
    COALESCE(_payload->'descartes', '[]'::jsonb),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload->'categorias')), '{}'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload->'familias')), '{}'),
    COALESCE(_payload->>'matriz_status','ausente'),
    COALESCE(_payload->'matriz_erros', '[]'::jsonb),
    COALESCE((_payload->>'divergencias_texto_cor')::int, 0),
    COALESCE(_payload->'divergencias', '[]'::jsonb),
    _status,
    left(COALESCE(_payload->>'mensagem',''), 500)
  ) RETURNING id INTO _id;

  RETURN _id;
END $$;