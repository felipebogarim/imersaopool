-- Renomear o roteiro
UPDATE public.roteiros 
SET nome = 'VISITA EST. CLIENTE' 
WHERE nome = 'Visita Cliente Final';

-- Garantir que o roteiro apareça nas imersões adicionando o perfil 'imersao'
DO $$
DECLARE
    v_roteiro_id uuid;
    v_company_id uuid;
BEGIN
    SELECT id, company_id INTO v_roteiro_id, v_company_id 
    FROM public.roteiros 
    WHERE nome = 'VISITA EST. CLIENTE' 
    LIMIT 1;

    IF v_roteiro_id IS NOT NULL THEN
        INSERT INTO public.roteiro_perfis (roteiro_id, perfil, company_id)
        VALUES (v_roteiro_id, 'imersao', v_company_id)
        ON CONFLICT (roteiro_id, perfil) DO NOTHING;
    END IF;
END $$;
