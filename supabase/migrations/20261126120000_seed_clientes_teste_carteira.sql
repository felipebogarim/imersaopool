-- Migration: +5 clientes fictícios na carteira do "REPRESENTANTE TESTE", com performance e imersão.
--
-- Versão corrigida (2026-11-24). Validada contra o schema real das migrations:
-- - NÃO consulta public.companies por nome/aproximação. A empresa é a do upload ativo onde já está o
--   CLIENTE TESTE ILUMINACAO LTDA (o mesmo que a tela de Metas exibe), conferida contra o representante.
-- - Representante localizado por nome EXATO; aborta se houver zero ou mais de um "REPRESENTANTE TESTE".
-- - Upload = versão ativa mais recente do representante (mesma regra da tela: periodo_fim desc,
--   created_at desc); aborta se o CLIENTE TESTE original não estiver nela.
-- - Clientes localizados só por identificadores fictícios exatos (razão social nova, CNPJ 00.000.000/…,
--   código CLI-TESTE-…). Nunca altera cliente vinculado a outro representante.
-- - Valores financeiros em performance_private.rep_row_values (obrigatório); 7 famílias por cliente.
-- - Idempotente: reexecutar atualiza em vez de duplicar. CLIENTE TESTE original e dados reais intactos.

DO $$
DECLARE
  v_familias CONSTANT TEXT[] := ARRAY['DECOR NEWLINE', 'DECOR STUDIO', 'SISTEMAS E MÓDULOS', 'PRO LED', 'PRO LAMP', 'PERFIL', 'FITAS E FONTES'];
  v_matrix CONSTANT JSONB := '{"Black":{"DECOR NEWLINE":8000,"DECOR STUDIO":6000,"SISTEMAS E MÓDULOS":10000,"PRO LED":3000,"PRO LAMP":4000,"PERFIL":7000,"FITAS E FONTES":3000},"Gold":{"DECOR NEWLINE":2500,"DECOR STUDIO":3000,"SISTEMAS E MÓDULOS":2500,"PRO LED":1500,"PRO LAMP":1500,"PERFIL":2000,"FITAS E FONTES":2000},"Silver":{"DECOR NEWLINE":1000,"DECOR STUDIO":1500,"SISTEMAS E MÓDULOS":1000,"PRO LED":500,"PRO LAMP":1000,"PERFIL":1000,"FITAS E FONTES":1000}}'::jsonb;
  v_clientes CONSTANT JSONB := $json$[
    {
      "nome_fantasia": "CLIENTE TESTE 02 - LUMINAR DESIGN",
      "razao_social": "CLIENTE TESTE 02 - LUMINAR DESIGN LTDA",
      "legacy_razao_social": "LUMINAR DESIGN ILUMINACAO LTDA",
      "cnpj": "00.000.000/0002-70",
      "codigo_erp": "CLI-TESTE-002",
      "cidade": "Campinas", "estado": "SP",
      "endereco": "Av. Norte-Sul, 1520 - Cambuí",
      "comprador": "Mariana Okada", "telefone": "(19) 98111-2233", "email": "compras@luminardesign.com.br",
      "grupo": "G1", "categoria": "Black",
      "realizado": {"DECOR NEWLINE": 7600, "DECOR STUDIO": 5100, "SISTEMAS E MÓDULOS": 11200, "PRO LED": 2500, "PRO LAMP": 1900, "PERFIL": 6300, "FITAS E FONTES": 2800},
      "observacao": "Loja de alto padrão. Sistemas e Módulos acima da meta; PRO LAMP abaixo por ruptura de estoque no 1º semestre.",
      "info_comerciais": "Atende arquitetos e incorporadoras da região de Campinas.",
      "imersao_titulo": "Imersão Comercial — Projetos de Alto Padrão",
      "imersao_obs": "Visita ao showroom e reunião com compras e consultoria técnica. Foco em projetos corporativos e reposição de PRO LAMP.",
      "dias": 22,
      "entrevistado": "Mariana Okada", "classificacao": "Compradora", "perfil": "Lojista especializado",
      "entrevista_obs": "Ruptura de PRO LAMP em março/abril derrubou o giro. Quer pedido programado trimestral para não faltar. Sistemas e Módulos puxados por dois projetos corporativos em andamento.",
      "respostas": {"mix_atual": "Sistemas e Módulos lideram por projetos corporativos", "dor_principal": "Ruptura de PRO LAMP e prazo de entrega", "oportunidade": "Pedido programado trimestral de PRO LAMP e PRO LED", "atendimento": "Satisfeita, pede mais visitas técnicas"},
      "oportunidades": "Reposição programada de PRO LAMP; ampliar PRO LED nos projetos corporativos já fechados.",
      "obs_comerciais": "Aceita meta maior em PRO LAMP se houver garantia de estoque.",
      "obs_concorrentes": "Concorrente importado ganhou espaço em lâmpadas durante a ruptura.",
      "obs_exposicao": "Exposição premium, ambientes montados, boa iluminação de vitrine.",
      "obs_loja": "Equipe com três consultores técnicos e projetista interno.",
      "texto": "Cliente maduro, com espaço para recuperar PRO LAMP e crescer em PRO LED."
    },
    {
      "nome_fantasia": "CLIENTE TESTE 03 - CASA & LUZ",
      "razao_social": "CLIENTE TESTE 03 - CASA E LUZ MATERIAIS ELETRICOS LTDA",
      "legacy_razao_social": "CASA E LUZ MATERIAIS ELETRICOS LTDA",
      "cnpj": "00.000.000/0003-51",
      "codigo_erp": "CLI-TESTE-003",
      "cidade": "Santos", "estado": "SP",
      "endereco": "Rua Dr. Cochrane, 410 - Centro",
      "comprador": "Roberto Lima", "telefone": "(13) 98222-3344", "email": "roberto@casaeluz.com.br",
      "grupo": "G2", "categoria": "Silver",
      "realizado": {"DECOR NEWLINE": 1250, "DECOR STUDIO": 1700, "SISTEMAS E MÓDULOS": 1150, "PRO LED": 620, "PRO LAMP": 1300, "PERFIL": 1100, "FITAS E FONTES": 1450},
      "observacao": "Cliente em forte crescimento: todas as famílias acima da meta, destaque em FITAS E FONTES e PRO LAMP.",
      "info_comerciais": "Loja de materiais elétricos com balcão e venda para instaladores.",
      "imersao_titulo": "Imersão Comercial — Upgrade de Categoria",
      "imersao_obs": "Avaliação de potencial para migração de Silver para Gold e ampliação de mix decorativo.",
      "dias": 10,
      "entrevistado": "Roberto Lima", "classificacao": "Sócio-comprador", "perfil": "Material elétrico",
      "entrevista_obs": "Instaladores puxam Fitas e Fontes e PRO LAMP. Quer espaço para Decor Newline e Decor Studio em uma área nova de 40 m² que abre em dezembro.",
      "respostas": {"mix_atual": "Fitas e Fontes e PRO LAMP com alto giro no balcão", "dor_principal": "Pouco espaço de exposição decorativa hoje", "oportunidade": "Nova área de 40 m² para linha Decor a partir de dezembro", "atendimento": "Muito satisfeito com o representante"},
      "oportunidades": "Área nova para Decor; potencial de dobrar Decor Newline e Decor Studio no próximo ciclo.",
      "obs_comerciais": "Pede display de Decor em comodato e bonificação de entrada.",
      "obs_concorrentes": "Marcas de baixo custo no balcão, mas sem linha decorativa forte.",
      "obs_exposicao": "Exposição atual limitada a uma gôndola; nova área em obra.",
      "obs_loja": "Fluxo alto de instaladores, equipe de balcão enxuta.",
      "texto": "Candidato a upgrade de categoria; metas podem subir acima do padrão Silver."
    },
    {
      "nome_fantasia": "CLIENTE TESTE 04 - ELETRO NORTE",
      "razao_social": "CLIENTE TESTE 04 - ELETRO NORTE DISTRIBUIDORA DE ILUMINACAO LTDA",
      "legacy_razao_social": "ELETRO NORTE DISTRIBUIDORA DE ILUMINACAO LTDA",
      "cnpj": "00.000.000/0004-32",
      "codigo_erp": "CLI-TESTE-004",
      "cidade": "Ribeirão Preto", "estado": "SP",
      "endereco": "Av. Presidente Vargas, 2300 - Jardim América",
      "comprador": "Fernanda Costa", "telefone": "(16) 98333-4455", "email": "fernanda@eletronorte.com.br",
      "grupo": "G2", "categoria": "Gold",
      "realizado": {"DECOR NEWLINE": 1400, "DECOR STUDIO": 0, "SISTEMAS E MÓDULOS": 1500, "PRO LED": 1350, "PRO LAMP": 1250, "PERFIL": 900, "FITAS E FONTES": 1600},
      "observacao": "Desempenho abaixo do esperado: sem compra em DECOR STUDIO e PERFIL fraco. PRO LED e PRO LAMP próximos da meta.",
      "info_comerciais": "Distribuidora regional que revende para lojas menores do interior.",
      "imersao_titulo": "Imersão Comercial — Recuperação de Mix",
      "imersao_obs": "Diagnóstico das famílias sem giro e plano de reativação de Decor Studio e Perfil.",
      "dias": 35,
      "entrevistado": "Fernanda Costa", "classificacao": "Gerente de compras", "perfil": "Distribuidor",
      "entrevista_obs": "Decor Studio não gira com os lojistas dela; preço de Perfil acima do concorrente local. Técnico (PRO LED/PRO LAMP) vende bem. Aceita testar kit de entrada de Decor Studio.",
      "respostas": {"mix_atual": "Linha técnica forte, decorativa parada", "dor_principal": "Preço de Perfil e falta de giro em Decor Studio", "oportunidade": "Kit de entrada Decor Studio para 10 lojistas parceiros", "atendimento": "Pede mais apoio de treinamento para revendedores"},
      "oportunidades": "Kit de entrada Decor Studio; condição especial em Perfil para recuperar participação.",
      "obs_comerciais": "Meta de Decor Studio deve ser gradual; risco alto se mantida no padrão Gold.",
      "obs_concorrentes": "Concorrente regional com Perfil 12% mais barato e entrega em 48h.",
      "obs_exposicao": "Depósito sem showroom; venda por catálogo.",
      "obs_loja": "Equipe de vendas externa com 6 vendedores, pouco treinamento em produto decorativo.",
      "texto": "Cliente com potencial técnico; metas decorativas precisam de rampa."
    },
    {
      "nome_fantasia": "CLIENTE TESTE 05 - ARQLUX PROJETOS",
      "razao_social": "CLIENTE TESTE 05 - ARQLUX PROJETOS LUMINOTECNICOS LTDA",
      "legacy_razao_social": "ARQLUX PROJETOS LUMINOTECNICOS LTDA",
      "cnpj": "00.000.000/0005-13",
      "codigo_erp": "CLI-TESTE-005",
      "cidade": "São Paulo", "estado": "SP",
      "endereco": "Rua Oscar Freire, 980 - Jardins",
      "comprador": "Paulo Andrade", "telefone": "(11) 98444-5566", "email": "paulo@arqlux.com.br",
      "grupo": "G1", "categoria": "Black",
      "realizado": {"DECOR NEWLINE": 9100, "DECOR STUDIO": 6900, "SISTEMAS E MÓDULOS": 9300, "PRO LED": 2900, "PRO LAMP": 3500, "PERFIL": 7400, "FITAS E FONTES": 1700},
      "observacao": "Escritório de projetos com showroom. Decor acima da meta; FITAS E FONTES fraco por especificação de outra marca.",
      "info_comerciais": "Especificador: vende via projeto luminotécnico para residências de alto padrão.",
      "imersao_titulo": "Imersão Comercial — Especificação em Projetos",
      "imersao_obs": "Reunião com arquitetos do escritório para entender a especificação e a perda de Fitas e Fontes.",
      "dias": 18,
      "entrevistado": "Paulo Andrade", "classificacao": "Diretor de projetos", "perfil": "Especificador",
      "entrevista_obs": "Decor Newline e Decor Studio são a assinatura do escritório. Fitas e Fontes especificadas de outra marca por IRC e SDCM; topa testar se houver amostra com IRC 95+.",
      "respostas": {"mix_atual": "Decor como linha principal dos projetos", "dor_principal": "Fitas sem ficha técnica de IRC/SDCM disponível", "oportunidade": "Amostras de fita IRC 95+ para três projetos em especificação", "atendimento": "Quer acesso direto ao suporte técnico da fábrica"},
      "oportunidades": "Reverter especificação de Fitas e Fontes com amostras de alto IRC; manter crescimento em Decor.",
      "obs_comerciais": "Aceita meta de Decor acima do padrão Black; Fitas deve ficar conservadora até a amostra.",
      "obs_concorrentes": "Marca europeia de fitas especificada por qualidade de cor.",
      "obs_exposicao": "Showroom conceitual com ambientes de projeto.",
      "obs_loja": "Equipe de 8 arquitetos e 2 luminotécnicos.",
      "texto": "Cliente estratégico de especificação; potencial claro em Fitas e Fontes."
    },
    {
      "nome_fantasia": "CLIENTE TESTE 06 - CONSTRUFORTE",
      "razao_social": "CLIENTE TESTE 06 - CONSTRUFORTE HOME CENTER LTDA",
      "legacy_razao_social": "CONSTRUFORTE HOME CENTER LTDA",
      "cnpj": "00.000.000/0006-02",
      "codigo_erp": "CLI-TESTE-006",
      "cidade": "Sorocaba", "estado": "SP",
      "endereco": "Av. Itavuvu, 3100 - Jardim Ipanema",
      "comprador": "Juliana Martins", "telefone": "(15) 98555-6677", "email": "juliana@construforte.com.br",
      "grupo": "G2", "categoria": "Silver",
      "realizado": {"DECOR NEWLINE": 0, "DECOR STUDIO": 300, "SISTEMAS E MÓDULOS": 0, "PRO LED": 380, "PRO LAMP": 650, "PERFIL": 200, "FITAS E FONTES": 450},
      "observacao": "Cliente crítico: sem compra em DECOR NEWLINE e SISTEMAS E MÓDULOS, demais famílias abaixo da meta.",
      "info_comerciais": "Home center regional com foco em construção básica; iluminação é seção secundária.",
      "imersao_titulo": "Imersão Comercial — Diagnóstico de Seção de Iluminação",
      "imersao_obs": "Entendimento da queda de compras e da reorganização da seção de iluminação.",
      "dias": 40,
      "entrevistado": "Juliana Martins", "classificacao": "Compradora", "perfil": "Home center",
      "entrevista_obs": "Seção de iluminação reduzida em 2026 para dar espaço a pisos. Compras concentradas em itens de entrada (PRO LAMP, PRO LED). Não vê público para Decor Newline nem Sistemas e Módulos.",
      "respostas": {"mix_atual": "Somente itens de entrada", "dor_principal": "Espaço reduzido e público de baixo ticket", "oportunidade": "Ponta de gôndola com PRO LAMP e Fitas em promoção", "atendimento": "Contato esporádico, pede visita mensal"},
      "oportunidades": "Ponta de gôndola de PRO LAMP e Fitas e Fontes; avaliar retirada das famílias decorativas do mix.",
      "obs_comerciais": "Metas devem ficar abaixo do padrão Silver nas famílias decorativas e de sistemas.",
      "obs_concorrentes": "Marca própria do home center com preço agressivo em lâmpadas.",
      "obs_exposicao": "Seção pequena, mal sinalizada, sem iluminação ligada.",
      "obs_loja": "Rotatividade alta de equipe; nenhum vendedor dedicado à iluminação.",
      "texto": "Risco de churn; foco em itens de entrada e reconquista de espaço."
    }
  ]$json$::jsonb;

  v_rep_count INT;
  v_rep RECORD;
  v_company_id UUID;
  v_company_nome TEXT;
  v_upload_id UUID;
  v_c JSONB;
  v_idx INT := 1;
  v_metas JSONB;
  v_realizado JSONB;
  v_media JSONB;
  v_pct JSONB;
  v_status JSONB;
  v_cores JSONB;
  v_fam TEXT;
  v_meta NUMERIC;
  v_real NUMERIC;
  v_ratio NUMERIC;
  v_st TEXT;
  v_total_meta NUMERIC;
  v_total_real NUMERIC;
  v_total_ratio NUMERIC;
  v_client_id UUID;
  v_client_rep UUID;
  v_row_id UUID;
  v_immersion_id UUID;
  v_total_rows INT;
BEGIN
  -- 0. Valores financeiros privados são obrigatórios
  IF to_regclass('performance_private.rep_row_values') IS NULL THEN
    RAISE EXCEPTION 'Tabela performance_private.rep_row_values não existe neste banco.';
  END IF;

  -- 1. REPRESENTANTE TESTE: nome exato e único
  SELECT count(*) INTO v_rep_count
  FROM public.representatives
  WHERE UPPER(TRIM(nome)) = 'REPRESENTANTE TESTE';

  IF v_rep_count <> 1 THEN
    RAISE EXCEPTION 'Esperado exatamente 1 representante "REPRESENTANTE TESTE", encontrados %.', v_rep_count;
  END IF;

  SELECT id, company_id, nome, regiao INTO v_rep
  FROM public.representatives
  WHERE UPPER(TRIM(nome)) = 'REPRESENTANTE TESTE';

  -- 2. Upload ativo mais recente do representante (mesma regra da tela de Metas)
  SELECT u.id, u.company_id INTO v_upload_id, v_company_id
  FROM public.rep_performance_uploads u
  WHERE u.representative_id = v_rep.id
    AND u.substituida_em IS NULL
  ORDER BY u.periodo_fim DESC NULLS LAST, u.created_at DESC
  LIMIT 1;

  IF v_upload_id IS NULL THEN
    RAISE EXCEPTION 'REPRESENTANTE TESTE não tem upload de performance ativo.';
  END IF;

  -- 3. Âncora: o CLIENTE TESTE original precisa estar nesse upload
  IF NOT EXISTS (
    SELECT 1 FROM public.rep_performance_rows
    WHERE upload_id = v_upload_id
      AND UPPER(TRIM(razao_social)) = 'CLIENTE TESTE ILUMINACAO LTDA'
  ) THEN
    RAISE EXCEPTION 'CLIENTE TESTE ILUMINACAO LTDA não está no upload ativo % do REPRESENTANTE TESTE.', v_upload_id;
  END IF;

  -- 4. Empresa = a do upload; precisa existir e ser a mesma do representante
  SELECT nome INTO v_company_nome FROM public.companies WHERE id = v_company_id;
  IF v_company_nome IS NULL THEN
    RAISE EXCEPTION 'Empresa % do upload não encontrada.', v_company_id;
  END IF;
  IF v_rep.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'Representante (empresa %) e upload (empresa %) em empresas diferentes.', v_rep.company_id, v_company_id;
  END IF;

  RAISE NOTICE 'Empresa: % (%) | Representante: % | Upload: %', v_company_nome, v_company_id, v_rep.id, v_upload_id;

  FOR v_c IN SELECT * FROM jsonb_array_elements(v_clientes) LOOP
    v_idx := v_idx + 1;

    -- 4. Deriva metas, atingimento, farol e cor por família
    v_metas := '{}'::jsonb; v_realizado := '{}'::jsonb; v_media := '{}'::jsonb;
    v_pct := '{}'::jsonb; v_status := '{}'::jsonb; v_cores := '{}'::jsonb;
    v_total_meta := 0; v_total_real := 0;

    FOREACH v_fam IN ARRAY v_familias LOOP
      v_meta := (v_matrix -> (v_c ->> 'categoria') ->> v_fam)::numeric;
      v_real := COALESCE((v_c -> 'realizado' ->> v_fam)::numeric, 0);
      v_ratio := ROUND(v_real / NULLIF(v_meta, 0), 4);
      v_st := CASE
        WHEN v_ratio IS NULL OR v_ratio <= 0 THEN 'sem_compra'
        WHEN v_ratio < 0.5 THEN 'abaixo_meta'
        WHEN v_ratio < 0.7 THEN 'pode_melhorar'
        WHEN v_ratio < 0.9 THEN 'proximo'
        WHEN v_ratio <= 1 THEN 'otimo'
        ELSE 'excelente'
      END;
      v_metas := v_metas || jsonb_build_object(v_fam, v_meta);
      v_realizado := v_realizado || jsonb_build_object(v_fam, v_real);
      -- Média histórica fictícia: um pouco abaixo do realizado atual (tendência de alta suave).
      v_media := v_media || jsonb_build_object(v_fam, ROUND(v_real * 0.92 / 50) * 50);
      v_pct := v_pct || jsonb_build_object(v_fam, COALESCE(v_ratio, 0));
      v_status := v_status || jsonb_build_object(v_fam, v_st);
      v_cores := v_cores || jsonb_build_object(v_fam, CASE v_st
        WHEN 'sem_compra' THEN 'E5E5E5'
        WHEN 'abaixo_meta' THEN 'FCA5A5'
        WHEN 'pode_melhorar' THEN 'FDBA74'
        WHEN 'proximo' THEN 'FDE68A'
        WHEN 'otimo' THEN 'BEF264'
        ELSE '6EE7B7'
      END);
      v_total_meta := v_total_meta + v_meta;
      v_total_real := v_total_real + v_real;
    END LOOP;

    v_total_ratio := ROUND(v_total_real / NULLIF(v_total_meta, 0), 4);
    v_st := CASE
      WHEN v_total_ratio IS NULL OR v_total_ratio <= 0 THEN 'sem_compra'
      WHEN v_total_ratio < 0.5 THEN 'abaixo_meta'
      WHEN v_total_ratio < 0.7 THEN 'pode_melhorar'
      WHEN v_total_ratio < 0.9 THEN 'proximo'
      WHEN v_total_ratio <= 1 THEN 'otimo'
      ELSE 'excelente'
    END;

    -- 5. Cliente: somente identificadores fictícios exatos, na mesma empresa
    v_client_id := NULL;
    v_client_rep := NULL;
    SELECT id, representative_id INTO v_client_id, v_client_rep
    FROM public.clients
    WHERE company_id = v_company_id
      AND (
        UPPER(TRIM(razao_social)) = v_c ->> 'razao_social'
        OR documento = v_c ->> 'cnpj'
        OR cnpj = v_c ->> 'cnpj'
        OR codigo_erp = v_c ->> 'codigo_erp'
      )
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_client_id IS NOT NULL AND v_client_rep IS NOT NULL AND v_client_rep <> v_rep.id THEN
      RAISE EXCEPTION 'Cliente % já existe vinculado a outro representante (%); seed abortado para preservar dados reais.',
        v_c ->> 'razao_social', v_client_rep;
    END IF;

    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (
        company_id, representative_id, nome_fantasia, razao_social, cnpj, documento, codigo_erp,
        cidade, municipio, estado, regiao, endereco, nome_comprador, telefone, whatsapp, email,
        grupo, categoria, status, nome_representante_erp, info_comerciais, obs_cliente
      ) VALUES (
        v_company_id, v_rep.id, v_c ->> 'nome_fantasia', v_c ->> 'razao_social',
        v_c ->> 'cnpj', v_c ->> 'cnpj', v_c ->> 'codigo_erp',
        v_c ->> 'cidade', v_c ->> 'cidade', v_c ->> 'estado', COALESCE(v_rep.regiao, 'SP'),
        v_c ->> 'endereco', v_c ->> 'comprador', v_c ->> 'telefone', v_c ->> 'telefone',
        v_c ->> 'email', (v_c ->> 'grupo')::public.client_group,
        (v_c ->> 'categoria')::public.client_category, 'ativo'::public.client_status, v_rep.nome,
        v_c ->> 'info_comerciais',
        'Cliente fictício da carteira do REPRESENTANTE TESTE para homologação de Metas, BI e IA.'
      )
      RETURNING id INTO v_client_id;
    ELSE
      UPDATE public.clients
      SET representative_id = v_rep.id,
          nome_fantasia = v_c ->> 'nome_fantasia',
          razao_social = v_c ->> 'razao_social',
          nome_representante_erp = v_rep.nome,
          categoria = (v_c ->> 'categoria')::public.client_category,
          grupo = (v_c ->> 'grupo')::public.client_group,
          status = 'ativo'::public.client_status,
          updated_at = now()
      WHERE id = v_client_id;
    END IF;

    -- 6. Linha de performance no upload ativo (razão social exata, nova ou da versão anterior do seed)
    v_row_id := NULL;
    SELECT id INTO v_row_id
    FROM public.rep_performance_rows
    WHERE upload_id = v_upload_id
      AND UPPER(TRIM(razao_social)) IN (v_c ->> 'razao_social', v_c ->> 'legacy_razao_social')
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_row_id IS NULL THEN
      INSERT INTO public.rep_performance_rows (
        company_id, upload_id, ordem, razao_social, categoria, total_pct, total_pct_status,
        familia_pct, metas_status, metas_cores, observacao, acompanhar
      ) VALUES (
        v_company_id, v_upload_id, v_idx, v_c ->> 'razao_social', v_c ->> 'categoria',
        v_total_ratio, v_st, v_pct, v_status, v_cores, v_c ->> 'observacao',
        v_total_ratio < 0.9
      )
      RETURNING id INTO v_row_id;
    ELSE
      UPDATE public.rep_performance_rows
      SET ordem = v_idx,
          razao_social = v_c ->> 'razao_social',
          categoria = v_c ->> 'categoria',
          total_pct = v_total_ratio,
          total_pct_status = v_st,
          familia_pct = v_pct,
          metas_status = v_status,
          metas_cores = v_cores,
          observacao = v_c ->> 'observacao',
          acompanhar = v_total_ratio < 0.9
      WHERE id = v_row_id;
    END IF;

    -- 7. Valores financeiros privados (R$) das 7 famílias
    INSERT INTO performance_private.rep_row_values (row_id, upload_id, total_meta, metas, realizado, media)
    VALUES (v_row_id, v_upload_id, v_total_meta, v_metas, v_realizado, v_media)
    ON CONFLICT (row_id) DO UPDATE
    SET upload_id = EXCLUDED.upload_id,
        total_meta = EXCLUDED.total_meta,
        metas = EXCLUDED.metas,
        realizado = EXCLUDED.realizado,
        media = EXCLUDED.media,
        updated_at = now();

    -- 8. Imersão
    SELECT id INTO v_immersion_id
    FROM public.immersions
    WHERE client_id = v_client_id AND representative_id = v_rep.id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_immersion_id IS NULL THEN
      INSERT INTO public.immersions (
        company_id, client_id, representative_id, status, titulo, subject_type, data_visita, observacoes
      ) VALUES (
        v_company_id, v_client_id, v_rep.id, 'concluida'::public.immersion_status, v_c ->> 'imersao_titulo', 'client',
        CURRENT_DATE - ((v_c ->> 'dias')::int * INTERVAL '1 day'), v_c ->> 'imersao_obs'
      )
      RETURNING id INTO v_immersion_id;
    END IF;

    -- 9. Entrevista
    IF NOT EXISTS (SELECT 1 FROM public.interviews WHERE immersion_id = v_immersion_id) THEN
      INSERT INTO public.interviews (
        company_id, client_id, immersion_id, empresa_nome, entrevistado_nome, entrevistador_nome,
        entrevistado_classificacao, perfil, data_entrevista, observacoes, respostas
      ) VALUES (
        v_company_id, v_client_id, v_immersion_id, v_c ->> 'razao_social', v_c ->> 'entrevistado',
        'Equipe Comercial PoolFlux', v_c ->> 'classificacao', v_c ->> 'perfil',
        CURRENT_DATE - ((v_c ->> 'dias')::int * INTERVAL '1 day'),
        v_c ->> 'entrevista_obs', v_c -> 'respostas'
      );
    ELSE
      UPDATE public.interviews
      SET empresa_nome = v_c ->> 'razao_social'
      WHERE immersion_id = v_immersion_id;
    END IF;

    -- 10. Notas de visita de campo
    IF NOT EXISTS (SELECT 1 FROM public.field_visit_inputs WHERE immersion_id = v_immersion_id) THEN
      INSERT INTO public.field_visit_inputs (
        company_id, immersion_id, scope, oportunidades, observacoes_comerciais,
        observacoes_concorrentes, observacoes_exposicao, observacoes_loja, texto
      ) VALUES (
        v_company_id, v_immersion_id, 'immersion', v_c ->> 'oportunidades',
        v_c ->> 'obs_comerciais', v_c ->> 'obs_concorrentes', v_c ->> 'obs_exposicao',
        v_c ->> 'obs_loja', v_c ->> 'texto'
      );
    END IF;

    RAISE NOTICE 'Cliente % | linha % | atingimento % (%)', v_c ->> 'nome_fantasia', v_row_id, v_total_ratio, v_st;
  END LOOP;

  -- 11. Atingimento geral do upload = realizado total ÷ meta total das linhas com valores
  UPDATE public.rep_performance_uploads u
  SET atingimento_geral = sub.ratio
  FROM (
    SELECT ROUND(
      SUM((SELECT SUM(value::numeric) FROM jsonb_each_text(v.realizado)))
        / NULLIF(SUM(v.total_meta), 0), 4) AS ratio
    FROM performance_private.rep_row_values v
    WHERE v.upload_id = v_upload_id
  ) sub
  WHERE u.id = v_upload_id AND sub.ratio IS NOT NULL;

  -- 12. Conferência final
  SELECT count(*) INTO v_total_rows
  FROM public.rep_performance_rows
  WHERE upload_id = v_upload_id AND UPPER(TRIM(razao_social)) LIKE 'CLIENTE TESTE%';

  IF v_total_rows < 6 THEN
    RAISE EXCEPTION 'Conferência falhou: % linhas CLIENTE TESTE no upload (esperado 6).', v_total_rows;
  END IF;

  RAISE NOTICE 'Seed concluído: % linhas CLIENTE TESTE no upload %.', v_total_rows, v_upload_id;
END $$;
