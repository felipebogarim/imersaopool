-- ============================================================================
-- DIAGNÓSTICO DE LINHAS INVÁLIDAS / "(VAZIO)" EM REP_PERFORMANCE_ROWS
-- Modo: SOMENTE LEITURA (SELECT)
-- Objetivo: Identificar linhas sem identificação de cliente ("(vazio)", em branco,
--           totalizadores ou categorias não-comerciais) e checar se possuem
--           valores financeiros, vínculos ou dependências antes de qualquer exclusão.
-- ============================================================================

-- 1. Resumo quantitativo de linhas na tabela rep_performance_rows
WITH classificacao AS (
  SELECT
    r.id,
    r.upload_id,
    r.razao_social,
    r.categoria,
    r.total_pct,
    u.representative_id,
    rep.nome AS rep_nome,
    u.periodo_label,
    u.substituida_em IS NULL AS upload_ativo,
    CASE
      -- Clientes de teste preservados
      WHEN upper(r.razao_social) LIKE 'CLIENTE TESTE%' THEN 'CLIENTE TESTE (PRESERVAR)'
      -- Linhas com "(vazio)"
      WHEN upper(btrim(COALESCE(r.razao_social, ''))) IN ('(VAZIO)', 'VAZIO')
        OR r.razao_social ILIKE '%(vazio)%'
        OR upper(btrim(COALESCE(r.categoria, ''))) IN ('(VAZIO)', 'VAZIO')
        OR r.categoria ILIKE '%(vazio)%' THEN 'LINHA (VAZIO) INVALIDA'
      -- Razão social vazia ou nula
      WHEN COALESCE(btrim(r.razao_social), '') = '' THEN 'RAZAO SOCIAL VAZIA'
      -- Categoria consumidor final ou não-comercial
      WHEN upper(btrim(COALESCE(r.categoria, ''))) IN ('CONSUMIDOR FINAL', 'CONSUMIDOR')
        OR r.razao_social ILIKE '10 XD SOLUCOES%' THEN 'NAO COMERCIAL / CONSUMIDOR FINAL'
      -- Categoria vazia ou nula
      WHEN COALESCE(btrim(r.categoria), '') IN ('', 'NONE', 'NULL', 'NAN', '-', 'UNDEFINED') THEN 'CATEGORIA AUSENTE'
      -- Linhas de totalizadores / legendas da planilha
      WHEN public.is_total_row(r.razao_social) THEN 'TOTALIZADOR / LEGENDA'
      ELSE 'CLIENTE VALIDO'
    END AS tipo_registro
  FROM public.rep_performance_rows r
  LEFT JOIN public.rep_performance_uploads u ON u.id = r.upload_id
  LEFT JOIN public.representatives rep ON rep.id = u.representative_id
)
SELECT
  tipo_registro,
  count(*) AS total_linhas,
  count(*) FILTER (WHERE upload_ativo) AS linhas_em_uploads_ativos,
  count(DISTINCT representative_id) AS reps_afetados,
  string_agg(DISTINCT rep_nome, ', ') AS representantes
FROM classificacao
GROUP BY tipo_registro
ORDER BY total_linhas DESC;

-- 2. Detalhe de todas as linhas comprovadamente inválidas (para validação humana)
SELECT
  r.id AS row_id,
  r.upload_id,
  u.substituida_em IS NULL AS upload_ativo,
  rep.nome AS representante,
  u.periodo_label,
  r.ordem,
  r.razao_social,
  r.categoria,
  r.total_pct,
  -- Checa se possui registros financeiros vinculados em rep_row_values
  EXISTS(
    SELECT 1 FROM performance_private.rep_row_values v WHERE v.row_id = r.id
  ) AS tem_valores_financeiros,
  -- Checa se possui ciclo de metas individual criado
  EXISTS(
    SELECT 1 FROM public.performance_goal_cycles c
    WHERE c.cliente_key = upper(btrim(COALESCE(r.razao_social, '')))
       OR c.row_id = r.id
  ) AS tem_ciclo_metas,
  -- Checa se possui cliente cadastrado no CRM/cadastro geral
  EXISTS(
    SELECT 1 FROM public.clients cl
    WHERE upper(btrim(cl.razao_social)) = upper(btrim(COALESCE(r.razao_social, '')))
       OR upper(btrim(COALESCE(cl.nome_fantasia, ''))) = upper(btrim(COALESCE(r.razao_social, '')))
  ) AS existe_no_cadastro_clientes
FROM public.rep_performance_rows r
LEFT JOIN public.rep_performance_uploads u ON u.id = r.upload_id
LEFT JOIN public.representatives rep ON rep.id = u.representative_id
WHERE
  -- Apenas registros com problema
  upper(btrim(COALESCE(r.razao_social, ''))) IN ('(VAZIO)', 'VAZIO', '')
  OR r.razao_social ILIKE '%(vazio)%'
  OR upper(btrim(COALESCE(r.categoria, ''))) IN ('(VAZIO)', 'VAZIO', 'CONSUMIDOR FINAL', 'CONSUMIDOR')
  OR r.categoria ILIKE '%(vazio)%'
  OR r.razao_social ILIKE '10 XD SOLUCOES%'
  OR public.is_total_row(r.razao_social)
ORDER BY upload_ativo DESC, rep.nome NULLS LAST, r.ordem;

-- 3. Confirmação de integridade dos 6 clientes de teste
SELECT
  r.id,
  rep.nome AS representante,
  r.razao_social,
  r.categoria,
  r.total_pct,
  u.periodo_label
FROM public.rep_performance_rows r
JOIN public.rep_performance_uploads u ON u.id = r.upload_id
JOIN public.representatives rep ON rep.id = u.representative_id
WHERE upper(r.razao_social) LIKE 'CLIENTE TESTE%'
ORDER BY r.razao_social;
