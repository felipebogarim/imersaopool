-- Migration: Seed do "CLIENTE TESTE" com dados fictícios e vínculo isolado ao "REPRESENTANTE TESTE".
-- Estrutura compatível com o schema atual:
-- 1. Valores financeiros residem exclusivamente em performance_private.rep_row_values (não em rep_performance_rows).
-- 2. As 7 famílias canônicas: DECOR NEWLINE, DECOR STUDIO, SISTEMAS E MÓDULOS, PRO LED, PRO LAMP, PERFIL, FITAS E FONTES.
-- 3. Faróis oficiais: excelente (>100%), otimo (90-100%), proximo (70-89%), pode_melhorar (50-69%), abaixo_meta (<50%), sem_compra (0%).
-- 4. Ratios numéricos plausíveis (1.0 = 100%, 1.09 = 109%) compatíveis com sanitizeRatio.
-- 5. Isolamento total: upload e dados restritos estritamente ao REPRESENTANTE TESTE da empresa ativa.
-- 6. Imersão com entrevista e notas de campo para teste das sugestões de IA no módulo METAS.

DO $$
DECLARE
  v_rep RECORD;
  v_company_id UUID;
  v_client_id UUID;
  v_upload_id UUID;
  v_row_id UUID;
  v_immersion_id UUID;
  v_familias TEXT[] := ARRAY['DECOR NEWLINE', 'DECOR STUDIO', 'SISTEMAS E MÓDULOS', 'PRO LED', 'PRO LAMP', 'PERFIL', 'FITAS E FONTES'];
  v_metas JSONB := '{"DECOR NEWLINE": 2500, "DECOR STUDIO": 3000, "SISTEMAS E MÓDULOS": 2500, "PRO LED": 1500, "PRO LAMP": 1500, "PERFIL": 2000, "FITAS E FONTES": 2000}'::jsonb;
  v_realizado JSONB := '{"DECOR NEWLINE": 2800, "DECOR STUDIO": 3300, "SISTEMAS E MÓDULOS": 2600, "PRO LED": 1600, "PRO LAMP": 1400, "PERFIL": 2200, "FITAS E FONTES": 2450}'::jsonb;
  v_familia_pct JSONB := '{"DECOR NEWLINE": 1.12, "DECOR STUDIO": 1.10, "SISTEMAS E MÓDULOS": 1.04, "PRO LED": 1.0667, "PRO LAMP": 0.9333, "PERFIL": 1.10, "FITAS E FONTES": 1.225}'::jsonb;
  v_metas_status JSONB := '{"DECOR NEWLINE": "excelente", "DECOR STUDIO": "excelente", "SISTEMAS E MÓDULOS": "excelente", "PRO LED": "excelente", "PRO LAMP": "otimo", "PERFIL": "excelente", "FITAS E FONTES": "excelente"}'::jsonb;
  v_metas_cores JSONB := '{"DECOR NEWLINE": "6EE7B7", "DECOR STUDIO": "6EE7B7", "SISTEMAS E MÓDULOS": "6EE7B7", "PRO LED": "6EE7B7", "PRO LAMP": "BEF264", "PERFIL": "6EE7B7", "FITAS E FONTES": "6EE7B7"}'::jsonb;
  v_matrix CONSTANT JSONB := '{"Black":{"DECOR NEWLINE":8000,"DECOR STUDIO":6000,"SISTEMAS E MÓDULOS":10000,"PRO LED":3000,"PRO LAMP":4000,"PERFIL":7000,"FITAS E FONTES":3000},"Gold":{"DECOR NEWLINE":2500,"DECOR STUDIO":3000,"SISTEMAS E MÓDULOS":2500,"PRO LED":1500,"PRO LAMP":1500,"PERFIL":2000,"FITAS E FONTES":2000},"Silver":{"DECOR NEWLINE":1000,"DECOR STUDIO":1500,"SISTEMAS E MÓDULOS":1000,"PRO LED":500,"PRO LAMP":1000,"PERFIL":1000,"FITAS E FONTES":1000}}'::jsonb;
BEGIN
  v_company_id := 'c86498e0-be56-4ed4-a362-6cdfbf72eff7'::uuid;

  -- 1. Identifica o REPRESENTANTE TESTE exato (busca estrita por nome, sem aproximação)
  SELECT r.id, r.company_id, r.nome, r.regiao
  INTO v_rep
  FROM public.representatives r
  WHERE UPPER(TRIM(r.nome)) = 'REPRESENTANTE TESTE'
  ORDER BY r.created_at DESC
  LIMIT 1;

  IF v_rep.id IS NULL THEN
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
      v_company_id,
      'REPRESENTANTE TESTE',
      'rep.teste@poolflux.com.br',
      '(11) 99999-0000',
      'SP',
      '3 anos',
      'Nenhuma',
      'Representação Teste',
      'Representante fictício criado para testes e validações de rotinas comerciais.'
    )
    RETURNING id, company_id, nome, regiao INTO v_rep;
  END IF;

  -- Garante company_id oficial (PoolFlux) caso o representante existente estivesse sem empresa
  IF v_rep.company_id IS NULL THEN
    UPDATE public.representatives SET company_id = v_company_id WHERE id = v_rep.id;
    v_rep.company_id := v_company_id;
  END IF;

  RAISE NOTICE 'Empresa alvo: % | Representante: % (ID: %)', v_rep.company_id, v_rep.nome, v_rep.id;

  -- 2. Cria ou recupera o upload exclusivo do REPRESENTANTE TESTE (sem tocar em outros representantes)
  SELECT id INTO v_upload_id
  FROM public.rep_performance_uploads
  WHERE representative_id = v_rep.id
    AND company_id = v_rep.company_id
    AND periodo_label = '2026 - YTD'
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
      'performance_representante_teste_2026.xlsx',
      1.09,
      'manual_seed'
    )
    RETURNING id INTO v_upload_id;
  ELSE
    UPDATE public.rep_performance_uploads
    SET familias = v_familias,
        periodo_inicio = '2026-01-01',
        periodo_fim = '2026-12-31',
        atingimento_geral = 1.09,
        substituida_em = NULL
    WHERE id = v_upload_id;
  END IF;

  -- 3. Cria ou atualiza o CLIENTE TESTE (vinculado exclusivamente à empresa e ao representante)
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE company_id = v_rep.company_id
    AND (UPPER(TRIM(razao_social)) = 'CLIENTE TESTE ILUMINACAO LTDA' OR UPPER(TRIM(nome_fantasia)) = 'CLIENTE TESTE')
  ORDER BY created_at DESC
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
      categoria,
      status,
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
      COALESCE(v_rep.regiao, 'SP'),
      'Av. Paulista, 1000 - Bela Vista',
      'Comprador Teste',
      '(11) 98888-7777',
      '(11) 98888-7777',
      'contato@clienteteste.com.br',
      'G1',
      'Gold',
      'ativo',
      v_rep.nome,
      'Cliente teste criado para homologação de diagnósticos, Metas e IA.',
      'Perfil fictício com metas de performance batidas e bom relacionamento comercial.'
    )
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE public.clients
    SET representative_id = v_rep.id,
        nome_representante_erp = v_rep.nome,
        categoria = 'Gold',
        status = 'ativo',
        cidade = COALESCE(cidade, 'São Paulo'),
        estado = COALESCE(estado, 'SP'),
        regiao = COALESCE(regiao, v_rep.regiao, 'SP'),
        updated_at = now()
    WHERE id = v_client_id;
  END IF;

  -- 4. Cria ou atualiza a linha em rep_performance_rows (somente colunas existentes nesta tabela)
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
      1.09,
      'excelente',
      v_familia_pct,
      v_metas_status,
      v_metas_cores,
      'Cliente destaque em DECOR NEWLINE e FITAS E FONTES. Desempenho geral de 109% (excelente).',
      true
    )
    RETURNING id INTO v_row_id;
  ELSE
    UPDATE public.rep_performance_rows
    SET categoria = 'Gold',
        total_pct = 1.09,
        total_pct_status = 'excelente',
        familia_pct = v_familia_pct,
        metas_status = v_metas_status,
        metas_cores = v_metas_cores,
        observacao = 'Cliente destaque em DECOR NEWLINE e FITAS E FONTES. Desempenho geral de 109% (excelente).',
        acompanhar = true
    WHERE id = v_row_id;
  END IF;

  -- 5. Grava os valores financeiros em performance_private.rep_row_values
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'performance_private' AND table_name = 'rep_row_values') THEN
    INSERT INTO performance_private.rep_row_values (row_id, upload_id, total_meta, metas, realizado, media)
    VALUES (v_row_id, v_upload_id, 15000, v_metas, v_realizado, v_metas)
    ON CONFLICT (row_id) DO UPDATE
    SET upload_id = EXCLUDED.upload_id,
        total_meta = EXCLUDED.total_meta,
        metas = EXCLUDED.metas,
        realizado = EXCLUDED.realizado,
        media = EXCLUDED.media,
        updated_at = now();
  END IF;

  -- 6. Configura matriz de metas por categoria EXCLUSIVAMENTE para este upload de teste
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'performance_private' AND table_name = 'rep_upload_values') THEN
    INSERT INTO performance_private.rep_upload_values (upload_id, categoria_metas)
    VALUES (v_upload_id, jsonb_build_object('__family_metas_by_category__', v_matrix))
    ON CONFLICT (upload_id) DO UPDATE
    SET categoria_metas = EXCLUDED.categoria_metas,
        updated_at = now();
  END IF;

  -- 7. Imersão com diagnóstico para abastecer contexto da IA no METAS
  SELECT id INTO v_immersion_id
  FROM public.immersions
  WHERE client_id = v_client_id AND representative_id = v_rep.id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_immersion_id IS NULL THEN
    INSERT INTO public.immersions (
      company_id,
      client_id,
      representative_id,
      status,
      titulo,
      subject_type,
      data_visita,
      observacoes
    ) VALUES (
      v_rep.company_id,
      v_client_id,
      v_rep.id,
      'concluida',
      'Imersão Comercial de Teste — Expansão de Portfólio',
      'client',
      CURRENT_DATE - INTERVAL '15 days',
      'Imersão comercial realizada com foco em diagnóstico de sortimento, alinhamento de tabela e expansão de mix para iluminação técnica e decorativa.'
    )
    RETURNING id INTO v_immersion_id;
  END IF;

  -- 8. Entrevista vinculada à imersão (consultada por performance_goal_ai_context)
  IF NOT EXISTS (SELECT 1 FROM public.interviews WHERE immersion_id = v_immersion_id) THEN
    INSERT INTO public.interviews (
      company_id,
      client_id,
      immersion_id,
      empresa_nome,
      entrevistado_nome,
      entrevistador_nome,
      entrevistado_classificacao,
      perfil,
      data_entrevista,
      observacoes,
      respostas
    ) VALUES (
      v_rep.company_id,
      v_client_id,
      v_immersion_id,
      'CLIENTE TESTE ILUMINACAO LTDA',
      'Comprador Teste',
      'Equipe Comercial PoolFlux',
      'Comprador',
      'Lojista',
      CURRENT_DATE - INTERVAL '15 days',
      'Cliente demonstra excelente aceitação das famílias Pro LED e Perfil. Aponta interesse em introduzir luminárias Decor Studio no showroom.',
      '{"mix_atual": "Alta rotatividade em Fitas e Perfis", "oportunidade_decor": "Grande interesse em mostruários para linha Decor", "atendimento": "Muito satisfeito com suporte do representante"}'::jsonb
    );
  END IF;

  -- 9. Notas de visita de campo (consultadas por performance_goal_ai_context)
  IF NOT EXISTS (SELECT 1 FROM public.field_visit_inputs WHERE immersion_id = v_immersion_id) THEN
    INSERT INTO public.field_visit_inputs (
      company_id,
      immersion_id,
      scope,
      oportunidades,
      observacoes_comerciais,
      observacoes_concorrentes,
      observacoes_exposicao,
      observacoes_loja,
      texto
    ) VALUES (
      v_rep.company_id,
      v_immersion_id,
      'immersion',
      'Demanda crescente por perfis embutidos e sistemas modulares para projetos corporativos e residenciais.',
      'Cliente busca prazos consistentes e bonificação progressiva com aumento de participação no mix Decor.',
      'Marcas concorrentes ocupam espaço com produtos básicos de baixo custo, mas cliente deseja posicionamento superior com PoolFlux.',
      'Showroom bem localizado com ilha de exposição disponível para novos displays técnicos.',
      'Equipe de vendas bem capacitada, com consultores técnicos dedicados.',
      'Diagnóstico de campo consolidado com plano de ação comercial positivo.'
    );
  END IF;

  RAISE NOTICE 'Seed concluído com sucesso: Upload ID %, Cliente ID %, Linha de Performance ID %', v_upload_id, v_client_id, v_row_id;

END $$;
