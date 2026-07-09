-- 1. Adiciona 'imersao' à lista de perfis permitidos
ALTER TABLE public.roteiro_perfis DROP CONSTRAINT IF EXISTS roteiro_perfis_perfil_check;
ALTER TABLE public.roteiro_perfis ADD CONSTRAINT roteiro_perfis_perfil_check
  CHECK (perfil = ANY (ARRAY['representante','gestor_nl','trade_nl','lojista','projetista','vendedor','gestor_de_loja','arquiteto','especificador','imersao','outro']));

-- 2. immersions.roteiro_id
ALTER TABLE public.immersions
  ADD COLUMN IF NOT EXISTS roteiro_id UUID REFERENCES public.roteiros(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_immersions_roteiro ON public.immersions(roteiro_id);

-- 3. Vincula roteiros "Imersão em Campo" ao perfil 'imersao'
INSERT INTO public.roteiro_perfis (roteiro_id, perfil, company_id)
SELECT id, 'imersao', company_id FROM public.roteiros WHERE nome ILIKE 'Imersão em Campo%'
ON CONFLICT DO NOTHING;

-- 4. Capítulo "Demais Considerações" como último em todos os roteiros que ainda não têm
INSERT INTO public.capitulos (roteiro_id, ordem, codigo, titulo, orientacao, lente_default, campos_matriz, pergunta_abertura)
SELECT r.id,
       COALESCE((SELECT MAX(ordem) FROM public.capitulos WHERE roteiro_id = r.id), 0) + 1,
       'demais_consideracoes',
       'Demais Considerações',
       'Espaço aberto para qualquer informação relevante que não coube nos capítulos anteriores.',
       NULL,
       '[]'::jsonb,
       'Há algo mais que você gostaria de compartilhar, destacar ou registrar?'
FROM public.roteiros r
WHERE NOT EXISTS (
  SELECT 1 FROM public.capitulos c WHERE c.roteiro_id = r.id AND c.codigo = 'demais_consideracoes'
);