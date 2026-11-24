-- ============================================================================
-- MIGRATION: Limpeza segura de registros comprovadamente inválidos
--            ("(vazio)", linhas em branco, totalizadores e categorias não-comerciais)
--
-- Regras de segurança:
-- 1. Preserva 100% dos clientes comerciais reais e os 6 CLIENTES TESTE.
-- 2. Atualiza a função SQL public.is_total_row para bloquear "(VAZIO)" definitivamente.
-- 3. Remove em cascata apenas dependências de linhas sem identificação de cliente.
-- ============================================================================

-- 1. Atualizar public.is_total_row para reconhecer (vazio) e variações
CREATE OR REPLACE FUNCTION public.is_total_row(_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH n AS (
    SELECT regexp_replace(
             btrim(
               regexp_replace(
                 upper(translate(COALESCE(_name,''),
                   'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                   'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
                 '[[:space:]]+', ' ', 'g'),
               ' .:;-'),
             '[.:;]+$', '') AS v
  )
  SELECT v = '' OR v IN (
    'TOTAL','TOTAL GERAL','TOTAL GERAL DA META','TOTAL DA META','TOTAL META',
    'TOTAL GERAL META','SOMA','SOMATORIO','SUBTOTAL','SUB TOTAL',
    'TOTAL DA CARTEIRA','TOTAL DO REPRESENTANTE','TOTAL CARTEIRA',
    'MEDIA','MEDIA GERAL','TOTAIS','LEGENDA','OBSERVACAO','OBSERVACOES',
    'FAIXA %','FAIXA','ESTIMATIVA','PARTICIPACAO','ATINGIMENTO',
    '(VAZIO)','VAZIO'
  ) OR v ~ '^(TOTAL|SUBTOTAL|SUB TOTAL|SOMA|SOMATORIO|MEDIA)( |$)'
    OR v ~ '^(PARTICIPACAO|ATINGIMENTO|ESTIMATIVA|LEGENDA|OBSERVAC)'
    OR v ~ '.*\(VAZIO\).*'
  FROM n;
$$;

GRANT EXECUTE ON FUNCTION public.is_total_row(text) TO authenticated, anon, service_role;

-- 2. Limpeza de valores privados em performance_private.rep_row_values
-- associados a linhas comprovadamente inválidas
DELETE FROM performance_private.rep_row_values
WHERE row_id IN (
  SELECT id FROM public.rep_performance_rows
  WHERE
    (upper(COALESCE(razao_social, '')) NOT LIKE 'CLIENTE TESTE%')
    AND (
      COALESCE(btrim(razao_social), '') = ''
      OR upper(btrim(razao_social)) IN ('(VAZIO)', 'VAZIO')
      OR razao_social ILIKE '%(vazio)%'
      OR razao_social ILIKE '10 XD SOLUCOES%'
      OR COALESCE(btrim(categoria), '') = ''
      OR upper(btrim(categoria)) IN ('(VAZIO)', 'VAZIO', 'CONSUMIDOR FINAL', 'CONSUMIDOR', 'NONE', 'NULL', 'NAN', '-')
      OR categoria ILIKE '%(vazio)%'
      OR public.is_total_row(razao_social)
    )
);

-- 3. Limpeza das linhas inválidas na tabela rep_performance_rows
DELETE FROM public.rep_performance_rows
WHERE
  (upper(COALESCE(razao_social, '')) NOT LIKE 'CLIENTE TESTE%')
  AND (
    COALESCE(btrim(razao_social), '') = ''
    OR upper(btrim(razao_social)) IN ('(VAZIO)', 'VAZIO')
    OR razao_social ILIKE '%(vazio)%'
    OR razao_social ILIKE '10 XD SOLUCOES%'
    OR COALESCE(btrim(categoria), '') = ''
    OR upper(btrim(categoria)) IN ('(VAZIO)', 'VAZIO', 'CONSUMIDOR FINAL', 'CONSUMIDOR', 'NONE', 'NULL', 'NAN', '-')
    OR categoria ILIKE '%(vazio)%'
    OR public.is_total_row(razao_social)
  );

-- 4. Limpeza de ciclos de metas com identificador inválido/vazio (se houver)
DELETE FROM public.performance_goal_cycles
WHERE
  (upper(COALESCE(razao_social, '')) NOT LIKE 'CLIENTE TESTE%')
  AND (
    COALESCE(btrim(razao_social), '') = ''
    OR upper(btrim(razao_social)) IN ('(VAZIO)', 'VAZIO')
    OR razao_social ILIKE '%(vazio)%'
    OR cliente_key ILIKE '%(VAZIO)%'
    OR razao_social ILIKE '10 XD SOLUCOES%'
    OR cliente_key ILIKE '10 XD SOLUCOES%'
    OR COALESCE(btrim(categoria), '') = ''
    OR upper(btrim(categoria)) IN ('(VAZIO)', 'VAZIO', 'CONSUMIDOR FINAL', 'CONSUMIDOR')
    OR categoria ILIKE '%(vazio)%'
    OR public.is_total_row(razao_social)
  );
