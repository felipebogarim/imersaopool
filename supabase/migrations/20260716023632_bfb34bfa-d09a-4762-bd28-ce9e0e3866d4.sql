
CREATE TABLE public.rep_bi_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  periodo_label TEXT NOT NULL,
  filename TEXT,
  data JSONB NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  substituida_em TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_bi_uploads TO authenticated;
GRANT ALL ON public.rep_bi_uploads TO service_role;
ALTER TABLE public.rep_bi_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY rep_bi_uploads_company_scope ON public.rep_bi_uploads
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
CREATE INDEX rep_bi_uploads_rep_idx ON public.rep_bi_uploads(representative_id, created_at DESC);

INSERT INTO public.rep_bi_uploads (representative_id, company_id, periodo_label, filename, data)
VALUES (
  '4acb21e4-ea70-4e05-9a95-9ed480eba337',
  'c86498e0-be56-4ed4-a362-6cdfbf72eff7',
  '1º Semestre 2026',
  'BI_DESEMPENHO_SALTON_FABIO_1_SEMESTRE_26_PERCENTUAIS.xlsx',
  '{"geral":0.5024153074027603,"maior_categoria":{"label":"Black","participacao":0.497471436598614},"maior_grupo_farol":{"label":"Excelente","participacao":0.47249797090591245},"categorias":[{"categoria":"Black","participacao":0.497471436598614,"atingimento":0.6073170731707317},{"categoria":"Gold","participacao":0.3962040332147094,"atingimento":0.5036507936507937},{"categoria":"Silver","participacao":0.10632453018667666,"atingimento":0.27646103896103896}],"farol":[{"grupo":"Sem compra","participacao":0},{"grupo":"Abaixo da meta","participacao":0.18667665605294376},{"grupo":"Pode melhorar","participacao":0.08990447649372542},{"grupo":"Próximo","participacao":0.1358556533682962},{"grupo":"Ótimo","participacao":0.11506524317912219},{"grupo":"Excelente","participacao":0.47249797090591245}],"piores_familias":[{"categoria":"Black","posicao":1,"familia_pior_atingimento":"PRO LAMP","atingimento_pior":0.29375,"familia_maior_participacao":"DECOR NEWLINE","participacao_maior":0.22220141100081164,"atingimento_maior":0.6424187725631769},{"categoria":"Black","posicao":2,"familia_pior_atingimento":"PERFIL","atingimento_pior":0.425,"familia_maior_participacao":"DECOR STUDIO","participacao_maior":0.18486607979022288,"atingimento_maior":0.5140625},{"categoria":"Black","posicao":3,"familia_pior_atingimento":"FITAS E FONTES","atingimento_pior":0.44375,"familia_maior_participacao":"SISTEMAS E MODULOS","participacao_maior":0.2836361366048573,"atingimento_maior":0.7351132686084142},{"categoria":"Gold","posicao":1,"familia_pior_atingimento":"FITAS E FONTES","atingimento_pior":0.1523809523809524,"familia_maior_participacao":"PRO LED","participacao_maior":0.09346319535493539,"atingimento_maior":0.562781954887218},{"categoria":"Gold","posicao":2,"familia_pior_atingimento":"PRO LAMP","atingimento_pior":0.37857142857142856,"familia_maior_participacao":"PRO LAMP","participacao_maior":0.06424424049447462,"atingimento_maior":0.30087719298245613},{"categoria":"Gold","posicao":3,"familia_pior_atingimento":"PERFIL","atingimento_pior":0.4142857142857143,"familia_maior_participacao":"PERFIL","participacao_maior":0.10626209652244491,"atingimento_maior":0.3545833333333333},{"categoria":"Silver","posicao":1,"familia_pior_atingimento":"FITAS E FONTES","atingimento_pior":0.05,"familia_maior_participacao":"FITAS E FONTES","participacao_maior":0.04532684023225323,"atingimento_maior":0.20625},{"categoria":"Silver","posicao":2,"familia_pior_atingimento":"PERFIL","atingimento_pior":0.06136363636363636,"familia_maior_participacao":null,"participacao_maior":null,"atingimento_maior":null},{"categoria":"Silver","posicao":3,"familia_pior_atingimento":"PRO LAMP","atingimento_pior":0.2,"familia_maior_participacao":"PRO LAMP","participacao_maior":null,"atingimento_maior":null}]}'::jsonb
);
