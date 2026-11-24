-- Migration: Seed do "CLIENTE TESTE" com dados fictícios e vínculo ao "REPRESENTANTE TESTE", incluindo performance e imersão.
-- Usa as 7 famílias canônicas do sistema: DECOR NEWLINE, DECOR STUDIO, SISTEMAS E MÓDULOS, PRO LED, PRO LAMP, PERFIL, FITAS E FONTES.
-- Formato de atingimento compatível com sanitizeRatio (1.0 = 100%, 1.09 = 109%).

DO $$
DECLARE
  v_rep RECORD;
  v_company RECORD;
  v_rep_id UUID;
  v_client_id UUID;
  v_upload_id UUID;
  v_row_id UUID;
  v_familias TEXT[] := ARRAY['DECOR NEWLINE', 'DECOR STUDIO', 'SISTEMAS E MÓDULOS', 'PRO LED', 'PRO LAMP', 'PERFIL', 'FITAS E FONTES'];
  v_metas JSONB := '{"DECOR NEWLINE": 2500, "DECOR STUDIO": 3000, "SISTEMAS E MÓDULOS": 2500, "PRO LED": 1500, "PRO LAMP": 1500, "PERFIL": 2000, "FITAS E FONTES": 2000}'::jsonb;
  v_realizado JSONB := '{"DECOR NEWLINE": 2800, "DECOR STUDIO": 3300, "SISTEMAS E MÓDULOS": 2600, "PRO LED": 1600, "PRO LAMP": 1400, "PERFIL": 2200, "FITAS E FONTES": 2450}'::jsonb;
  v_familia_pct JSONB := '{"DECOR NEWLINE": 1.12, "DECOR STUDIO": 1.10, "SISTEMAS E MÓDULOS": 1.04, "PRO LED": 1.0667, "PRO LAMP": 0.9333, "PERFIL": 1.10, "FITAS E FONTES": 1.225}'::jsonb;
  v_metas_status JSONB := '{"DECOR NEWLINE": "superada", "DECOR STUDIO": "superada", "SISTEMAS E MÓDULOS": "superada", "PRO LED": "superada", "PRO LAMP": "em_aberto", "PERFIL": "superada", "FITAS E FONTES": "superada"}'::jsonb;
  v_metas_cores JSONB := '{"DECOR NEWLINE": "green", "DECOR STUDIO": "green", "SISTEMAS E MÓDULOS": "green", "PRO LED": "green", "PRO LAMP": "yellow", "PERFIL": "green", "FITAS E FONTES": "green"}'::jsonb;
  v_matrix CONSTANT JSONB := '{"Black":{"DECOR NEWLINE":8000,"DECOR STUDIO":6000,"SISTEMAS E MÓDULOS":10000,"PRO LED":3000,"PRO LAMP":4000,"PERFIL":7000,"FITAS E FONTES":3000},"Gold":{"DECOR NEWLINE":2500,"DECOR STUDIO":3000,"SISTEMAS E MÓDULOS":2500,"PRO LED":1500,"PRO LAMP":1500,"PERFIL":2000,"FITAS E FONTES":2000},"Silver":{"DECOR NEWLINE":1000,"DECOR STUDIO":1500,"SISTEMAS E MÓDULOS":1000,"PRO LED":500,"PRO LAMP":1000,"PERFIL":1000,"FITAS E FONTES":1000}}'::jsonb;
BEGIN
  -- 1. Garante que exista ao menos um "REPRESENTANTE TESTE"
  IF NOT EXISTS (SELECT 1 FROM public.representatives WHERE UPPER(TRIM(nome)) ILIKE '%TESTE%') THEN
    FOR v_company IN 
      SELECT id FROM public.companies
      UNION
      SELECT 'c86498e0-be56-4ed4-a362-6cdfbf72eff7'::uuid AS id
      LIMIT 10
    LOOP
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
        'Representante Teste',
        'rep.teste@poolflux.com.br',
        '(11) 99999-0000',
        'SP',
        '3 anos',
        'Nenhuma',
        'Representação Teste',
        'Representante fictício criado para testes e validações de rotinas comerciais.'
      );
    END LOOP;
  END IF;

  -- 2. Para cada representante que seja de teste, cria ou atualiza os dados completos
  FOR v_rep IN
    SELECT id, company_id, nome
    FROM public.representatives
    WHERE UPPER(TRIM(nome)) ILIKE '%TESTE%'
  LOOP
    -- 2.1 Cria ou atualiza o CLIENTE TESTE
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE (company_id = v_rep.company_id OR v_rep.company_id IS NULL)
      AND (UPPER(TRIM(nome_fantasia)) = 'CLIENTE TESTE' OR UPPER(TRIM(razao_social)) = 'CLIENTE TESTE ILUMINACAO LTDA')
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
        v_rep.company_id,
        v_rep.id,
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
        v_rep.nome,
        'Cliente teste criado para homologação de relatórios, diagnósticos, Metas e BI.',
        'Perfil fictício com metas de performance batidas e bom relacionamento comercial.'
      )
      RETURNING id INTO v_client_id;
    ELSE
      UPDATE public.clients
      SET representative_id = v_rep.id,
          nome_representante_erp = v_rep.nome,
          categoria = 'Gold',
          status = 'ativo',
          updated_at = now()
      WHERE id = v_client_id;
    END IF;

    -- 2.2 Cria ou atualiza o upload de performance ativo para o representante
    SELECT id INTO v_upload_id
    FROM public.rep_performance_uploads
    WHERE representative_id = v_rep.id
      AND substituida_em IS NULL
    ORDER BY periodo_fim DESC NULLS LAST, created_at DESC
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
        v_rep.company_id,
        v_rep.id,
        '2026 - YTD',
        '2026-01-01',
        '2026-12-31',
        v_familias,
        '{"Gold": 15000, "Black": 35000, "Silver": 8000}'::jsonb,
        'performance_representante_teste_2026.xlsx',
        1.09,
        'manual_seed'
      )
      RETURNING id INTO v_upload_id;
    ELSE
      UPDATE public.rep_performance_uploads
      SET familias = v_familias,
          periodo_fim = COALESCE(periodo_fim, '2026-12-31'),
          atingimento_geral = 1.09,
          substituida_em = NULL
      WHERE id = v_upload_id;
    END IF;

    -- 2.3 Cria ou atualiza a linha de performance (rep_performance_rows) vinculada ao upload
    SELECT id INTO v_row_id
    FROM public.rep_performance_rows
    WHERE upload_id = v_upload_id
      AND (UPPER(TRIM(razao_social)) = 'CLIENTE TESTE ILUMINACAO LTDA' OR UPPER(TRIM(razao_social)) = 'CLIENTE TESTE')
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
        v_rep.company_id,
        v_upload_id,
        1,
        'CLIENTE TESTE ILUMINACAO LTDA',
        'Gold',
        v_metas,
        v_realizado,
        15000,
        1.09,
        'superada',
        v_familia_pct,
        v_metas_status,
        v_metas_cores,
        'Cliente destaque em DECOR NEWLINE e FITAS E FONTES. Desempenho geral de 109% (superada).',
        true
      )
      RETURNING id INTO v_row_id;
    ELSE
      UPDATE public.rep_performance_rows
      SET razao_social = 'CLIENTE TESTE ILUMINACAO LTDA',
          categoria = 'Gold',
          metas = v_metas,
          realizado = v_realizado,
          total_meta = 15000,
          total_pct = 1.09,
          total_pct_status = 'superada',
          familia_pct = v_familia_pct,
          metas_status = v_metas_status,
          metas_cores = v_metas_cores,
          observacao = 'Cliente destaque em DECOR NEWLINE e FITAS E FONTES. Desempenho geral de 109% (superada).',
          acompanhar = true
      WHERE id = v_row_id;
    END IF;

    -- 2.4 Sincronização com o schema performance_private (se existir)
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'performance_private') THEN
      INSERT INTO performance_private.rep_row_values (row_id, upload_id, total_meta, metas, realizado)
      VALUES (v_row_id, v_upload_id, 15000, v_metas, v_realizado)
      ON CONFLICT (row_id) DO UPDATE
      SET total_meta = EXCLUDED.total_meta,
          metas = EXCLUDED.metas,
          realizado = EXCLUDED.realizado,
          updated_at = now();

      INSERT INTO performance_private.rep_upload_values (upload_id, categoria_metas)
      VALUES (v_upload_id, jsonb_build_object('__family_metas_by_category__', v_matrix))
      ON CONFLICT (upload_id) DO UPDATE
      SET categoria_metas = jsonb_build_object('__family_metas_by_category__', v_matrix);

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'performance_private' AND table_name = 'upload_category_family_targets') THEN
        DELETE FROM performance_private.upload_category_family_targets WHERE upload_id = v_upload_id;
        INSERT INTO performance_private.upload_category_family_targets (upload_id, categoria, familia, target_amount)
        SELECT v_upload_id, c.key, f.key, (f.value::text)::numeric 
        FROM jsonb_each(v_matrix) c CROSS JOIN jsonb_each(c.value) f;
      END IF;
    END IF;

    -- 2.5 Cria imersão fictícia se ainda não existir
    IF NOT EXISTS (
      SELECT 1 FROM public.immersions 
      WHERE client_id = v_client_id AND representative_id = v_rep.id
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
        v_rep.company_id,
        v_client_id,
        v_rep.id,
        'concluida',
        CURRENT_DATE - INTERVAL '15 days',
        'Equipe PoolFlux',
        'Imersão comercial de teste realizada com foco em expansão de mix e metas de portfólio.',
        'Cliente com excelente aceitação das famílias técnicas (Pro LED, Perfil) e grande oportunidade em Decor Studio.'
      );
    END IF;

  END LOOP;
END $$;
