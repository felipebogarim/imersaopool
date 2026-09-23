-- Módulo "Solicitações Internas" — Detalhe do ticket: bucket de anexos.
-- Mesmo padrão de kanban-attachments (migrations 20260720125633/20260723141227):
-- INSERT/DELETE liberado pra qualquer authenticated dono do arquivo (owner =
-- auth.uid(), setado automaticamente pelo client-side upload); a tabela
-- internal_ticket_attachments é quem realmente amarra o arquivo a um ticket,
-- e o INSERT nela já exige internal_ticket_can_access(ticket_id) — então um
-- upload "solto" sem linha correspondente não vira anexo visível de ninguém.

-- file_size_limit é reforço server-side do limite de 20MB do client
-- (attachments.ts) — sem isso, o limite era só uma checagem em JS,
-- contornável por qualquer chamada direta à API do Storage.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('internal-ticket-attachments', 'internal-ticket-attachments', false, 20971520)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

CREATE POLICY "internal_ticket_att_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'internal-ticket-attachments'
    AND EXISTS (
      SELECT 1 FROM public.internal_ticket_attachments a
      WHERE a.storage_path = storage.objects.name
        AND public.internal_ticket_can_access(a.ticket_id, auth.uid())
    )
  );

CREATE POLICY "internal_ticket_att_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'internal-ticket-attachments' AND owner = auth.uid());

CREATE POLICY "internal_ticket_att_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'internal-ticket-attachments' AND owner = auth.uid());
