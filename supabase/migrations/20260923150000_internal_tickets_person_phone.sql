-- Módulo "Solicitações Internas" — telefone do responsável de setor.
ALTER TABLE public.internal_ticket_sector_people ADD COLUMN IF NOT EXISTS phone text NULL;
