-- Libera a Inteligência Comercial no portal SOMENTE para o REPRESENTANTE TESTE (homologação).
-- A flag global (portal_representante_habilitado) continua false. Não cria tabela nem amplia
-- acesso: o representante segue restrito à própria carteira. Aborta se o nome não for único
-- ou se o representante não tiver login vinculado.
DO $$
DECLARE _ids uuid[];
BEGIN
  SELECT array_agg(id) INTO _ids FROM public.representatives
  WHERE upper(btrim(nome)) = 'REPRESENTANTE TESTE';
  IF coalesce(array_length(_ids, 1), 0) <> 1 THEN
    RAISE EXCEPTION 'Esperado exatamente 1 REPRESENTANTE TESTE, encontrados %', coalesce(array_length(_ids, 1), 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.representatives WHERE id = _ids[1] AND user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'REPRESENTANTE TESTE sem login vinculado (representatives.user_id)';
  END IF;
  INSERT INTO public.brain_settings (chave, valor, updated_at)
  VALUES ('portal_representantes_piloto', to_jsonb(_ids), now())
  ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();
END $$;

-- Conferência (deve mostrar a flag global false e 1 id no piloto):
SELECT chave, valor FROM public.brain_settings
WHERE chave IN ('portal_representante_habilitado', 'portal_representantes_piloto');
