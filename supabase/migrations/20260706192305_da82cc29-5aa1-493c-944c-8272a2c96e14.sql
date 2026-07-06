
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS perfil TEXT,
  ADD COLUMN IF NOT EXISTS perfil_outro TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS tema TEXT,
  ADD COLUMN IF NOT EXISTS tema_outro TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS interviews_client_id_idx ON public.interviews(client_id);
