UPDATE public.capitulos
SET codigo = 'informacoes_adicionais',
    titulo = 'Informações Adicionais',
    orientacao = 'Registre aqui tudo o que é importante mas não se encaixou nos capítulos anteriores.'
WHERE codigo = 'demais_consideracoes';

INSERT INTO public.capitulos (roteiro_id, ordem, codigo, titulo, orientacao, hipotese, lente_default)
SELECT r.id,
       COALESCE((SELECT MAX(c.ordem) FROM public.capitulos c WHERE c.roteiro_id = r.id), 0) + 1,
       'informacoes_adicionais',
       'Informações Adicionais',
       'Registre aqui tudo o que é importante mas não se encaixou nos capítulos anteriores.',
       '—',
       'oportunidade'
FROM public.roteiros r
WHERE NOT EXISTS (
  SELECT 1 FROM public.capitulos c WHERE c.roteiro_id = r.id AND c.codigo = 'informacoes_adicionais'
);