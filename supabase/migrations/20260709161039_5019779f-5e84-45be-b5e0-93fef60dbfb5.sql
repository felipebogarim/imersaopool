
-- Add sintese jsonb per capítulo em sessao_capitulos
ALTER TABLE public.sessao_capitulos
  ADD COLUMN IF NOT EXISTS sintese jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Preencher campos_matriz padrão para capítulos que estão vazios
UPDATE public.capitulos SET campos_matriz = '["top_of_mind","percepcao_preco","checou_tabela","evidencia"]'::jsonb
  WHERE codigo='percepcao_marca' AND (campos_matriz IS NULL OR jsonb_array_length(campos_matriz)=0);

UPDATE public.capitulos SET campos_matriz = '["o_que_funciona","o_que_nao_funciona","skus_adormecidos","motivo","evidencia"]'::jsonb
  WHERE codigo='mix_e_esforco' AND (campos_matriz IS NULL OR jsonb_array_length(campos_matriz)=0);

UPDATE public.capitulos SET campos_matriz = '["concorrente","categorias_onde_ganha","sinal_de_conflito","evidencia"]'::jsonb
  WHERE codigo='concorrencia' AND (campos_matriz IS NULL OR jsonb_array_length(campos_matriz)=0);

UPDATE public.capitulos SET campos_matriz = '["produto","objecao","argumento_usado","qualidade_argumento","evidencia"]'::jsonb
  WHERE codigo='argumento_tecnico' AND (campos_matriz IS NULL OR jsonb_array_length(campos_matriz)=0);

UPDATE public.capitulos SET campos_matriz = '["criterio_declarado","criterio_revelado","valor_defensavel","evidencia"]'::jsonb
  WHERE codigo='decisao_cliente' AND (campos_matriz IS NULL OR jsonb_array_length(campos_matriz)=0);

UPDATE public.capitulos SET campos_matriz = '["oportunidade","ameaca","cuidado","acao_sugerida","evidencia"]'::jsonb
  WHERE codigo='oportunidades_ameacas' AND (campos_matriz IS NULL OR jsonb_array_length(campos_matriz)=0);
