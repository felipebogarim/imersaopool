-- Atualiza o roteiro VISITA EST. CLIENTE para o perfil store_visit
UPDATE public.roteiros 
SET perfil_alvo = 'store_visit'
WHERE id = '6d028ab8-348e-4024-8dd4-a9ccd0d5b862';

-- Atualiza os títulos e códigos dos capítulos do roteiro
UPDATE public.capitulos SET titulo = 'Contexto, dinâmica e percepção inicial', codigo = 'C1' WHERE roteiro_id = '6d028ab8-348e-4024-8dd4-a9ccd0d5b862' AND ordem = 1;
UPDATE public.capitulos SET titulo = 'Atores, influência e processo de decisão', codigo = 'C2' WHERE roteiro_id = '6d028ab8-348e-4024-8dd4-a9ccd0d5b862' AND ordem = 2;
UPDATE public.capitulos SET titulo = 'Oferta, categorias e desempenho percebido', codigo = 'C3' WHERE roteiro_id = '6d028ab8-348e-4024-8dd4-a9ccd0d5b862' AND ordem = 3;
UPDATE public.capitulos SET titulo = 'Posicionamento, diferenciação e oportunidades', codigo = 'C4' WHERE roteiro_id = '6d028ab8-348e-4024-8dd4-a9ccd0d5b862' AND ordem = 4;
UPDATE public.capitulos SET titulo = 'Relacionamento, capacitação e ativação', codigo = 'C5' WHERE roteiro_id = '6d028ab8-348e-4024-8dd4-a9ccd0d5b862' AND ordem = 5;
UPDATE public.capitulos SET titulo = 'Operação, atendimento e experiência', codigo = 'C6' WHERE roteiro_id = '6d028ab8-348e-4024-8dd4-a9ccd0d5b862' AND ordem = 6;
UPDATE public.capitulos SET titulo = 'Síntese, prioridades e próximos passos', codigo = 'C7' WHERE roteiro_id = '6d028ab8-348e-4024-8dd4-a9ccd0d5b862' AND ordem = 7;
