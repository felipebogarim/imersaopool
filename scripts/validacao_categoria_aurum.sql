-- Validação da MÉDIA MENSAL e da CATEGORIA na timeline de metas (SOMENTE LEITURA).
-- Rodar no SQL Editor do Lovable. Reproduz a regra única de src/lib/performance-media-cliente.ts:
--   por portfólio: MÉDIA (R$) → REALIZADO (R$) → % × META ORIGINAL DO UPLOAD (estimado) → sem dado.
--   Portfólio sem dado fica fora da soma (nunca vira zero).
-- E classifica pela classificação comercial: Silver 3.000, Gold 6.000, Black 20.000 (média mensal).
-- Clientes validados: A&M, AMX e AURUM (ajuste os padrões ILIKE em `alvo` se o nome divergir).

-- (1) Detalhe por cliente × upload vigente × portfólio: de onde veio cada valor.
WITH alvo(padrao) AS (VALUES ('A&M%'), ('AMX%'), ('AURUM%')),
linhas AS (
  SELECT DISTINCT ON (r.razao_social)
         r.razao_social, r.categoria, r.familia_pct, u.periodo_label, u.periodo_inicio,
         u.periodo_fim, v.realizado, v.media, v.metas
  FROM public.rep_performance_rows r
  JOIN public.rep_performance_uploads u ON u.id = r.upload_id
  LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
  WHERE u.substituida_em IS NULL
    AND EXISTS (SELECT 1 FROM alvo a WHERE upper(btrim(r.razao_social)) ILIKE a.padrao)
  ORDER BY r.razao_social, u.periodo_fim DESC NULLS LAST, u.created_at DESC
),
port AS (
  SELECT l.*, f.familia,
         NULLIF(l.media ->> f.familia, '')::numeric AS v_media,
         NULLIF(l.realizado ->> f.familia, '')::numeric AS v_realizado,
         NULLIF(l.familia_pct ->> f.familia, '')::numeric AS v_pct,
         NULLIF(l.metas ->> f.familia, '')::numeric AS v_meta_original
  FROM linhas l
  CROSS JOIN LATERAL (
    SELECT DISTINCT k AS familia FROM jsonb_object_keys(
      COALESCE(l.media, '{}') || COALESCE(l.realizado, '{}') ||
      COALESCE(l.familia_pct, '{}') || COALESCE(l.metas, '{}')) k
  ) f
),
resolvido AS (
  SELECT p.*,
         CASE
           WHEN v_media >= 0 THEN v_media
           WHEN v_realizado >= 0 THEN v_realizado
           WHEN v_pct >= 0 AND v_meta_original > 0
             THEN (CASE WHEN v_pct <= 2.5 THEN v_pct ELSE v_pct / 100 END) * v_meta_original
         END AS valor_mensal,
         CASE
           WHEN v_media >= 0 THEN 'media'
           WHEN v_realizado >= 0 THEN 'realizado'
           WHEN v_pct >= 0 AND v_meta_original > 0 THEN 'ESTIMADO (% x meta original)'
           ELSE 'sem dado (fora da soma)'
         END AS fonte
  FROM port p
)
SELECT razao_social, categoria AS categoria_cadastrada, periodo_label, familia,
       v_media, v_realizado, v_pct, v_meta_original, round(valor_mensal, 2) AS valor_mensal, fonte
FROM resolvido
ORDER BY razao_social, familia;

-- (2) Resumo por cliente: média mensal, se há estimativa, categoria pela média e situação.
WITH alvo(padrao) AS (VALUES ('A&M%'), ('AMX%'), ('AURUM%')),
pisos AS (SELECT 3000::numeric AS silver, 6000::numeric AS gold, 20000::numeric AS black),
linhas AS (
  SELECT DISTINCT ON (r.razao_social)
         r.razao_social, r.categoria, r.familia_pct, u.periodo_inicio, u.periodo_fim,
         v.realizado, v.media, v.metas
  FROM public.rep_performance_rows r
  JOIN public.rep_performance_uploads u ON u.id = r.upload_id
  LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
  WHERE u.substituida_em IS NULL
    AND EXISTS (SELECT 1 FROM alvo a WHERE upper(btrim(r.razao_social)) ILIKE a.padrao)
  ORDER BY r.razao_social, u.periodo_fim DESC NULLS LAST, u.created_at DESC
),
port AS (
  SELECT l.razao_social, l.categoria, l.periodo_inicio, l.periodo_fim,
         NULLIF(l.media ->> f.familia, '')::numeric AS m,
         NULLIF(l.realizado ->> f.familia, '')::numeric AS r,
         NULLIF(l.familia_pct ->> f.familia, '')::numeric AS p,
         NULLIF(l.metas ->> f.familia, '')::numeric AS mt
  FROM linhas l
  LEFT JOIN LATERAL (
    SELECT DISTINCT k AS familia FROM jsonb_object_keys(
      COALESCE(l.media, '{}') || COALESCE(l.realizado, '{}') ||
      COALESCE(l.familia_pct, '{}') || COALESCE(l.metas, '{}')) k
  ) f ON true
),
cli AS (
  SELECT razao_social, categoria, periodo_inicio, periodo_fim,
         sum(CASE WHEN m >= 0 THEN m WHEN r >= 0 THEN r
                  WHEN p >= 0 AND mt > 0 THEN (CASE WHEN p <= 2.5 THEN p ELSE p / 100 END) * mt
             END) AS media_mensal,
         bool_or(COALESCE(m, -1) < 0 AND COALESCE(r, -1) < 0 AND p >= 0 AND mt > 0)
           AS tem_estimativa
  FROM port
  GROUP BY 1, 2, 3, 4
)
SELECT c.razao_social, c.categoria AS categoria_cadastrada, c.periodo_inicio, c.periodo_fim,
       round(c.media_mensal, 2) AS media_mensal, COALESCE(c.tem_estimativa, false) AS estimado,
       ps.silver AS piso_silver, ps.gold AS piso_gold, ps.black AS piso_black,
       CASE
         WHEN c.media_mensal IS NULL THEN 'sem base'
         WHEN c.media_mensal >= ps.black THEN 'Black'
         WHEN c.media_mensal >= ps.gold THEN 'Gold'
         WHEN c.media_mensal >= ps.silver THEN 'Silver'
         ELSE 'abaixo de Silver'
       END AS categoria_pela_media,
       round(c.media_mensal - CASE c.categoria WHEN 'Black' THEN ps.black
                                               WHEN 'Gold' THEN ps.gold
                                               WHEN 'Silver' THEN ps.silver END, 2)
         AS saldo_mensal_sobre_piso_cadastrado
FROM cli c CROSS JOIN pisos ps
ORDER BY c.razao_social;
