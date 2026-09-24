-- EMAIL-FIRST: novos estados e ações formais.
-- Isolado porque valores recém-adicionados a enums não devem ser usados na
-- mesma transação de migration no PostgreSQL.

ALTER TYPE public.internal_ticket_status ADD VALUE IF NOT EXISTS 'aguardando_validacao';
ALTER TYPE public.internal_ticket_status ADD VALUE IF NOT EXISTS 'reaberto';

ALTER TYPE public.internal_ticket_action ADD VALUE IF NOT EXISTS 'indicar_conclusao';
ALTER TYPE public.internal_ticket_action ADD VALUE IF NOT EXISTS 'confirmar_conclusao';
ALTER TYPE public.internal_ticket_action ADD VALUE IF NOT EXISTS 'nao_resolvido';
