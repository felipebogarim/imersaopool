-- Portal do representante (Fase 2): novo papel para usuários externos (representantes).
-- Fica sozinho nesta migration porque um valor novo de enum não pode ser usado na mesma transação.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'representante';
