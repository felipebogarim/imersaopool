CREATE OR REPLACE FUNCTION public.reprocessar_fontes_entrevistas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cid uuid := public.current_company_id();
  _i record;
  _c record;
  _fonte_id uuid;
  _lente public.insight_lente;
  _campos jsonb;
  _hl jsonb;
  _regiao text;
  _perfil text;
  _criadas int := 0;
  _atualizadas int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _cid IS NULL THEN RAISE EXCEPTION 'Nenhuma empresa ativa selecionada'; END IF;

  FOR _i IN SELECT * FROM public.interviews WHERE company_id = _cid LOOP
    _regiao := NULL; _perfil := NULL;
    IF upper(_i.entrevistado_nome) LIKE 'ANDERSON%' THEN
      _regiao := 'Interior SP'; _perfil := 'boutiques premium, 24 clientes Newline';
    ELSIF upper(_i.entrevistado_nome) LIKE 'SALTON%' THEN
      _regiao := 'Rio Grande do Sul'; _perfil := 'interior gaúcho, marcenaria';
    ELSIF upper(_i.entrevistado_nome) = 'FÁBIO' OR upper(_i.entrevistado_nome) LIKE 'FABIO%' THEN
      _regiao := 'Campinas'; _perfil := 'carteira concentrada, presença intensa';
    END IF;
    _regiao := COALESCE(_regiao, NULLIF(btrim(COALESCE(_i.cidade,'') || CASE WHEN COALESCE(_i.estado,'') <> '' THEN ' / ' || _i.estado ELSE '' END), ''));
    _perfil := COALESCE(_perfil, _i.perfil_outro, _i.perfil);

    SELECT id INTO _fonte_id FROM public.insight_fontes WHERE interview_id = _i.id LIMIT 1;

    IF _fonte_id IS NULL THEN
      INSERT INTO public.insight_fontes(company_id, tipo, titulo, pessoa, regiao, perfil_carteira,
                                        data_coleta, status_processamento, interview_id, created_by)
      VALUES (_cid, 'entrevista', COALESCE(NULLIF(btrim(_i.entrevistado_nome),''), 'Entrevista'),
              _i.entrevistado_nome, _regiao, _perfil, _i.data_entrevista, 'processada', _i.id, _uid)
      RETURNING id INTO _fonte_id;
      _criadas := _criadas + 1;
    ELSE
      UPDATE public.insight_fontes
        SET titulo = COALESCE(NULLIF(btrim(_i.entrevistado_nome),''), titulo),
            pessoa = COALESCE(_i.entrevistado_nome, pessoa),
            regiao = COALESCE(regiao, _regiao),
            perfil_carteira = COALESCE(perfil_carteira, _perfil),
            data_coleta = COALESCE(data_coleta, _i.data_entrevista),
            status_processamento = CASE WHEN status_processamento = 'pendente' THEN 'processada'::public.insight_fonte_status ELSE status_processamento END
        WHERE id = _fonte_id;
      _atualizadas := _atualizadas + 1;
    END IF;

    FOR _c IN
      SELECT cap.ordem, sc.sintese, sc.leitura_estrategica, sc.resposta_texto
      FROM public.sessao_capitulos sc
      JOIN public.capitulos cap ON cap.id = sc.capitulo_id
      WHERE sc.sessao_id = _i.id
    LOOP
      _lente := CASE _c.ordem
        WHEN 1 THEN 'marca_preco' WHEN 2 THEN 'mix' WHEN 3 THEN 'concorrencia'
        WHEN 4 THEN 'argumento' WHEN 5 THEN 'decisao' WHEN 6 THEN 'oportunidades'
        WHEN 7 THEN 'governanca' WHEN 8 THEN 'adicionais' ELSE NULL END::public.insight_lente;
      CONTINUE WHEN _lente IS NULL;

      _campos := COALESCE(_c.sintese, '{}'::jsonb) - 'highlights';
      _hl := CASE WHEN jsonb_typeof(COALESCE(_c.sintese,'{}'::jsonb)->'highlights') = 'array'
                  THEN _c.sintese->'highlights' ELSE '[]'::jsonb END;

      INSERT INTO public.insight_fonte_lentes(fonte_id, company_id, lente, leitura_estrategica, sintese_campos, highlights)
      VALUES (_fonte_id, _cid, _lente,
              COALESCE(NULLIF(btrim(COALESCE(_c.leitura_estrategica,'')),''), NULLIF(btrim(COALESCE(_c.resposta_texto,'')),'')),
              _campos, _hl)
      ON CONFLICT (fonte_id, lente) DO UPDATE
        SET leitura_estrategica = COALESCE(EXCLUDED.leitura_estrategica, public.insight_fonte_lentes.leitura_estrategica),
            sintese_campos = CASE WHEN EXCLUDED.sintese_campos = '{}'::jsonb
                                  THEN public.insight_fonte_lentes.sintese_campos ELSE EXCLUDED.sintese_campos END,
            highlights = CASE WHEN EXCLUDED.highlights = '[]'::jsonb
                              THEN public.insight_fonte_lentes.highlights ELSE EXCLUDED.highlights END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('criadas', _criadas, 'atualizadas', _atualizadas);
END $$;

REVOKE ALL ON FUNCTION public.reprocessar_fontes_entrevistas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reprocessar_fontes_entrevistas() TO authenticated;