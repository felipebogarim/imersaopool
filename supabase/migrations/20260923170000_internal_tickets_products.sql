-- Módulo "Solicitações Internas" — múltiplos produtos por ticket.
--
-- internal_tickets.product_id (coluna única, migration 20260923090100) fica
-- sem uso a partir de agora — não removida pra não quebrar nada que já
-- tenha rodado, mas createInternalTicket não escreve mais nela. A relação
-- real é esta tabela (N:N), sem cache de "produto único" pra não repetir o
-- mesmo problema de duas fontes de verdade que sector_id x sector_stops já
-- teve que equilibrar deliberadamente.

CREATE TABLE public.internal_ticket_products (
  ticket_id uuid NOT NULL REFERENCES public.internal_tickets(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.own_products(id),
  PRIMARY KEY (ticket_id, product_id)
);

ALTER TABLE public.internal_ticket_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_ticket_products_select ON public.internal_ticket_products
  FOR SELECT TO authenticated
  USING (public.internal_ticket_can_access(ticket_id, auth.uid()));

-- Sem risco de "spoofing de origem" como em eventos/mensagens (não há campo
-- origin aqui) — quem já tem acesso ao ticket pode associar produtos reais
-- a ele diretamente, mesmo caminho autenticado usado pra criar o ticket.
CREATE POLICY internal_ticket_products_insert ON public.internal_ticket_products
  FOR INSERT TO authenticated
  WITH CHECK (public.internal_ticket_can_access(ticket_id, auth.uid()));
