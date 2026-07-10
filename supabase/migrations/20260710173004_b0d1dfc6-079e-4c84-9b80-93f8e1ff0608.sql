
-- 1. Novo status
ALTER TYPE public.perspectiva_status ADD VALUE IF NOT EXISTS 'aguardando_revisao';

-- Precisa commitar antes de usar o novo valor de enum em função no mesmo script
COMMIT;
BEGIN;

-- 2. Função de fan-out
CREATE OR REPLACE FUNCTION public.fanout_representative_input()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id uuid;
  _company_id uuid;
BEGIN
  SELECT client_id, company_id INTO _client_id, _company_id
  FROM public.immersions WHERE id = NEW.immersion_id;

  IF _client_id IS NULL OR _company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- percepcao_marca
  IF COALESCE(NEW.percepcao_marca,'') <> '' THEN
    INSERT INTO public.perspectivas (company_id, escopo_tipo, escopo_ref_id, lente, conteudo, origem, status)
    VALUES (_company_id, 'cliente', _client_id, 'percepcao_marca',
            jsonb_build_object('relato_livre', NEW.percepcao_marca),
            'representante', 'aguardando_revisao');
  END IF;

  -- concorrencia
  IF COALESCE(NEW.marcas_concorrentes,'') <> '' THEN
    INSERT INTO public.perspectivas (company_id, escopo_tipo, escopo_ref_id, lente, conteudo, origem, status)
    VALUES (_company_id, 'cliente', _client_id, 'concorrencia',
            jsonb_build_object('relato_livre', NEW.marcas_concorrentes),
            'representante', 'aguardando_revisao');
  END IF;

  -- oportunidade consolidada (oportunidade + ameaca + acao + cuidado)
  IF COALESCE(NEW.oportunidades,'') <> ''
     OR COALESCE(NEW.ameacas,'') <> ''
     OR COALESCE(NEW.acoes_faturamento,'') <> ''
     OR COALESCE(NEW.cuidados,'') <> '' THEN
    INSERT INTO public.perspectivas (company_id, escopo_tipo, escopo_ref_id, lente, conteudo, origem, status)
    VALUES (_company_id, 'cliente', _client_id, 'oportunidade',
            jsonb_build_object(
              'oportunidade', COALESCE(NEW.oportunidades,''),
              'ameaca',       COALESCE(NEW.ameacas,''),
              'acao_sugerida',COALESCE(NEW.acoes_faturamento,''),
              'cuidado',      COALESCE(NEW.cuidados,'')
            ),
            'representante', 'aguardando_revisao');
  END IF;

  RETURN NEW;
END $$;

-- 3. Trigger AFTER INSERT
DROP TRIGGER IF EXISTS trg_fanout_representative_input ON public.representative_inputs;
CREATE TRIGGER trg_fanout_representative_input
AFTER INSERT ON public.representative_inputs
FOR EACH ROW EXECUTE FUNCTION public.fanout_representative_input();

-- 4. Backfill de todos os representative_inputs já existentes
INSERT INTO public.perspectivas (company_id, escopo_tipo, escopo_ref_id, lente, conteudo, origem, status)
SELECT i.company_id, 'cliente', i.client_id, 'percepcao_marca',
       jsonb_build_object('relato_livre', ri.percepcao_marca),
       'representante', 'aguardando_revisao'
FROM public.representative_inputs ri
JOIN public.immersions i ON i.id = ri.immersion_id
WHERE COALESCE(ri.percepcao_marca,'') <> ''
  AND i.client_id IS NOT NULL AND i.company_id IS NOT NULL;

INSERT INTO public.perspectivas (company_id, escopo_tipo, escopo_ref_id, lente, conteudo, origem, status)
SELECT i.company_id, 'cliente', i.client_id, 'concorrencia',
       jsonb_build_object('relato_livre', ri.marcas_concorrentes),
       'representante', 'aguardando_revisao'
FROM public.representative_inputs ri
JOIN public.immersions i ON i.id = ri.immersion_id
WHERE COALESCE(ri.marcas_concorrentes,'') <> ''
  AND i.client_id IS NOT NULL AND i.company_id IS NOT NULL;

INSERT INTO public.perspectivas (company_id, escopo_tipo, escopo_ref_id, lente, conteudo, origem, status)
SELECT i.company_id, 'cliente', i.client_id, 'oportunidade',
       jsonb_build_object(
         'oportunidade', COALESCE(ri.oportunidades,''),
         'ameaca',       COALESCE(ri.ameacas,''),
         'acao_sugerida',COALESCE(ri.acoes_faturamento,''),
         'cuidado',      COALESCE(ri.cuidados,'')
       ),
       'representante', 'aguardando_revisao'
FROM public.representative_inputs ri
JOIN public.immersions i ON i.id = ri.immersion_id
WHERE (COALESCE(ri.oportunidades,'') <> ''
    OR COALESCE(ri.ameacas,'') <> ''
    OR COALESCE(ri.acoes_faturamento,'') <> ''
    OR COALESCE(ri.cuidados,'') <> '')
  AND i.client_id IS NOT NULL AND i.company_id IS NOT NULL;
