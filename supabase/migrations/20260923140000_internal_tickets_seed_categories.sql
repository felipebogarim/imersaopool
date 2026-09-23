-- Módulo "Solicitações Internas" — categorias iniciais.
--
-- A migration 20260923090100 só semeou os 7 setores (por instrução
-- explícita do briefing: "Crie os setores sem pessoas vinculadas"). Nenhuma
-- categoria foi criada, então o campo obrigatório "Categoria" em Novo Ticket
-- ficava sem nenhuma opção — impossível criar um ticket até um admin
-- cadastrar categorias manualmente em Admin → Solicitações Internas.
--
-- Os 7 nomes abaixo vêm literalmente da lista de "Exemplos" do briefing
-- original (pintura especial, customização, prazo de produção, validação de
-- cadastro, pendência financeira, material para Trade, decisão da
-- Diretoria) — não são inventados. O setor padrão de cada uma é o
-- mapeamento óbvio pelo próprio nome (ex.: "prazo de produção" → Produção).
-- Um admin pode editar/desativar/adicionar categorias livremente depois.

INSERT INTO public.internal_ticket_categories (name, default_sector_id)
SELECT v.name, s.id
FROM (VALUES
  ('Pintura especial em produto', 'Engenharia'),
  ('Customização de dimensão ou componente', 'Engenharia'),
  ('Consulta de prazo de produção', 'Produção'),
  ('Validação de cadastro', 'Cadastro'),
  ('Pendência financeira', 'Financeiro'),
  ('Material para Trade', 'Trade'),
  ('Decisão da Diretoria', 'Diretoria')
) AS v(name, sector_name)
JOIN public.internal_ticket_sectors s ON s.name = v.sector_name
ON CONFLICT (name) DO NOTHING;
