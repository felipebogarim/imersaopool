-- Validação da CATEGORIA de um cliente com os dados efetivos do banco (SOMENTE LEITURA).
-- Rodar no SQL Editor do Lovable. Troque o nome em `alvo` para validar outro cliente.
-- Mostra: (1) todos os uploads com a linha do cliente, período e se estão vigentes;
-- (2) valores por portfólio (realizado do mês de referência e MÉDIA do período);
-- (3) a memória de cálculo da média do semestre de corte, igual à do painel.

WITH alvo AS (SELECT 'AURUM ILUMINACAO LTDA'::text AS cliente_key),
linhas AS (
  SELECT r.id AS row_id, u.id AS upload_id, u.representative_id, u.periodo_label,
         u.periodo_inicio, u.periodo_fim, u.substituida_em, u.created_at,
         v.realizado, v.media, v.metas
  FROM public.rep_performance_rows r
  JOIN public.rep_performance_uploads u ON u.id = r.upload_id
  LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
  WHERE upper(btrim(r.razao_social)) = (SELECT cliente_key FROM alvo)
)
-- (1) + (2): origem dos valores, um registro por upload × portfólio
SELECT l.periodo_label,
       l.periodo_inicio,
       l.periodo_fim,
       (l.periodo_fim - l.periodo_inicio) / 28 + 1 AS meses_aprox,
       CASE WHEN l.substituida_em IS NULL THEN 'vigente' ELSE 'substituído' END AS situacao,
       f.familia,
       NULLIF(l.realizado ->> f.familia, '')::numeric AS realizado_mes_referencia,
       NULLIF(l.media ->> f.familia, '')::numeric AS media_mensal_periodo,
       l.upload_id,
       l.row_id
FROM linhas l
CROSS JOIN LATERAL (
  SELECT DISTINCT k AS familia
  FROM jsonb_object_keys(COALESCE(l.media, '{}') || COALESCE(l.realizado, '{}')) k
) f
ORDER BY l.periodo_fim DESC, l.created_at DESC, f.familia;

-- (3) Resumo por upload: Σ da MÉDIA por portfólio (= média mensal do cliente no período) e
-- se o período está contido no semestre de corte (o que torna a média "real do semestre").
WITH alvo AS (SELECT 'AURUM ILUMINACAO LTDA'::text AS cliente_key),
linhas AS (
  SELECT u.periodo_label, u.periodo_inicio, u.periodo_fim, u.substituida_em, v.media, v.realizado
  FROM public.rep_performance_rows r
  JOIN public.rep_performance_uploads u ON u.id = r.upload_id
  LEFT JOIN performance_private.rep_row_values v ON v.row_id = r.id
  WHERE upper(btrim(r.razao_social)) = (SELECT cliente_key FROM alvo)
)
SELECT l.periodo_label,
       l.periodo_inicio,
       l.periodo_fim,
       CASE WHEN l.substituida_em IS NULL THEN 'vigente' ELSE 'substituído' END AS situacao,
       date_trunc('month', l.periodo_fim)::date
         - CASE WHEN extract(month FROM l.periodo_fim) <= 6
                THEN (extract(month FROM l.periodo_fim) - 1)::int
                ELSE (extract(month FROM l.periodo_fim) - 7)::int END * interval '1 month'
         AS inicio_semestre_corte,
       (l.periodo_inicio >= date_trunc('month', l.periodo_fim)::date
         - CASE WHEN extract(month FROM l.periodo_fim) <= 6
                THEN (extract(month FROM l.periodo_fim) - 1)::int
                ELSE (extract(month FROM l.periodo_fim) - 7)::int END * interval '1 month')
         AS contido_no_semestre,
       (SELECT sum(NULLIF(x.value, '')::numeric) FROM jsonb_each_text(COALESCE(l.media, '{}')) x)
         AS soma_media_mensal,
       (SELECT sum(NULLIF(x.value, '')::numeric) FROM jsonb_each_text(COALESCE(l.realizado, '{}')) x)
         AS soma_realizado_mes_referencia
FROM linhas l
ORDER BY l.periodo_fim DESC;
