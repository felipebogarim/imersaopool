-- Módulo "Solicitações Internas" — garante um único destinatário principal
-- ativo por setor (decisão: opção B, não permitir múltiplos principais).
--
-- Só considera is_primary_recipient=true junto com active=true: uma pessoa
-- inativa com a flag antiga não conta pra unicidade (ela não recebe e-mail
-- de qualquer forma, já filtrada por active=true na resolução de
-- destinatários). O caminho normal (upsertInternalTicketSectorPerson) já
-- desmarca o principal anterior antes de salvar um novo — este índice é a
-- rede de segurança contra corrida/gravação direta no banco.
CREATE UNIQUE INDEX internal_ticket_sector_people_one_principal_idx
  ON public.internal_ticket_sector_people (sector_id)
  WHERE is_primary_recipient = true AND active = true;
