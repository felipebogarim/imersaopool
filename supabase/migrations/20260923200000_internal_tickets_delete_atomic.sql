-- Módulo "Solicitações Internas" — exclusão definitiva de ticket sem órfãos.
--
-- Filhos com FK ON DELETE CASCADE (recipients, events, messages, attachments,
-- action_tokens, products, sector_stops) já saem com o DELETE do ticket.
-- internal_ticket_email_outbox.ticket_id NÃO tem FK (migration 080000), então
-- suas linhas (outbound e inbound) ficariam órfãs: esta função as remove na
-- MESMA transação do DELETE do ticket. Arquivos do bucket são removidos pelo
-- servidor depois do commit (Storage não participa da transação SQL).
--
-- Exclusão é ação explícita do master; nunca usada como compensação de falha
-- (a criação é atômica — ver 20260923190000).
-- Execução: somente service_role (o servidor confere o master antes).

CREATE OR REPLACE FUNCTION public.internal_ticket_delete_atomic(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.internal_tickets WHERE id = p_ticket_id) THEN
    RAISE EXCEPTION 'Ticket não encontrado.';
  END IF;

  DELETE FROM public.internal_ticket_email_outbox WHERE ticket_id = p_ticket_id;
  DELETE FROM public.internal_tickets WHERE id = p_ticket_id; -- cascata nos demais filhos
END;
$$;

REVOKE ALL ON FUNCTION public.internal_ticket_delete_atomic(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.internal_ticket_delete_atomic(uuid) TO service_role;
