UPDATE public.rep_performance_uploads u
SET categoria_metas = jsonb_build_object(
  'Black', 41000,
  'Gold', 15000,
  'Silver', 7000,
  '__family_metas_by_category__', jsonb_build_object(
    'Black', jsonb_build_object(
      'DECOR NEWLINE', 8000,
      'DECOR STUDIO', 6000,
      'SISTEMAS E MODULOS', 10000,
      'SISTEMAS E MÓDULOS', 10000,
      'PRO LED', 3000,
      'PRO LAMP', 4000,
      'PERFIL', 7000,
      'FITAS E FONTES', 3000
    ),
    'Gold', jsonb_build_object(
      'DECOR NEWLINE', 2500,
      'DECOR STUDIO', 3000,
      'SISTEMAS E MODULOS', 2500,
      'SISTEMAS E MÓDULOS', 2500,
      'PRO LED', 1500,
      'PRO LAMP', 1500,
      'PERFIL', 2000,
      'FITAS E FONTES', 2000
    ),
    'Silver', jsonb_build_object(
      'DECOR NEWLINE', 1000,
      'DECOR STUDIO', 1500,
      'SISTEMAS E MODULOS', 1000,
      'SISTEMAS E MÓDULOS', 1000,
      'PRO LED', 500,
      'PRO LAMP', 1000,
      'PERFIL', 1000,
      'FITAS E FONTES', 1000
    )
  )
)
FROM public.representatives r
WHERE r.id = u.representative_id
  AND lower(r.nome) = lower('SALTON / FABIO')
  AND u.substituida_em IS NULL;