-- Migration: Seed do "CLIENTE TESTE" com dados fictícios e vínculo ao "REPRESENTANTE TESTE", incluindo performance e imersão.

DO $$
DECLARE
  v_company RECORD;
  v_rep_id UUID;
  v_client_id UUID;
  v_upload_id UUID;
  v_row_id UUID;
  v_familias TEXT[] := ARRAY['Fitas LED', 'Perfis de LED', 'Fontes', 'Spots', 'Painéis LED', 'Luminárias Decorativas'];
  v_metas JSONB := '{"Fitas LED": 50000, "Perfis de LED": 30000, "Fontes": 15000, "Spots": 25000, "Painéis LED": 20000, "Luminárias Decorativas": 10000}'::jsonb;
  v_realizado JSONB := '{"Fitas LED": 56000, "Perfis de LED": 33000, "Fontes": 14000, "Spots": 28000, "Painéis LED": 21000, "Luminárias Decorativas": 11500}'::jsonb;
  v_familia_pct JSONB := '{"Fitas LED": 112.0, "Perfis de LED": 110.0, "Fontes": 93.3, "Spots": 112.0, "Painéis LED": 105.0, "Luminárias Decorativas": 115.0}'::jsonb;
  v_metas_status JSONB := '{"Fitas LED": "superada", "Perfis de LED": "superada", "Fontes": "em_aberto", "Spots": "superada", "Painéis LED": "superada", "Luminárias Decorativas": "superada"}'::jsonb;
  v_metas_cores JSONB := '{"Fitas LED": "green", "Perfis de LED": "green", "Fontes": "yellow", "Spots": "green", "Painéis LED": "green", "Luminárias Decorativas": "green"}'::jsonb;
BEGIN
  -- Percorre as empresas cadastradas no sistema
  FOR v_company IN 
    SELECT id FROM public.companies
    UNION
    SELECT 'c86498e0-be56-4ed4-a362-6cdfbf72eff7'::uuid AS id
    LIMIT 10
  LOOP
    -- 1. Cria ou recupera o "REPRESENTANTE TESTE"
    SELECT id INTO v_rep_id
    FROM public.representatives
    WHERE company_id = v_company.id AND UPPER(TRIM(nome)) = 'REPRESENTANTE TESTE'
    LIMIT 1;

    IF v_rep_id IS NULL THEN
      INSERT INTO public.representatives (
        company_id,
        nome,
        email,
        telefone,
        regiao,
        tempo_relacionamento,
        outras_marcas,
        representacao,
        observacoes
      ) VALUES (
        v_company.id,
        'REPRESENTANTE TESTE',
        'rep.teste@poolflux.com.br',
        '(11) 99999-0000',
        'SP',
        '3 anos',
        'Nenhuma',
        'Representação Teste',
        'Representante fictício criado para testes e validações de rotinas comerciais.'
      )
      RETURNING id INTO v_rep_id;
    END IF;

    -- 2. Cria ou atualiza o "CLIENTE TESTE"
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE company_id = v_company.id AND (UPPER(TRIM(nome_fantasia)) = 'CLIENTE TESTE' OR UPPER(TRIM(razao_social)) = 'CLIENTE TESTE ILUMINACAO LTDA')
    LIMIT 1;

    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (
        company_id,
        representative_id,
        nome_fantasia,
        razao_social,
        cnpj,
        documento,
        codigo_erp,
        cidade,
        municipio,
        estado,
        regiao,
        endereco,
        nome_comprador,
        telefone,
        whatsapp,
        email,
        grupo,
        grupo_erp,
        categoria,
        categoria_erp,
        status,
        status_erp,
        nome_representante_erp,
        info_comerciais,
        obs_cliente
      ) VALUES (
        v_company.id,
        v_rep_id,
        'CLIENTE TESTE',
        'CLIENTE TESTE ILUMINACAO LTDA',
        '00.000.000/0001-99',
        '00.000.000/0001-99',
        'CLI-TESTE-001',
        'São Paulo',
        'São Paulo',
        'SP',
        'SP',
        'Av. Paulista, 1000 - Bela Vista',
        'Comprador Teste',
        '(11) 98888-7777',
        '(11) 98888-7777',
        'contato@clienteteste.com.br',
        'G1',
        'G1',
        'Gold',
        'Gold',
        'ativo',
        'ativo',
        'REPRESENTANTE TESTE',
        'Cliente teste criado para homologação de relatórios, diagnósticos e BI.',
        'Perfil fictício com metas de performance batidas e bom relacionamento comercial.'
      )
      RETURNING id INTO v_client_id;
    ELSE
      UPDATE public.clients
      SET representative_id = v_rep_id,
          nome_representante_erp = 'REPRESENTANTE TESTE',
          updated_at = now()
      WHERE id = v_client_id;
    END IF;

    -- 3. Cria upload de performance para o REPRESENTANTE TESTE (se ainda não existir ativo)
    SELECT id INTO v_upload_id
    FROM public.rep_performance_uploads
    WHERE representative_id = v_rep_id
      AND periodo_label = '2026 - YTD'
      AND substituida_em IS NULL
    LIMIT 1;

    IF v_upload_id IS NULL THEN
      INSERT INTO public.rep_performance_uploads (
        company_id,
        representative_id,
        periodo_label,
        periodo_inicio,
        periodo_fim,
        familias,
        categoria_metas,
        filename,
        atingimento_geral,
        origem
      ) VALUES (
        v_company.id,
        v_rep_id,
        '2026 - YTD',
        '2026-01-01',
        '2026-12-31',
        v_familias,
        '{"Gold": 150000, "Black": 300000, "Silver": 80000}'::jsonb,
        'performance_representante_teste_2026.xlsx',
        109.0,
        'manual_seed'
      )
      RETURNING id INTO v_upload_id;
    END IF;

    -- 4. Cria linha de performance vinculada ao CLIENTE TESTE (razao_social = CLIENTE TESTE ILUMINACAO LTDA)
    SELECT id INTO v_row_id
    FROM public.rep_performance_rows
    WHERE upload_id = v_upload_id
      AND UPPER(TRIM(razao_social)) = 'CLIENTE TESTE ILUMINACAO LTDA'
    LIMIT 1;

    IF v_row_id IS NULL THEN
      INSERT INTO public.rep_performance_rows (
        company_id,
        upload_id,
        ordem,
        razao_social,
        categoria,
        metas,
        realizado,
        total_meta,
        total_pct,
        total_pct_status,
        familia_pct,
        metas_status,
        metas_cores,
        observacao,
        acompanhar
      ) VALUES (
        v_company.id,
        v_upload_id,
        1,
        'CLIENTE TESTE ILUMINACAO LTDA',
        'Gold',
        v_metas,
        v_realizado,
        150000,
        109.0,
        'superada',
        v_familia_pct,
        v_metas_status,
        v_metas_cores,
        'Cliente destaque em Fitas LED e Perfis de LED. Desempenho geral acima de 100%.',
        true
      )
      RETURNING id INTO v_row_id;
    ELSE
      UPDATE public.rep_performance_rows
      SET metas = v_metas,
          realizado = v_realizado,
          total_meta = 150000,
          total_pct = 109.0,
          total_pct_status = 'superada',
          familia_pct = v_familia_pct,
          metas_status = v_metas_status,
          metas_cores = v_metas_cores
      WHERE id = v_row_id;
    END IF;

    -- 5. Se o schema performance_private existir, sincroniza rep_row_values e rep_upload_values
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'performance_private') THEN
      INSERT INTO performance_private.rep_row_values (row_id, upload_id, total_meta, metas, realizado)
      VALUES (v_row_id, v_upload_id, 150000, v_metas, v_realizado)
      ON CONFLICT (row_id) DO UPDATE
      SET total_meta = EXCLUDED.total_meta,
          metas = EXCLUDED.metas,
          realizado = EXCLUDED.realizado,
          updated_at = now();

      INSERT INTO performance_private.rep_upload_values (upload_id, categoria_metas)
      VALUES (v_upload_id, '{"Gold": 150000, "Black": 300000, "Silver": 80000}'::jsonb)
      ON CONFLICT (upload_id) DO NOTHING;
    END IF;

    -- 6. Adiciona imersão fictícia em public.immersions se ainda não existir
    IF NOT EXISTS (
      SELECT 1 FROM public.immersions 
      WHERE client_id = v_client_id AND company_id = v_company.id
    ) THEN
      INSERT INTO public.immersions (
        company_id,
        client_id,
        representative_id,
        status,
        data_visita,
        consultor,
        observacoes,
        diagnostico
      ) VALUES (
        v_company.id,
        v_client_id,
        v_rep_id,
        'concluida',
        CURRENT_DATE - INTERVAL '15 days',
        'Equipe PoolFlux',
        'Imersão comercial de teste realizada com foco em expansão de mix e alinhamento de tabela.',
        'Cliente com excelente aceitação da linha de iluminação técnica e alto potencial de crescimento em luminárias decorativas.'
      );
    END IF;

  END LOOP;
END $$;
