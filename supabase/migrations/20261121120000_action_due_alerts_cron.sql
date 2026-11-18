-- Fase 3 do Ações Reps: agenda diária (08:00 em Brasília = 11:00 UTC) do alerta de vencimento.
-- O endpoint avisa o representante 5 dias antes do prazo, com cópia aos gestores master, e é
-- idempotente (cada prazo só é avisado uma vez). A chave usada é a anon key pública, igual aos
-- demais hooks agendados.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('acoes-reps-alerta-vencimento');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('acoes-reps-alerta-vencimento', '0 11 * * *', $$
  SELECT net.http_post(
    url:='https://poolflux.app/api/public/hooks/action-due-alerts',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmY3ZyY2pieml2dXpmZHBtenFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDM4MjAsImV4cCI6MjA5Nzg3OTgyMH0.lJvxmYKOlaCa0SUNpT4xrIfvwGAL8KiJ-B7Q33Ea2BE"}'::jsonb,
    body:='{}'::jsonb);
$$);
