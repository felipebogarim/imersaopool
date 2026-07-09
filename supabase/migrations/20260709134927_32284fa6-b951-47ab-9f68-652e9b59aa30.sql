
-- 1) Drop tema/tema_outro from interviews
ALTER TABLE public.interviews DROP COLUMN IF EXISTS tema;
ALTER TABLE public.interviews DROP COLUMN IF EXISTS tema_outro;

-- 2) Rename roteiro Representante
UPDATE public.roteiros
SET nome = 'Imersão em Campo — Representante'
WHERE nome = 'Imersão em Campo v1';

-- 3) Create roteiro_perfis (N:N)
CREATE TABLE IF NOT EXISTS public.roteiro_perfis (
  roteiro_id UUID NOT NULL REFERENCES public.roteiros(id) ON DELETE CASCADE,
  perfil TEXT NOT NULL CHECK (perfil IN (
    'representante','gestor_nl','trade_nl','lojista','projetista',
    'vendedor','gestor_de_loja','arquiteto','especificador','outro'
  )),
  company_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (roteiro_id, perfil)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roteiro_perfis TO authenticated;
GRANT ALL ON public.roteiro_perfis TO service_role;

ALTER TABLE public.roteiro_perfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roteiro_perfis select same company"
ON public.roteiro_perfis FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.roteiros r WHERE r.id = roteiro_id AND r.company_id = public.current_company_id())
);

CREATE POLICY "roteiro_perfis manage admin/gestor"
ON public.roteiro_perfis FOR ALL TO authenticated
USING (public.is_admin_or_gestor(auth.uid()))
WITH CHECK (public.is_admin_or_gestor(auth.uid()));

-- Trigger to fill company_id from roteiro
CREATE OR REPLACE FUNCTION public.set_roteiro_perfil_company()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.roteiros WHERE id = NEW.roteiro_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_set_roteiro_perfil_company
BEFORE INSERT ON public.roteiro_perfis
FOR EACH ROW EXECUTE FUNCTION public.set_roteiro_perfil_company();

-- 4) Seed mapping for existing roteiros
INSERT INTO public.roteiro_perfis (roteiro_id, perfil)
SELECT id, 'representante' FROM public.roteiros WHERE nome = 'Imersão em Campo — Representante'
ON CONFLICT DO NOTHING;

INSERT INTO public.roteiro_perfis (roteiro_id, perfil)
SELECT r.id, p FROM public.roteiros r,
  (VALUES ('lojista'),('vendedor'),('gestor_de_loja')) v(p)
WHERE r.nome = 'Imersão em Campo — Loja'
ON CONFLICT DO NOTHING;

INSERT INTO public.roteiro_perfis (roteiro_id, perfil)
SELECT r.id, p FROM public.roteiros r,
  (VALUES ('projetista'),('arquiteto'),('especificador')) v(p)
WHERE r.nome = 'Imersão em Campo — Projetista'
ON CONFLICT DO NOTHING;

-- 5) Create 2 new roteiros + capítulos
DO $$
DECLARE
  _company UUID;
  _rot_nl UUID;
  _rot_gen UUID;
BEGIN
  SELECT company_id INTO _company FROM public.roteiros LIMIT 1;

  -- Interno Newline
  INSERT INTO public.roteiros (nome, descricao, perfil_alvo, versao, ativo, company_id)
  VALUES ('Imersão em Campo — Interno Newline',
          'Visão de dentro da empresa — triangula a percepção interna com o que representante/loja/projetista relatam em campo.',
          'gestor_nl / trade_nl', 1, true, _company)
  RETURNING id INTO _rot_nl;

  INSERT INTO public.roteiro_perfis (roteiro_id, perfil) VALUES
    (_rot_nl, 'gestor_nl'), (_rot_nl, 'trade_nl');

  INSERT INTO public.capitulos (roteiro_id, ordem, codigo, titulo, lente_default, campos_matriz, pergunta_abertura, pontos_escuta, orientacao) VALUES
  (_rot_nl, 1, 'percepcao_marca', 'Percepção de marca e preço', 'percepcao_marca', '[]'::jsonb,
    'Como você acha que o mercado enxerga a Newline hoje, comparado a uns 2 anos atrás?',
    ARRAY['Se a visão interna bate com o que representante e loja relatam','Se ele cita dado concreto (pesquisa, feedback) ou opinião pessoal'],
    'Triangular percepção interna vs. externa (H1).'),
  (_rot_nl, 2, 'mix_e_esforco', 'Mix e giro por linha', 'mix', '[]'::jsonb,
    'Olhando o portfólio hoje, quais linhas você sente que a equipe de vendas não está explorando o potencial?',
    ARRAY['Se ele já tem visibilidade de dado de giro/venda por linha ou é impressão','Se aponta causa: falta de treinamento, falta de material, preço'],
    'Linhas subutilizadas na visão interna (H2/H7).'),
  (_rot_nl, 3, 'concorrencia', 'Concorrência', 'concorrencia', '[]'::jsonb,
    'Qual concorrente te tira mais o sono hoje, e por quê?',
    ARRAY['Se é ameaça de preço, portfólio, ou execução comercial','Se a resposta é estratégica (mercado) ou pontual (uma conta específica)'],
    'Mapa competitivo pela ótica interna (H3).'),
  (_rot_nl, 4, 'argumento_tecnico', 'Capacitação do canal', 'argumento', '[]'::jsonb,
    'A equipe de representantes e lojas tem o material e treinamento que precisa pra defender nosso preço?',
    ARRAY['Se existe material formal ou é informal/boca a boca','Gap entre o que existe e o que realmente chega na ponta'],
    'Gap de capacitação do canal (H4).'),
  (_rot_nl, 5, 'decisao_cliente', 'Base para decisão de posicionamento', 'decisao', '[]'::jsonb,
    'Quando vocês decidem preço ou posicionamento de uma linha, que informação usam pra decidir?',
    ARRAY['Se a decisão é baseada em dado de campo ou em intuição/histórico','Se ele reconhece lacuna de informação na hora de decidir'],
    'Como se decide posicionamento internamente (H5/H6).'),
  (_rot_nl, 6, 'oportunidades_ameacas', 'Oportunidades, ameaças e cuidados', 'oportunidade', '[]'::jsonb,
    'Se você pudesse resolver um problema estrutural da Newline agora, qual seria?',
    ARRAY['Separar problema de produto de problema de processo interno','Se é algo que já tentaram resolver antes e não emplacou'],
    'Prioridades estruturais na visão interna.');

  -- Genérico
  INSERT INTO public.roteiros (nome, descricao, perfil_alvo, versao, ativo, company_id)
  VALUES ('Imersão em Campo — Genérico',
          'Perguntas abertas e não-direcionadas — cobre quem não se encaixa nos perfis mapeados.',
          'outro', 1, true, _company)
  RETURNING id INTO _rot_gen;

  INSERT INTO public.roteiro_perfis (roteiro_id, perfil) VALUES (_rot_gen, 'outro');

  INSERT INTO public.capitulos (roteiro_id, ordem, codigo, titulo, lente_default, campos_matriz, pergunta_abertura, pontos_escuta, orientacao) VALUES
  (_rot_gen, 1, 'percepcao_marca', 'Percepção de marca e preço', 'percepcao_marca', '[]'::jsonb,
    'Quando você pensa em iluminação, o que vem à cabeça sobre a Newline?',
    ARRAY['Deixar aberto — o objetivo aqui é calibrar antes de aprofundar'],
    'Calibrar percepção espontânea (H1).'),
  (_rot_gen, 2, 'mix_e_esforco', 'Mix e portfólio', 'mix', '[]'::jsonb,
    'Tem algum produto ou linha da Newline que você conhece bem? O que acha dele?',
    ARRAY['Nível real de familiaridade com o portfólio'],
    'Familiaridade com o portfólio (H2/H7).'),
  (_rot_gen, 3, 'concorrencia', 'Concorrência', 'concorrencia', '[]'::jsonb,
    'Você compara a Newline com outra marca? Com qual, e por quê?',
    ARRAY['Se cita concorrente espontaneamente'],
    'Concorrência espontânea (H3).'),
  (_rot_gen, 4, 'argumento_tecnico', 'Argumento e objeções', 'argumento', '[]'::jsonb,
    'Já teve alguma dificuldade ou dúvida em relação a produto ou preço da Newline?',
    ARRAY['Objeção real, mesmo que informal'],
    'Objeções informais (H4).'),
  (_rot_gen, 5, 'decisao_cliente', 'Critério de decisão', 'decisao', '[]'::jsonb,
    'O que faria você escolher, ou recomendar, a Newline em vez de outra marca?',
    ARRAY['Critério real, mesmo vago'],
    'Critério de escolha (H5/H6).'),
  (_rot_gen, 6, 'oportunidades_ameacas', 'Oportunidades, ameaças e cuidados', 'oportunidade', '[]'::jsonb,
    'Alguma sugestão ou crítica que queira deixar?',
    ARRAY['Captar qualquer coisa fora do padrão dos outros roteiros'],
    'Captura livre.');
END $$;
