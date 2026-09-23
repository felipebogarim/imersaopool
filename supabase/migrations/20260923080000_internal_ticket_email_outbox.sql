-- Módulo "Solicitações Internas" — Fase 3: outbox/log de e-mail, desacoplado
-- do schema de tickets (que ainda não existe — chega na Fase 1/2 deste módulo).
--
-- ticket_id fica sem FK proposital: será apontada para internal_tickets.id
-- assim que essa tabela existir, evitando recriar este outbox depois.

create table public.internal_ticket_email_outbox (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid null,
  direction text not null check (direction in ('outbound', 'inbound')),
  idempotency_key text not null,
  provider text not null default 'resend',
  provider_message_id text null,
  message_id text null,
  in_reply_to text null,
  reference_ids text[] null,
  template_name text null,
  recipient_email text null,
  sender_email text null,
  subject text null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'delivered', 'failed', 'bounced', 'received')),
  attempt_count integer not null default 0,
  last_attempted_at timestamptz null,
  error_message text null,
  raw_payload jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_ticket_email_outbox_idempotency_key_key unique (idempotency_key)
);

create index internal_ticket_email_outbox_ticket_id_idx
  on public.internal_ticket_email_outbox (ticket_id);
create index internal_ticket_email_outbox_message_id_idx
  on public.internal_ticket_email_outbox (message_id);
create index internal_ticket_email_outbox_in_reply_to_idx
  on public.internal_ticket_email_outbox (in_reply_to);

create trigger trg_internal_ticket_email_outbox_updated
  before update on public.internal_ticket_email_outbox
  for each row execute function public.touch_updated_at();

alter table public.internal_ticket_email_outbox enable row level security;

-- Todo o tráfego é server-side (service role, que ignora RLS). O único acesso
-- de usuário autenticado previsto nesta fase é leitura por admin, para suporte/debug.
create policy internal_ticket_email_outbox_admin_select
  on public.internal_ticket_email_outbox
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Incremento atômico de attempt_count (evita race de leitura-then-escrita a
-- partir do outbox.server.ts, que faz update de status e contagem em duas chamadas).
create or replace function public.internal_ticket_email_outbox_increment_attempt(p_idempotency_key text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.internal_ticket_email_outbox
  set attempt_count = attempt_count + 1
  where idempotency_key = p_idempotency_key;
$$;

revoke all on function public.internal_ticket_email_outbox_increment_attempt(text) from public, anon, authenticated;
grant execute on function public.internal_ticket_email_outbox_increment_attempt(text) to service_role;
