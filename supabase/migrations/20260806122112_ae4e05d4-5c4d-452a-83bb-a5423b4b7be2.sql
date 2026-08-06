
WITH new_roteiro AS (
  INSERT INTO public.roteiros (nome, descricao, perfil_alvo, versao, ativo, company_id)
  SELECT 
    'Visita Cliente Final', 
    'Roteiro para visitas presenciais a clientes finais, showrooms e parceiros comerciais.', 
    'Cliente Final / Showroom', 
    1, 
    true,
    active_company_id
  FROM public.profiles 
  WHERE active_company_id IS NOT NULL 
  LIMIT 1
  RETURNING id
)
INSERT INTO public.capitulos (roteiro_id, ordem, codigo, titulo, orientacao, pergunta_abertura, pontos_escuta, lente_default)
SELECT id, 1, 'C1', 'Percepções de marca e visão inicial', 'Compreender a primeira leitura da loja, sua dinâmica e percepção de marca.', 'Como você descreveria o momento atual da loja?', ARRAY['Ritmo de trabalho', 'Organização do showroom', 'Marcas em destaque'], 'percepcao_marca'::public.perspectiva_lente FROM new_roteiro
UNION ALL
SELECT id, 2, 'C2', 'Arquitetos, vendedores e decisão', 'Entender como as decisões de marca e produto são tomadas.', 'Os projetos chegam com marcas e códigos definidos?', ARRAY['Influência dos arquitetos', 'Autonomia dos vendedores', 'Critérios de troca'], 'decisao'::public.perspectiva_lente FROM new_roteiro
UNION ALL
SELECT id, 3, 'C3', 'Visão por família de produtos', 'Avaliar cada família separadamente (Sistemas, LED, Lâmpadas, Perfis).', 'Quais sistemas têm maior saída?', ARRAY['Marcas predominantes', 'Diferenciais reconhecidos', 'Objeções comuns'], 'familias'::public.perspectiva_lente FROM new_roteiro
UNION ALL
SELECT id, 4, 'C4', 'Decorativo e oportunidade de posicionamento', 'Avaliar território decorativo e exclusividade.', 'Quais marcas representam design premium?', ARRAY['Marcas premium vs intermediárias', 'Lacunas no portfólio', 'Oportunidades de exposição'], 'mix'::public.perspectiva_lente FROM new_roteiro
UNION ALL
SELECT id, 5, 'C5', 'Arquitetos, treinamentos e relacionamento', 'Avaliar formas de aproximação e engajamento.', 'Que temas atraem arquitetos?', ARRAY['Disponibilidade para eventos', 'Necessidade de treinamento técnico', 'Materiais de apoio'], 'oportunidade'::public.perspectiva_lente FROM new_roteiro
UNION ALL
SELECT id, 6, 'C6', 'Atendimento, velocidade e experiência operacional', 'Identificar gargalos operacionais e de atendimento.', 'Qual prazo de resposta é considerado adequado?', ARRAY['Canais de contato', 'Velocidade de retorno', 'Impacto do estoque'], 'cuidado'::public.perspectiva_lente FROM new_roteiro
UNION ALL
SELECT id, 7, 'C7', 'Conclusões, oportunidades e próximos passos', 'Consolidar as ações prioritárias.', 'Quais são os próximos passos prioritários?', ARRAY['Principais constatações', 'Ações imediatas', 'Responsáveis'], 'oportunidade'::public.perspectiva_lente FROM new_roteiro;
